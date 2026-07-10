import { expect, test } from '@playwright/test';

async function selectOption(page: import('@playwright/test').Page, combobox: import('@playwright/test').Locator, optionName: string) {
  await combobox.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

test.describe('비품 대장 사용처', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-10 plan21: 사용처 Select 선택 후 비품 등록에 성공한다', async ({ page }) => {
    const assetNumber = `E2E${Date.now().toString().slice(-6)}-001`;

    await page.goto('/dashboard/product');
    await expect(page.getByRole('heading', { name: '비품 대장' })).toBeVisible();

    await page.getByRole('button', { name: '비품 등록' }).click();
    const sheet = page.getByRole('dialog', { name: '비품 등록' });
    await expect(sheet).toBeVisible();

    await sheet.getByRole('textbox', { name: '자산명' }).fill('E2E 노트북(N)');
    await sheet.getByRole('textbox', { name: '자산번호' }).fill(assetNumber);
    await selectOption(page, sheet.getByRole('combobox', { name: '사용처' }), '콘텐츠팀');

    await sheet.getByRole('button', { name: '등록' }).click();
    await expect(page.getByText('비품이 등록되었습니다.')).toBeVisible();
    await expect(page.getByRole('cell', { name: assetNumber })).toBeVisible();
  });
});
