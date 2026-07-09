import { expect, test } from '@playwright/test';

test.describe('본인 프로필 이름 read-only', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-19-03: 이름은 read-only이고 입력 필드가 없다', async ({ page }) => {
    await page.goto('/dashboard/profile');

    await expect(page.getByText('이름', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '이름' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '성' })).toHaveCount(0);

    await page.getByRole('button', { name: '수정' }).click();
    const dialog = page.getByRole('dialog', { name: '계정 정보 수정' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: '이름' })).toHaveCount(0);
    await expect(dialog.getByRole('textbox', { name: '성' })).toHaveCount(0);
  });
});
