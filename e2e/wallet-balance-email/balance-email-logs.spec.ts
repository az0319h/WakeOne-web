import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  createDisposableUser,
  createWalletSyncForName,
  enableSlot2DuePreferences,
  expectDispatchSentRecipient,
  getKstParts,
  isDryRunEnabled,
  postWalletBalanceEmailDispatch
} from './helpers';

test.describe('plan 56 — 로그 UI 슬롯 표시', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('AC-07: slot2 dispatch run — recipient row shows 알림 2 badge', async ({
    page,
    playwright
  }) => {
    test.skip(!isDryRunEnabled(), 'E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1 required');

    const adminRequest = await createAdminRequest(playwright);

    try {
      const parts = getKstParts();
      const slot1Hour = (parts.hour + 1) % 24;
      const slot1Minute = (parts.minute + 15) % 60;
      const { userId, fullName } = await createDisposableUser(adminRequest, 'wbe-p56-ac07');
      await createWalletSyncForName(adminRequest, fullName);
      await enableSlot2DuePreferences(
        adminRequest,
        userId,
        { hour: slot1Hour, minute: slot1Minute },
        { hour: parts.hour, minute: parts.minute }
      );

      const dispatch = await postWalletBalanceEmailDispatch(adminRequest);
      expect(dispatch.status()).toBe(200);
      const dispatchBody = (await dispatch.json()) as {
        run?: { id: number } | null;
        recipients?: Array<{ status: string; user_id: string }>;
      };
      expect(dispatchBody.run).toBeTruthy();

      await expectDispatchSentRecipient(adminRequest, dispatchBody, userId);

      await page.goto('/dashboard/wallet/balance-email-logs');
      await expect(page.getByTestId('wallet-balance-email-logs-page')).toBeVisible();

      const runRow = page.locator(`[data-run-id="${dispatchBody.run!.id}"]`);
      await expect(runRow).toBeVisible({ timeout: 15_000 });
      await runRow.click();

      await expect(page.getByTestId('wallet-balance-email-log-detail-dialog')).toBeVisible();
      const recipientsTable = page.getByTestId('wallet-balance-email-log-recipients-table');
      await expect(recipientsTable).toBeVisible();

      const recipientRow = recipientsTable.getByRole('row').filter({ hasText: fullName }).first();
      await expect(recipientRow.getByText('알림 2')).toBeVisible();
    } finally {
      await adminRequest.dispose();
    }
  });
});

test.describe('잔액 확인 이메일 로그 UI', () => {
  test('AC-11: admin nav shows balance email logs under wallet', async ({ page }) => {
    await page.goto('/dashboard/wallet');

    const subLink = page.getByRole('link', { name: '잔액 확인 이메일 로그' });
    if (!(await subLink.isVisible())) {
      await page.locator('[data-sidebar="trigger"]').click();
    }

    await expect(subLink).toBeVisible();
  });

  test('AC-12: admin sees balance email logs page, table, and run detail dialog', async ({
    page
  }) => {
    const trigger = await postWalletBalanceEmailDispatch(page.request);
    expect([200, 401]).toContain(trigger.status());

    await page.goto('/dashboard/wallet/balance-email-logs');
    await expect(
      page.getByRole('heading', { name: '잔액 확인 이메일 로그' })
    ).toBeVisible();
    await expect(page.getByTestId('wallet-balance-email-logs-page')).toBeVisible();
    await expect(page.getByTestId('wallet-balance-email-logs-table')).toBeVisible();

    const firstRow = page.getByTestId('wallet-balance-email-log-row').first();
    const rowCount = await firstRow.count();
    test.skip(rowCount === 0, 'No wallet balance email runs available for dialog test');

    await firstRow.click();
    await expect(page.getByTestId('wallet-balance-email-log-detail-dialog')).toBeVisible();
    await expect(page.getByTestId('wallet-balance-email-log-recipients-table')).toBeVisible();
  });
});
