import { expect, test } from '@playwright/test';

test.describe('내 복지비', () => {
  test('일반 사용자는 본인 월별 사용 현황만 본다', async ({ page }) => {
    await page.goto('/dashboard/my-benefits');

    await expect(page.getByRole('heading', { name: '내 복지비 사용 현황' })).toBeVisible();
    await expect(page.getByRole('button', { name: '이전 달' })).toBeVisible();
    await expect(page.getByRole('button', { name: '다음 달' })).toBeVisible();
    await expect(page.getByText(/사용 \/ 100,000원/)).toBeVisible();
    await expect(page.getByText('도서 · 체력증진 · 외부교육 합산 월 100,000원 한도')).toBeVisible();
    await expect(page.getByRole('link', { name: '내 복지비' })).toBeVisible();
    await expect(page.getByRole('link', { name: '복지비 관리' })).toHaveCount(0);

    if (process.env.E2E_BENEFIT_INTEGRATION === '1') {
      await expect(page.getByText('120,000원 사용 / 100,000원')).toBeVisible();
      await expect(page.getByText('20,000원 초과')).toBeVisible();
      await expect(page.getByText('E2E 복지비 검증')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Flex에서 열기' })).toBeVisible();
    }
  });
});
