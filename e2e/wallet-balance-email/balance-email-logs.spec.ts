import { expect, test } from '@playwright/test';
import { postWalletBalanceEmailDispatch } from './helpers';

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
