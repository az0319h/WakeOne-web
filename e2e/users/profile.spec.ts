import { expect, test } from '@playwright/test';

test.describe('본인 프로필 read-only', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-19-03: 이름은 read-only이고 입력 필드가 없다', async ({ page }) => {
    await page.goto('/dashboard/profile');

    await expect(page.getByText('이름', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '이름' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '성' })).toHaveCount(0);
  });

  test('AC-4 plan21: Account 수정 버튼이 없다', async ({ page }) => {
    await page.goto('/dashboard/profile');

    await expect(page.getByRole('button', { name: '수정' })).toHaveCount(0);
    await expect(page.getByText('못 먹는 음식')).toHaveCount(0);
  });

  test('AC-5 plan21: Security 비밀번호 변경·로그아웃은 유지된다', async ({ page }) => {
    await page.goto('/dashboard/profile');

    await expect(page.getByRole('button', { name: '비밀번호 변경' })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
  });
});
