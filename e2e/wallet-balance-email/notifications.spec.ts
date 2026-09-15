import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import { updateUserFullName } from '../notifications/helpers';
import {
  createWalletSyncForName,
  enableDuePreferencesForUser,
  getKstParts,
  postWalletBalanceEmailDispatch,
  resolveE2EUserId
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('식대 잔액 이메일 인앱 알림', () => {
  test('AC-14: dispatch success shows wallet.balance_email notification without amount', async ({
    page,
    playwright
  }) => {
    test.skip(
      process.env.E2E_WALLET_BALANCE_EMAIL_DRY_RUN !== '1',
      'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required for safe dispatch'
    );

    const adminRequest = await createAdminRequest(playwright);

    try {
      const userId = await resolveE2EUserId(adminRequest);
      const uniqueName = `E2E-WBE-AC14-${Date.now()}`;
      await updateUserFullName(adminRequest, userId, uniqueName);
      await createWalletSyncForName(adminRequest, uniqueName);
      await enableDuePreferencesForUser(adminRequest, userId, getKstParts());

      const dispatch = await postWalletBalanceEmailDispatch(adminRequest);
      expect(dispatch.status()).toBe(200);
      const dispatchBody = (await dispatch.json()) as {
        run?: { id: number } | null;
        recipients?: Array<{ status: string; user_id: string }>;
      };

      let sent = dispatchBody.recipients?.find(
        (item) => item.user_id === userId && item.status === 'sent'
      );

      if (!sent && dispatchBody.run?.id) {
        const detailResponse = await adminRequest.get(
          `/api/wallet/balance-email/logs/${dispatchBody.run.id}`
        );
        expect(detailResponse.status()).toBe(200);
        const detailBody = (await detailResponse.json()) as {
          data?: { recipients?: Array<{ status: string; user_id: string }> };
        };
        sent = detailBody.data?.recipients?.find(
          (item) => item.user_id === userId && item.status === 'sent'
        );
      }

      expect(sent, 'Expected sent recipient for E2E user').toBeTruthy();

      await page.goto('/dashboard/notifications');
      await expect(page.getByTestId('notifications-page')).toBeVisible();

      const heading = page.getByRole('heading', {
        name: '식대 잔액 안내',
        level: 3
      });
      await expect(heading.first()).toBeVisible({ timeout: 15_000 });

      const card = page
        .getByTestId(/^notification-card-/)
        .filter({ has: heading })
        .first();
      await expect(card).toContainText('오늘의 식대 잔액 안내 메일을 확인해 주세요.');
      await expect(card).not.toContainText('원');
      await expect(card.getByRole('button', { name: '식대 카드 보기' })).toBeVisible();
    } finally {
      await adminRequest.dispose();
    }
  });
});
