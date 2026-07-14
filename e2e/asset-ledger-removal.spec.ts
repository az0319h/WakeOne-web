import { expect, test } from '@playwright/test';

const REMOVED_PRODUCT_PATH = '/dashboard/product';
const ASSET_API_PATH = '/api/asset-items';

test.describe('비품 대장 제거 검증', () => {
  test('AC-removal-01: /dashboard/product 접근 시 404', async ({ page }) => {
    const response = await page.goto(REMOVED_PRODUCT_PATH);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '비품 대장' })).toHaveCount(0);
  });

  test('AC-removal-02: GET /api/asset-items 는 404', async ({ request }) => {
    const response = await request.get(ASSET_API_PATH);
    expect(response.status()).toBe(404);
  });

  test('AC-removal-03: wake user 사이드바에 비품 대장 메뉴 없음', async ({
    browser
  }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    const page = await context.newPage();

    await page.goto('/dashboard/overview');
    await expect(page.getByRole('link', { name: '비품 대장' })).toHaveCount(0);

    await context.close();
  });

  test('AC-removal-08: 활동 로그 action 필터에 asset.* 옵션 없음', async ({ page }) => {
    await page.goto('/dashboard/logs');
    await expect(page.getByRole('heading', { name: '활동 로그' })).toBeVisible();

    await page.getByRole('toolbar').getByRole('button', { name: 'Action' }).click();
    await expect(page.getByRole('option', { name: 'asset.create' })).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'asset.update' })).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'asset.delete' })).toHaveCount(0);
  });
});
