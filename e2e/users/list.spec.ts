import { expect, test } from '@playwright/test';

test.describe('사용자 목록', () => {
  test('admin can view the users list', async ({ page }) => {
    await page.goto('/dashboard/users');

    await expect(page.getByRole('heading', { name: '사용자' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '이름' })).toBeVisible();
  });
});
