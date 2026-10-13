import { expect, test } from '@playwright/test';
import {
  currentKstMonthForE2e,
  effectiveMonthSearchParam,
  kstMonthLabel
} from '../helpers/kst-month';

function searchParam(page: import('@playwright/test').Page, key: string) {
  return new URL(page.url()).searchParams.get(key);
}

test.describe('복지비 조회 월 하한·폴백', () => {
  test('AC-01·02: 범위 밖 month는 KST 당월로 교정', async ({ page }) => {
    const current = currentKstMonthForE2e();

    await page.goto('/dashboard/benefits?month=2026-09');
    await expect(page.getByRole('heading', { name: '복지비 관리' })).toBeVisible();
    await expect
      .poll(() => effectiveMonthSearchParam(page, current), { timeout: 10_000 })
      .toBe(current);
    await expect(page.getByLabel('조회 월')).toHaveValue(current);

    await page.goto('/dashboard/benefits?month=2099-01');
    await expect
      .poll(() => effectiveMonthSearchParam(page, current), { timeout: 10_000 })
      .toBe(current);
    await expect(page.getByLabel('조회 월')).toHaveValue(current);
  });

  test('AC-03·04: 2026-10 선택·하한 유지', async ({ page }) => {
    const current = currentKstMonthForE2e();
    if (current < '2026-10') {
      test.skip();
    }

    await page.goto('/dashboard/benefits?month=2026-10');
    await expect(page.getByLabel('조회 월')).toHaveValue('2026-10');
    await expect.poll(() => effectiveMonthSearchParam(page, '2026-10')).toBe('2026-10');

    await page.getByLabel('조회 월').fill('2026-09');
    await expect
      .poll(() => effectiveMonthSearchParam(page, current), { timeout: 10_000 })
      .toBe(current);
  });
});

test.describe('내 복지비 조회 월', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-05·06: invalid·당월 다음 달 비활성', async ({ page }) => {
    const current = currentKstMonthForE2e();

    await page.goto('/dashboard/my-benefits?month=invalid');
    await expect(page.getByRole('heading', { name: '내 복지비 사용 현황' })).toBeVisible();
    await expect
      .poll(() => effectiveMonthSearchParam(page, current), { timeout: 10_000 })
      .toBe(current);
    await expect(page.getByText(kstMonthLabel(current)).first()).toBeVisible();

    await page.goto(`/dashboard/my-benefits?month=${current}`);
    await expect(page.getByRole('button', { name: '다음 달' })).toBeDisabled();
  });
});
