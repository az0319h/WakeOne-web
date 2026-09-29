import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import { resolveUserIdByEmail, updateUserFullName } from '../notifications/helpers';
import {
  createWalletSyncForName,
  enableDuePreferencesForUser,
  getKstParts,
  listNotifications,
  postWalletBalanceEmailDispatch,
  resolveE2EUserId
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('식대 잔액 이메일 수신자 인앱 알림', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });
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

test.describe('식대 잔액 이메일 admin 인앱 알림', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('AC-05: admin 알림 CTA 발송 이력 보기 → balance-email-logs', async ({
    page,
    playwright
  }) => {
    test.skip(
      process.env.E2E_WALLET_BALANCE_EMAIL_DRY_RUN !== '1',
      'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required — AC-01 run 선행'
    );

    const adminRequest = await createAdminRequest(playwright);
    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    test.skip(!adminEmail, 'E2E_ADMIN_EMAIL required');

    try {
      const adminId = await resolveUserIdByEmail(adminRequest, adminEmail!);

      let notificationId: number | undefined;
      await expect
        .poll(async () => {
          const items = await listNotifications(adminRequest, adminId);
          const match = items.find((item) => item.type === 'wallet.balance_email_admin');
          notificationId = match?.id;
          return match != null;
        })
        .toBe(true);

      await page.goto('/dashboard/notifications');
      await expect(page.getByTestId('notifications-page')).toBeVisible();

      const card = page.getByTestId(`notification-card-${notificationId}`);
      await expect
        .poll(async () => {
          if (await card.isVisible()) {
            return true;
          }
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          return false;
        })
        .toBe(true);

      await expect(card.getByRole('heading', { level: 3 })).toHaveText(
        /식대 잔액 이메일/
      );
      await expect(card).toContainText(/대상 \d+명 · 발송 \d+/);

      const cta = card.getByRole('button', { name: '발송 이력 보기' });
      await expect(cta).toBeVisible();
      await cta.click();

      await expect(page).toHaveURL(/\/dashboard\/wallet\/balance-email-logs/);
    } finally {
      await adminRequest.dispose();
    }
  });
});
