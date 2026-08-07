import { expect, test } from '@playwright/test';

const REMOVED_OFFICE_SNACKS_PATH = '/dashboard/office-snacks';
const REMOVED_OFFICE_SNACKS_DETAIL_PATH = '/dashboard/office-snacks/1';
const OFFICE_SNACKS_API_PATH = '/api/office-snacks/sessions';

test.describe('사무실 간식 제거 검증', () => {
  test('AC-removal-01: /dashboard/office-snacks 접근 시 404', async ({ page }) => {
    const response = await page.goto(REMOVED_OFFICE_SNACKS_PATH);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '사무실 간식' })).toHaveCount(0);
  });

  test('AC-removal-02: /dashboard/office-snacks/1 접근 시 404', async ({ page }) => {
    const response = await page.goto(REMOVED_OFFICE_SNACKS_DETAIL_PATH);
    expect(response?.status()).toBe(404);
  });

  test('AC-removal-03: GET /api/office-snacks/sessions 는 404', async ({ request }) => {
    const response = await request.get(OFFICE_SNACKS_API_PATH);
    expect(response.status()).toBe(404);
  });

  test('AC-removal-04: POST /api/office-snacks/sessions 는 404', async ({ request }) => {
    const response = await request.post(OFFICE_SNACKS_API_PATH, {
      data: { title: 'test' }
    });
    expect(response.status()).toBe(404);
  });

  test('AC-removal-05: 사이드바에 사무실 간식 메뉴 없음', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.getByRole('link', { name: '사무실 간식' })).toHaveCount(0);
  });

  test('AC-removal-11: 활동 로그 action 필터에 office_snack.* 옵션 없음', async ({ page }) => {
    await page.goto('/dashboard/logs');
    await expect(page.getByTestId('activity-logs-page')).toBeVisible();

    await page.getByRole('button', { name: '활동 유형' }).click();
    await expect(page.getByRole('option', { name: '간식 투표 세션 생성' })).toHaveCount(0);
    await expect(page.getByRole('option', { name: '간식 투표 제출' })).toHaveCount(0);
  });
});
