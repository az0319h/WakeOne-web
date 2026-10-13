import { expect, test } from '@playwright/test';
import {
  currentKstMonthForE2e,
  effectiveMonthSearchParam,
  kstMonthLabel
} from '../helpers/kst-month';

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
    const current = currentKstMonthForE2e();
    await page.goto('/dashboard/my-benefits?month=2026-08&benefits_user=self');
    await expect(page.getByText(kstMonthLabel(current))).toBeVisible();
    await expect
      .poll(() => effectiveMonthSearchParam(page, current), { timeout: 10_000 })
      .toBe(current);
  });

  test('AC-06: back navigation', async ({ page }) => {
    const current = currentKstMonthForE2e();
    if (current <= '2026-10') {
      test.skip();
    }
    const [year, monthNumber] = current.split('-').map(Number);
    const prevDate = new Date(Date.UTC(year, monthNumber - 2, 1));
    const prevMonth = prevDate.toISOString().slice(0, 7);

    await page.goto(`/dashboard/my-benefits?month=${prevMonth}&benefits_user=self`);
    await page.getByRole('button', { name: '다음 달' }).click();
    await expect.poll(() => searchParam(page, 'month')).toBe(current);
    await page.goBack();
    await expect.poll(() => searchParam(page, 'month')).toBe(prevMonth);
  });
});
