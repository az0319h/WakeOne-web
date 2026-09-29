import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  countBalanceEmailAdminNotifications,
  createDisposableUser,
  createWalletSyncForName,
  ensureE2EUserNotDue,
  getNonDueKstSchedule,
  listActiveAdminUserIds,
  listActivityLogs,
  patchWalletBalanceEmailPreferences,
  postWalletBalanceEmailDispatch
} from './helpers';

type DispatchResponse = {
  run?: { id: number } | null;
};

test.describe.configure({ mode: 'serial' });

test.describe('식대 잔액 이메일 due=0 dispatch', () => {
  test.setTimeout(120_000);

  test('AC-04: due=0 — run null, admin 알림 0건', async ({ playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      await ensureE2EUserNotDue(adminRequest);

      const adminIds = await listActiveAdminUserIds(adminRequest);
      const baselines = new Map<string, number>();
      for (const adminId of adminIds) {
        baselines.set(
          adminId,
          await countBalanceEmailAdminNotifications(adminRequest, adminId)
        );
      }

      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p55-ac04');
      await createWalletSyncForName(adminRequest, fullName);

      const nonDue = getNonDueKstSchedule();

      await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: true,
          hour: nonDue.hour,
          minute: nonDue.minute,
          exclude_weekends: false
        },
        userId
      );

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeNull();

      for (const adminId of adminIds) {
        const after = await countBalanceEmailAdminNotifications(adminRequest, adminId);
        expect(after).toBe(baselines.get(adminId));
      }

      await patchWalletBalanceEmailPreferences(
        adminRequest,
        { enabled: false, slot2_enabled: false },
        userId
      );
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-09 (plan 56) / AC-NEW-01: due=0 dispatch — run null, no dispatch activity log', async ({
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      await ensureE2EUserNotDue(adminRequest);

      const { userId, fullName } = await createDisposableUser(
        adminRequest,
        'wbe-new01'
      );
      await createWalletSyncForName(adminRequest, fullName);

      const nonDue = getNonDueKstSchedule();

      await patchWalletBalanceEmailPreferences(
        adminRequest,
        {
          enabled: true,
          hour: nonDue.hour,
          minute: nonDue.minute,
          exclude_weekends: false
        },
        userId
      );

      const response = await postWalletBalanceEmailDispatch(adminRequest);
      expect(response.status()).toBe(200);

      const requestId = response.headers()['x-request-id'];
      expect(requestId).toBeTruthy();

      const body = (await response.json()) as DispatchResponse;
      expect(body.run).toBeNull();

      const logs = await listActivityLogs(
        adminRequest,
        'wallet.balance_email_dispatch',
        { logUser: 'all' }
      );
      expect(
        logs.some(
          (item) =>
            item.request_id === requestId &&
            item.action === 'wallet.balance_email_dispatch'
        )
      ).toBe(false);
    } finally {
      await adminRequest.dispose();
    }
  });
});
