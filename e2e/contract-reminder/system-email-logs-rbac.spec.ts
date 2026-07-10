import { expect, test } from '@playwright/test';

test.describe('시스템 이메일 로그 RBAC', () => {
  test('AC-10: user cannot access system email logs page', async ({ page }) => {
    await page.goto('/dashboard/system-email-logs');

    await expect(page).toHaveURL(/\/dashboard\/overview/);
    await expect(page.getByRole('heading', { name: '시스템 이메일 로그' })).not.toBeVisible();
  });
});
