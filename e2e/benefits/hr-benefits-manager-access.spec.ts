import { expect, test } from '@playwright/test';

test.describe('웨이크 인사팀 복지비 관리', () => {
  test.use({ storageState: 'e2e/.auth/hr-benefits.json' });

  test('AC-01·AC-02: HR nav와 복지비 관리 페이지', async ({ page }) => {
    await page.goto('/dashboard/overview');

    await expect(page.getByRole('link', { name: '복지비 관리' })).toBeVisible();
    await expect(page.getByText('Admin (관리)')).toHaveCount(0);
    await expect(page.getByText('HR (인사)')).toBeVisible();

    await page.getByRole('link', { name: '복지비 관리' }).click();
    await expect(page).toHaveURL(/\/dashboard\/benefits/);
    await expect(page.getByRole('heading', { name: '복지비 관리' })).toBeVisible();
    await expect(page.getByLabel('조회 월')).toBeVisible();
  });

  test('AC-04: 사용자 관리 접근 거부', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page).toHaveURL(/\/dashboard\/overview/);
  });

  test('AC-08: 내 복지비 combobox 없음', async ({ page }) => {
    await page.goto('/dashboard/my-benefits');
    await expect(page.getByRole('heading', { name: '내 복지비 사용 현황' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '사용자 선택' })).toHaveCount(0);
  });
});

test.describe('웨이크 인사팀 복지비 관리 — admin 회귀', () => {
  test('AC-05: admin은 HR 그룹 없음', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.getByText('HR (인사)')).toHaveCount(0);
    await expect(page.getByText('Admin (관리)')).toBeVisible();
    await expect(page.getByRole('link', { name: '복지비 관리' })).toBeVisible();
  });
});

test.describe('웨이크 인사팀 복지비 관리 — 일반 user', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-07: 비인사팀은 복지비 관리 없음', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.getByRole('link', { name: '복지비 관리' })).toHaveCount(0);

    await page.goto('/dashboard/benefits');
    await expect(page).toHaveURL(/\/dashboard\/overview/);
  });
});
