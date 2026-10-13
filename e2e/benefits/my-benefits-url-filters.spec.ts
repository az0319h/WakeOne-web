import { expect, test } from '@playwright/test';
import {
  currentKstMonthForE2e,
  effectiveMonthSearchParam,
  kstMonthLabel
} from '../helpers/kst-month';

test.use({ storageState: 'e2e/.auth/user.json' });

function searchParam(page: import('@playwright/test').Page, key: string) {
  return new URL(page.url()).searchParams.get(key);
}

test.describe('내 복지비 URL 필터', () => {
  test('AC-10: deep link month', async ({ page }) => {
    const current = currentKstMonthForE2e();
    await page.goto('/dashboard/my-benefits?month=2026-08');

    await expect(page.getByRole('heading', { name: '내 복지비 사용 현황' })).toBeVisible();
    await expect(page.getByText(kstMonthLabel(current))).toBeVisible();
    await expect
      .poll(() => effectiveMonthSearchParam(page, current), { timeout: 10_000 })
      .toBe(current);
  });

  test('AC-11·12: 다음 달·refresh·back', async ({ page }) => {
    const current = currentKstMonthForE2e();
    if (current <= '2026-10') {
      test.skip();
    }

    const [year, monthNumber] = current.split('-').map(Number);
    const prevDate = new Date(Date.UTC(year, monthNumber - 2, 1));
    const prevMonth = prevDate.toISOString().slice(0, 7);

    await page.goto(`/dashboard/my-benefits?month=${prevMonth}`);
    await expect(page.getByText(kstMonthLabel(prevMonth))).toBeVisible();

    await page.getByRole('button', { name: '다음 달' }).click();
    await expect(page.getByText(kstMonthLabel(current))).toBeVisible();
    await expect.poll(() => searchParam(page, 'month')).toBe(current);

    const urlAfterNext = page.url();
    await page.reload();
    await expect(page).toHaveURL(urlAfterNext);
    await expect(page.getByText(kstMonthLabel(current))).toBeVisible();

    await page.goBack();
    await expect.poll(() => searchParam(page, 'month')).toBe(prevMonth);
    await expect(page.getByText(kstMonthLabel(prevMonth))).toBeVisible();
  });

  test('AC-07: benefits_user URL은 무시된다', async ({ page, request }) => {
    const otherUuid = '00000000-0000-4000-8000-000000000099';
    const baseline = await request.get('/api/my-benefits?month=2026-10');
    const baselineBody = await baseline.json();

    await page.goto(`/dashboard/my-benefits?month=2026-10&benefits_user=${otherUuid}`);
    await expect(page.getByRole('heading', { name: '내 복지비 사용 현황' })).toBeVisible();
    await expect(page.getByTestId('wallet-user-combobox')).toHaveCount(0);

    await expect
      .poll(async () => {
        const response = await request.get('/api/my-benefits?month=2026-10');
        const body = await response.json();
        return body.data?.total_used;
      })
      .toBe(baselineBody.data?.total_used);
  });

  test('AC-13: invalid month 폴백', async ({ page }) => {
    await page.goto('/dashboard/my-benefits?month=invalid');
    await expect(page.getByRole('heading', { name: '내 복지비 사용 현황' })).toBeVisible();
    await expect(page.getByText(/^\d{4}년 \d{1,2}월$/)).toBeVisible();
    await expect.poll(() => effectiveMonthSearchParam(page)).toMatch(/^\d{4}-\d{2}$/);
  });
});
