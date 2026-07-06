import { expect, test } from '@playwright/test';

test.describe('계약서 RBAC', () => {
  test('AC-02: user cannot access contracts page', async ({ page }) => {
    await page.goto('/dashboard/contracts');

    await expect(page).toHaveURL(/\/dashboard\/overview/);
    await expect(page.getByRole('heading', { name: '계약서 관리' })).not.toBeVisible();
  });
});
