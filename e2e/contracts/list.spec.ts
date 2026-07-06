import { expect, test } from '@playwright/test';

test.describe('계약서 목록', () => {
  test('AC-01: admin can view contracts page with filters and table', async ({ page }) => {
    await page.goto('/dashboard/contracts');

    await expect(page.getByRole('heading', { name: '계약서 관리' })).toBeVisible();
    await expect(page.getByRole('button', { name: /날짜 범위/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '문서번호' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '문서 생성일' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '작성자' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '계약대상' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '계약 내용' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '금액' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '첨부파일 상태' })).toBeVisible();
    await expect(
      page.getByText('Flex 계약서 체결 요청은 OpenClaw/Gmail 수집을 통해 자동 생성됩니다.')
    ).toBeVisible();
  });
});
