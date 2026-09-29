import { expect, type APIRequestContext } from '@playwright/test';
import {
  formatWalletBalanceEmailSlotSettingsLabel,
  WALLET_BALANCE_EMAIL_SLOT_COPY,
  type WalletBalanceEmailSlot
} from '@/features/wallet/constants/wallet-balance-email-slot-copy';
import { createAdminRequest } from '../helpers/auth-request';
import { resolveUserIdByEmail, uniqueEmail } from '../notifications/helpers';

export { uniqueEmail, WALLET_BALANCE_EMAIL_SLOT_COPY, formatWalletBalanceEmailSlotSettingsLabel };

export type KstParts = {
  hour: number;
  minute: number;
  weekday: number;
};

export function getKstParts(date = new Date()): KstParts {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(date.getTime() + kstOffset);

  return {
    hour: kstDate.getUTCHours(),
    minute: kstDate.getUTCMinutes(),
    weekday: kstDate.getUTCDay()
  };
}

/** Serial due=0 tests — +30min avoids next-minute due bleed */
export function getNonDueKstSchedule(parts = getKstParts()) {
  const totalMinutes = parts.hour * 60 + parts.minute;
  const offset = (totalMinutes + 30) % (24 * 60);

  return {
    hour: Math.floor(offset / 60),
    minute: offset % 60
  };
}

export function walletBalanceEmailCronHeaders() {
  const secret =
    process.env.WALLET_BALANCE_EMAIL_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json'
  };
}

export function walletSyncHeaders() {
  const token = process.env.WALLET_SYNC_TOKEN;
  if (!token) {
    return undefined;
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

export function isDryRunEnabled() {
  return process.env.E2E_WALLET_BALANCE_EMAIL_DRY_RUN === '1';
}

export function parseAllowlist(): Set<string> {
  const raw =
    process.env.WALLET_BALANCE_EMAIL_ALLOWLIST?.trim() || 'shhong@wakecorp.com';
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  actor_email?: string;
  metadata?: Record<string, unknown>;
};

export async function listActivityLogs(
  request: APIRequestContext,
  action: string,
  options?: { logUser?: 'self' | 'all' }
) {
  const logUserQuery =
    options?.logUser === 'all' ? '&log_user=all' : '';
  const response = await request.get(
    `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50${logUserQuery}`
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    success?: boolean;
    data?: { logs?: ActivityLogItem[] };
  };
  return body.data?.logs ?? [];
}

export async function expectActivityLog(
  request: APIRequestContext,
  action: string,
  requestId: string,
  status: number,
  options?: { logUser?: 'self' | 'all' }
) {
  await expect
    .poll(async () => {
      const logs = await listActivityLogs(request, action, options);
      return logs.some(
        (item) =>
          item.request_id === requestId &&
          item.action === action &&
          item.http_status === status
      );
    })
    .toBe(true);
}

export async function createWalletSyncForName(
  request: APIRequestContext,
  fullName: string,
  options?: { monthly_limit?: number; monthly_remaining?: number }
) {
  const headers = walletSyncHeaders();
  expect(headers, 'WALLET_SYNC_TOKEN is required in .env').toBeTruthy();

  const response = await request.post('/api/wallet/sync', {
    headers: headers!,
    data: {
      synced_at: new Date().toISOString(),
      items: [
        {
          name: fullName,
          monthly_limit: options?.monthly_limit ?? 300_000,
          monthly_remaining: options?.monthly_remaining ?? 150_000
        }
      ]
    }
  });

  expect(response.status()).toBe(200);
  const body = (await response.json()) as { matched?: number };
  expect(body.matched).toBeGreaterThan(0);
}

export async function postWalletBalanceEmailDispatch(request: APIRequestContext) {
  const headers = walletBalanceEmailCronHeaders();
  expect(
    headers,
    'WALLET_BALANCE_EMAIL_CRON_SECRET or CRON_SECRET is required in .env'
  ).toBeTruthy();

  return request.post('/api/wallet/balance-email/dispatch', {
    headers: headers!
  });
}

export async function patchWalletBalanceEmailPreferences(
  request: APIRequestContext,
  patch: Record<string, unknown>,
  user?: string
) {
  const query = user ? `?user=${encodeURIComponent(user)}` : '';
  return request.patch(`/api/wallet/balance-email/preferences${query}`, {
    data: patch
  });
}

export async function enableDuePreferencesForUser(
  request: APIRequestContext,
  userId: string,
  parts = getKstParts()
) {
  const response = await patchWalletBalanceEmailPreferences(
    request,
    {
      enabled: true,
      hour: parts.hour,
      minute: parts.minute,
      exclude_weekends: false
    },
    userId
  );
  expect(response.status()).toBe(200);
}

export async function resolveE2EUserId(adminRequest: APIRequestContext) {
  const email = process.env.E2E_USER_EMAIL;
  expect(email, 'E2E_USER_EMAIL is required').toBeTruthy();
  return resolveUserIdByEmail(adminRequest, email!);
}

/** 현재 KST tick due 오염 방지 — E2E user preferences OFF */
export async function ensureE2EUserNotDue(adminRequest: APIRequestContext) {
  const userId = await resolveE2EUserId(adminRequest);
  const response = await patchWalletBalanceEmailPreferences(
    adminRequest,
    { enabled: false, slot2_enabled: false },
    userId
  );
  expect([200, 404]).toContain(response.status());
}

export async function resolveE2EUserFullName(adminRequest: APIRequestContext) {
  const email = process.env.E2E_USER_EMAIL;
  expect(email, 'E2E_USER_EMAIL is required').toBeTruthy();
  const response = await adminRequest.get(
    `/api/users?search=${encodeURIComponent(email!)}&limit=5`
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    users?: Array<{ email: string; full_name?: string }>;
  };
  const user = body.users?.find((item) => item.email === email);
  expect(user?.full_name).toBeTruthy();
  return user!.full_name!;
}

export async function createDisposableUserWithEmail(
  adminRequest: APIRequestContext,
  email: string,
  prefix: string
) {
  const fullName = `E2E-WBE-${prefix}-${Date.now()}`;
  const response = await adminRequest.post('/api/users', {
    data: {
      email,
      full_name: fullName,
      affiliation: 'wake',
      rank: '경영진',
      system_role: 'user',
      birthday: '1990-01-01',
      phone: '01012345678'
    }
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user_id?: string };
  expect(body.user_id).toBeTruthy();
  return { email, fullName, userId: body.user_id! };
}

export async function createDisposableUser(
  adminRequest: APIRequestContext,
  prefix: string
) {
  const email = uniqueEmail(prefix);
  const fullName = `E2E-WBE-${prefix}-${Date.now()}`;
  const response = await adminRequest.post('/api/users', {
    data: {
      email,
      full_name: fullName,
      affiliation: 'wake',
      rank: '경영진',
      system_role: 'user',
      birthday: '1990-01-01',
      phone: '01012345678'
    }
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user_id?: string };
  expect(body.user_id).toBeTruthy();
  return { email, fullName, userId: body.user_id! };
}

export async function createAdminRequestContext(
  playwright: { request: { newContext: (options: Record<string, unknown>) => Promise<APIRequestContext> } }
) {
  return createAdminRequest(playwright);
}

export type WalletBalanceEmailNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export async function listNotifications(
  request: APIRequestContext,
  userId?: string
): Promise<WalletBalanceEmailNotification[]> {
  const query = userId ? `&notif_user=${encodeURIComponent(userId)}` : '';
  const response = await request.get(`/api/notifications?limit=50${query}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { notifications?: WalletBalanceEmailNotification[] };
  };
  return body.data?.notifications ?? [];
}

export async function listActiveAdminUserIds(
  request: APIRequestContext
): Promise<string[]> {
  const response = await request.get('/api/users?systemRoles=admin&limit=50');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    users?: Array<{ id: string; status: string; system_role: string }>;
  };
  return (body.users ?? [])
    .filter((user) => user.status === 'active' && user.system_role === 'admin')
    .map((user) => user.id);
}

export async function countBalanceEmailAdminNotifications(
  request: APIRequestContext,
  adminId: string,
  runId?: number
) {
  const notifications = await listNotifications(request, adminId);
  return notifications.filter(
    (item) =>
      item.type === 'wallet.balance_email_admin' &&
      (runId === undefined || Number(item.metadata?.run_id) === runId)
  ).length;
}

export async function getWalletBalanceEmailPreferences(
  request: APIRequestContext,
  userId: string
) {
  const response = await request.get(
    `/api/wallet/balance-email/preferences?user=${encodeURIComponent(userId)}`
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { preferences?: Record<string, unknown> };
  };
  return body.data?.preferences ?? {};
}

/** slot1 at tick; slot2 disabled */
export async function enableSlot1OnlyPreferences(
  request: APIRequestContext,
  userId: string,
  hour: number,
  minute: number
) {
  const response = await patchWalletBalanceEmailPreferences(
    request,
    {
      enabled: true,
      hour,
      minute,
      slot2_enabled: false,
      exclude_weekends: false
    },
    userId
  );
  expect(response.status()).toBe(200);
}

/** slot1 fixed; slot2 at tick */
export async function enableSlot2DuePreferences(
  request: APIRequestContext,
  userId: string,
  slot1: { hour: number; minute: number },
  slot2: { hour: number; minute: number }
) {
  const response = await patchWalletBalanceEmailPreferences(
    request,
    {
      enabled: true,
      hour: slot1.hour,
      minute: slot1.minute,
      slot2_enabled: true,
      hour2: slot2.hour,
      minute2: slot2.minute,
      exclude_weekends: false
    },
    userId
  );
  expect(response.status()).toBe(200);
}

export async function findWalletBalanceEmailNotificationForRun(
  request: APIRequestContext,
  userId: string,
  runId: number
) {
  const notifications = await listNotifications(request, userId);
  return notifications.find(
    (item) =>
      item.type === 'wallet.balance_email' &&
      Number(item.metadata?.run_id) === runId
  );
}

export function expectWalletBalanceEmailNotificationSlot(
  notification: WalletBalanceEmailNotification | undefined,
  slot: WalletBalanceEmailSlot
) {
  const copy = WALLET_BALANCE_EMAIL_SLOT_COPY[slot];
  expect(notification).toBeTruthy();
  expect(notification!.title).toBe(copy.inAppTitle);
  expect(notification!.body).toBe(copy.inAppBody);
  expect(notification!.metadata?.slot).toBe(slot);
}

type DispatchRecipient = { status: string; user_id: string };

export async function expectDispatchSentRecipient(
  adminRequest: APIRequestContext,
  dispatchBody: {
    run?: { id: number } | null;
    recipients?: DispatchRecipient[];
  },
  userId: string
) {
  let recipient = dispatchBody.recipients?.find(
    (item) => item.user_id === userId && item.status === 'sent'
  );

  if (!recipient && dispatchBody.run?.id) {
    await expect
      .poll(async () => {
        const detailResponse = await adminRequest.get(
          `/api/wallet/balance-email/logs/${dispatchBody.run!.id}`
        );
        if (detailResponse.status() !== 200) {
          return false;
        }
        const detailBody = (await detailResponse.json()) as {
          data?: { recipients?: DispatchRecipient[] };
        };
        recipient = detailBody.data?.recipients?.find(
          (item) => item.user_id === userId && item.status === 'sent'
        );
        return recipient != null;
      })
      .toBe(true);
  } else {
    expect(recipient, `Expected sent recipient for user ${userId}`).toBeTruthy();
  }

  return recipient!;
}
