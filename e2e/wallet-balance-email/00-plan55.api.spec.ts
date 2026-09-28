import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  countBalanceEmailAdminNotifications,
  createDisposableUser,
  createWalletSyncForName,
  enableDuePreferencesForUser,
  enableSlot1OnlyPreferences,
  enableSlot2DuePreferences,
  expectActivityLog,
  getKstParts,
  getWalletBalanceEmailPreferences,
  isDryRunEnabled,
  listActiveAdminUserIds,
  listActivityLogs,
  listNotifications,
  parseAllowlist,
  patchWalletBalanceEmailPreferences,
  postWalletBalanceEmailDispatch,
  resolveE2EUserId
} from './helpers';

type DispatchResponse = {
  success?: boolean;
  run?: {
    id: number;
    run_key: string;
    due_count?: number;
    sent_count?: number;
    failed_count?: number;
    blocked_count?: number;
    skipped_count?: number;
  } | null;
  recipients?: Array<{ status: string; user_id: string }>;
  message?: string;
};

test.describe.configure({ mode: 'serial' });

test.describe('plan 55 — admin 알림·slot2 API', () => {
  test.setTimeout(120_000);

  test('AC-01: 신규 run — active admin 전원 wallet.balance_email_admin 1건', async ({
    playwright
  }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const adminIds = await listActiveAdminUserIds(adminRequest);
      expect(adminIds.length).toBeGreaterThanOrEqual(1);

      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p55-ac01');
      await createWalletSyncForName(adminRequest, fullName);
      await enableDuePreferencesForUser(adminRequest, userId, getKstParts());

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();

      if (body.message?.includes('이미 실행')) {
        test.skip(true, 'Duplicate run_key for current KST minute — admin fan-out skipped');
      }

      await expect
        .poll(async () => {
          for (const adminId of adminIds) {
            const count = await countBalanceEmailAdminNotifications(
              adminRequest,
              adminId,
              body.run!.id
            );
            if (count === 0) {
              return false;
            }
          }
          return true;
        }, { timeout: 15_000 })
        .toBe(true);

      for (const adminId of adminIds) {
        expect(
          await countBalanceEmailAdminNotifications(adminRequest, adminId, body.run!.id)
        ).toBe(1);
      }

      const sampleNotification = (
        await listNotifications(adminRequest, adminIds[0]!)
      ).find(
        (item) =>
          item.type === 'wallet.balance_email_admin' &&
          Number(item.metadata?.run_id) === body.run!.id
      );
      expect(sampleNotification).toBeTruthy();
      expect(sampleNotification!.body).toMatch(/대상 \d+명 · 발송 \d+ · 실패 \d+ · 차단 \d+ · 건너뜀 \d+/);
      expect(sampleNotification!.body).not.toMatch(/@/);
      expect(sampleNotification!.body).not.toContain('원');
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-02: sent=0 blocked run — admin 알림 1건/admin, 발송 0건 제목', async ({
    playwright
  }) => {
    test.skip(
      isDryRunEnabled(),
      'Dry-run bypasses allowlist — run with E2E_WALLET_BALANCE_EMAIL_DRY_RUN unset'
    );

    const adminRequest = await createAdminRequest(playwright);

    try {
      const adminIds = await listActiveAdminUserIds(adminRequest);
      expect(adminIds.length).toBeGreaterThanOrEqual(1);

      const { userId, email, fullName } = await createDisposableUser(
        adminRequest,
        'wbe-p55-ac02'
      );
      expect(parseAllowlist().has(email.toLowerCase())).toBe(false);

      await createWalletSyncForName(adminRequest, fullName);
      await enableDuePreferencesForUser(adminRequest, userId, getKstParts());

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();

      const recipient = body.recipients?.find((item) => item.user_id === userId);
      expect(recipient?.status).toBe('blocked');

      await expect
        .poll(async () => {
          const notifications = await listNotifications(adminRequest, adminIds[0]!);
          return notifications.some(
            (item) =>
              item.type === 'wallet.balance_email_admin' &&
              item.metadata?.run_id === body.run!.id &&
              item.title === '식대 잔액 이메일 run 완료 (발송 0건)'
          );
        })
        .toBe(true);

      for (const adminId of adminIds) {
        expect(
          await countBalanceEmailAdminNotifications(adminRequest, adminId, body.run!.id)
        ).toBe(1);
      }
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-03: duplicate run (pending=0) — 신규 admin 알림 0건', async ({
    playwright
  }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const adminIds = await listActiveAdminUserIds(adminRequest);
      expect(adminIds.length).toBeGreaterThanOrEqual(1);

      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p55-ac03');
      await createWalletSyncForName(adminRequest, fullName);
      await enableDuePreferencesForUser(adminRequest, userId, getKstParts());

      const first = await postWalletBalanceEmailDispatch(adminRequest);
      expect(first.status()).toBe(200);
      const firstBody = (await first.json()) as DispatchResponse;
      expect(firstBody.run).toBeTruthy();

      await expect
        .poll(async () =>
          countBalanceEmailAdminNotifications(
            adminRequest,
            adminIds[0]!,
            firstBody.run!.id
          )
        )
        .toBe(1);

      const countsAfterFirst = new Map<string, number>();
      for (const adminId of adminIds) {
        countsAfterFirst.set(
          adminId,
          await countBalanceEmailAdminNotifications(adminRequest, adminId)
        );
      }

      const second = await postWalletBalanceEmailDispatch(adminRequest);
      expect(second.status()).toBe(200);
      const secondBody = (await second.json()) as DispatchResponse;
      expect(secondBody.message).toContain('이미 실행');

      for (const adminId of adminIds) {
        const after = await countBalanceEmailAdminNotifications(adminRequest, adminId);
        expect(after).toBe(countsAfterFirst.get(adminId));
      }
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-06: slot1 due, slot2 OFF — slot1 매칭', async ({ playwright }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const parts = getKstParts();
      const slot1Hour = parts.hour;
      const slot1Minute = parts.minute;
      const slot2Hour = (parts.hour + 1) % 24;
      const slot2Minute = (parts.minute + 30) % 60;

      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p55-ac06');
      await createWalletSyncForName(adminRequest, fullName);
      await enableSlot1OnlyPreferences(
        adminRequest,
        userId,
        slot1Hour,
        slot1Minute
      );

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();
      expect(body.recipients?.some((item) => item.user_id === userId)).toBe(true);

      await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: true,
          hour: slot1Hour,
          minute: slot1Minute,
          slot2_enabled: true,
          hour2: slot2Hour,
          minute2: slot2Minute,
          exclude_weekends: false
        },
        userId
      );

      const offSlot2Response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(offSlot2Response.status()).toBe(200);
      const offBody = (await offSlot2Response.json()) as DispatchResponse;
      expect(offBody.message).toContain('이미 실행');
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-07: slot2 due — slot2 매칭', async ({ playwright }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const parts = getKstParts();
      const slot1Hour = (parts.hour + 1) % 24;
      const slot1Minute = (parts.minute + 15) % 60;

      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p55-ac07');
      await createWalletSyncForName(adminRequest, fullName);
      await enableSlot2DuePreferences(
        adminRequest,
        userId,
        { hour: slot1Hour, minute: slot1Minute },
        { hour: parts.hour, minute: parts.minute }
      );

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();
      expect(body.recipients?.some((item) => item.user_id === userId)).toBe(true);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-08: slot1=slot2 동일 시각 PATCH — 400 duplicate_schedule + activity log', async ({
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userId = await resolveE2EUserId(adminRequest);
      const uniqueName = `E2E-WBE-P55-AC08-${Date.now()}`;
      await adminRequest.put(`/api/users/${userId}`, {
        data: {
          full_name: uniqueName,
          affiliation: 'wake',
          rank: '경영진',
          phone: '01012345678'
        }
      });
      await createWalletSyncForName(adminRequest, uniqueName);

      const response = await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: true,
          hour: 12,
          minute: 15,
          slot2_enabled: true,
          hour2: 12,
          minute2: 15
        },
        userId
      );

      expect(response.status()).toBe(400);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      const body = (await response.json()) as { error_code?: string; message?: string };
      expect(body.error_code).toBe('duplicate_schedule');
      expect(body.message).toMatch(/알림 1과 알림 2는 같은 시각/);

      await expectActivityLog(
        adminRequest,
        'wallet.balance_email_pref_update',
        requestId,
        400
      );
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-11: exclude_weekends + slot2 — 주말 skipped, run·admin 알림 In', async ({
    playwright
  }) => {
    const parts = getKstParts();
    test.skip(
      parts.weekday !== 0 && parts.weekday !== 6,
      'AC-11 requires KST Saturday or Sunday'
    );
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const adminIds = await listActiveAdminUserIds(adminRequest);
      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p55-ac11');
      await createWalletSyncForName(adminRequest, fullName);

      await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: true,
          hour: parts.hour,
          minute: parts.minute,
          slot2_enabled: true,
          hour2: (parts.hour + 1) % 24,
          minute2: parts.minute,
          exclude_weekends: true
        },
        userId
      );

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeTruthy();
      expect(body.recipients?.find((item) => item.user_id === userId)?.status).toBe(
        'skipped'
      );

      await expect
        .poll(async () =>
          countBalanceEmailAdminNotifications(
            adminRequest,
            adminIds[0]!,
            body.run!.id
          )
        )
        .toBe(1);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-12: slot2 PATCH — activity log changed_fields allowlist', async ({
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userId = await resolveE2EUserId(adminRequest);
      const uniqueName = `E2E-WBE-P55-AC12-${Date.now()}`;
      await adminRequest.put(`/api/users/${userId}`, {
        data: {
          full_name: uniqueName,
          affiliation: 'wake',
          rank: '경영진',
          phone: '01012345678'
        }
      });
      await createWalletSyncForName(adminRequest, uniqueName);

      const response = await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          slot2_enabled: true,
          hour2: 18,
          minute2: 30
        },
        userId
      );
      expect(response.status()).toBe(200);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      await expectActivityLog(
        adminRequest,
        'wallet.balance_email_pref_update',
        requestId,
        200
      );

      const logs = await listActivityLogs(
        adminRequest,
        'wallet.balance_email_pref_update',
        { logUser: 'all' }
      );
      const log = logs.find((item) => item.request_id === requestId);
      const changedFields = log?.metadata?.changed_fields;
      expect(Array.isArray(changedFields)).toBe(true);
      expect(changedFields).toEqual(
        expect.arrayContaining(['slot2_enabled', 'hour2', 'minute2'])
      );

      const prefs = await getWalletBalanceEmailPreferences(adminRequest, userId);
      expect(prefs.slot2_enabled).toBe(true);
      expect(prefs.hour2).toBe(18);
      expect(prefs.minute2).toBe(30);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-13: admin fan-out — notification INSERT용 추가 activity action 없음', async ({
    playwright
  }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const beforeLogs = await listActivityLogs(
        adminRequest,
        'wallet.balance_email_admin',
        { logUser: 'all' }
      );
      expect(beforeLogs.length).toBe(0);

      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p55-ac13');
      await createWalletSyncForName(adminRequest, fullName);
      await enableDuePreferencesForUser(adminRequest, userId, getKstParts());

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);
      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      await expectActivityLog(
        adminRequest,
        'wallet.balance_email_dispatch',
        requestId,
        200,
        { logUser: 'all' }
      );

      const afterLogs = await listActivityLogs(
        adminRequest,
        'wallet.balance_email_admin',
        { logUser: 'all' }
      );
      expect(afterLogs.length).toBe(0);
    } finally {
      await adminRequest.dispose();
    }
  });
});
