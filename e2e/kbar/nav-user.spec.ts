import { expect, test } from '@playwright/test';
import {
  fillKbarSearch,
  gotoDashboard,
  openKbar,
  submitKbarSelection,
  waitForKbarDebounce
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('KBar Phase A — user nav & RBAC', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page);
  });

  test('AC A-1: user navigates to wallet via kbar', async ({ page }) => {
    await openKbar(page);
    await fillKbarSearch(page, '식대');
    await waitForKbarDebounce(page);
    await submitKbarSelection(page);

    await expect(page).toHaveURL('/dashboard/wallet');
  });

  test('AC A-2: user does not see contracts nav action', async ({ page }) => {
    const urlBefore = page.url();

    await openKbar(page);
    await fillKbarSearch(page, '계약');
    await waitForKbarDebounce(page);
    await expect(page.getByTestId('kbar-result-item')).toHaveCount(0);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(urlBefore);
    expect(page.url()).not.toContain('/dashboard/contracts');
  });

  test('AC A-10: user does not see admin-only nav for unrelated keyword', async ({ page }) => {
    await openKbar(page);
    await fillKbarSearch(page, '롯데렌탈');
    await waitForKbarDebounce(page);

    await expect(page.getByTestId('kbar-result-item')).toHaveCount(0);
  });
});
