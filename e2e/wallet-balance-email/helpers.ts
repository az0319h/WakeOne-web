import { expect, type APIRequestContext } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import { resolveUserIdByEmail, uniqueEmail } from '../notifications/helpers';

export { uniqueEmail };

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
