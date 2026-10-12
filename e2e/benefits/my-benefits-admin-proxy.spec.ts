import { expect, test } from '@playwright/test';

function searchParam(page: import('@playwright/test').Page, key: string) {
  return new URL(page.url()).searchParams.get(key);
}

test.describe('내 복지비 admin proxy', () => {
  test('AC-01·02: admin nav·combobox', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.getByRole('link', { name: '내 복지비' })).toBeVisible();

    await page.goto('/dashboard/my-benefits');
    await expect(page.getByRole('heading', { name: '내 복지비 사용 현황' })).toBeVisible();
    await expect(
      page.getByText('월별 10만원 예산과 신청 내역을 확인합니다.')
    ).toBeVisible();
    await expect(page.getByTestId('wallet-user-combobox')).toBeVisible();
  });

  test('AC-05: deep link month·benefits_user', async ({ page }) => {
    await page.goto('/dashboard/my-benefits?month=2026-08&benefits_user=self');
    await expect(page.getByText('2026년 8월')).toBeVisible();
    await expect.poll(() => searchParam(page, 'month')).toBe('2026-08');
  });

  test('AC-06: back navigation', async ({ page }) => {
    await page.goto('/dashboard/my-benefits?month=2026-08&benefits_user=self');
    await page.getByRole('button', { name: '다음 달' }).click();
    await expect.poll(() => searchParam(page, 'month')).toBe('2026-09');
    await page.goBack();
    await expect.poll(() => searchParam(page, 'month')).toBe('2026-08');
  });
});
