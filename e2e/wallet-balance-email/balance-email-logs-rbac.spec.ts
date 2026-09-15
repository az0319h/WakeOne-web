import { expect, test } from '@playwright/test';

test.describe('잔액 확인 이메일 로그 RBAC', () => {
  test('AC-13: user cannot access balance email logs page', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page).toHaveURL(/\/dashboard\/overview/);

    await page.goto('/dashboard/wallet/balance-email-logs');

    await expect(page).toHaveURL(/\/dashboard\/overview/);
    await expect(
      page.getByRole('heading', { name: '잔액 확인 이메일 로그' })
    ).not.toBeVisible();
  });
});
