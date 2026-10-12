import { expect, test } from '@playwright/test';

test.describe('복지비 관리', () => {
  test('관리자는 최종 시안의 필터와 월별 조직 표를 본다', async ({ page }) => {
    await page.goto('/dashboard/benefits');

    await expect(page.getByRole('heading', { name: '복지비 사용 현황' })).toBeVisible();
    await expect(page.getByRole('button', { name: '웨이크' })).toBeVisible();
    await expect(page.getByRole('button', { name: '산스', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '산스파운드리' })).toBeVisible();
    await expect(page.getByLabel('조회 월')).toBeVisible();
    await expect(page.getByPlaceholder('이름 검색')).toBeVisible();

    for (const column of ['구성원', '사용 현황', '도서', '체력증진', '외부교육', '상태']) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }

    await expect(page.getByText(/%/)).toHaveCount(0);
    await expect(page.getByRole('link', { name: '복지비 관리' })).toBeVisible();

    if (process.env.E2E_BENEFIT_INTEGRATION === '1') {
      const row = page.getByRole('row').filter({ hasText: '테스트 계정1' });
      await expect(row).toContainText('120,000원 / 100,000원');
      await expect(row).toContainText('한도 초과');
      await row.click();
      await expect(page.getByRole('link', { name: 'Flex에서 열기' })).toBeVisible();
    }
  });
});
