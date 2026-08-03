import { expect, type Page } from '@playwright/test';

export function kbarSearchInput(page: Page) {
  return page.getByRole('combobox', { name: /Type a command or search/i });
}

export async function openKbar(page: Page) {
  const searchButton = page.getByRole('button', { name: /Search/i });
  if (await searchButton.isVisible()) {
    await searchButton.click();
  } else {
    await page.keyboard.press('Control+K');
  }
  await expect(kbarSearchInput(page)).toBeVisible({ timeout: 10_000 });
}

export async function fillKbarSearch(page: Page, query: string) {
  const input = kbarSearchInput(page);
  await input.click();
  await input.evaluate((el, value) => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    valueSetter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, query);
}

export async function waitForKbarDebounce(page: Page) {
  await page.waitForTimeout(300);
}

export async function waitForKbarActiveResult(page: Page) {
  await waitForKbarDebounce(page);
  await expect(page.getByTestId('kbar-result-item').first()).toBeVisible({
    timeout: 10_000
  });
}

export async function submitKbarSelection(page: Page) {
  await waitForKbarActiveResult(page);
  await page.getByTestId('kbar-result-item').first().click();
}

export async function kbarSearchAndSelect(page: Page, query: string) {
  await openKbar(page);
  await fillKbarSearch(page, query);
  await submitKbarSelection(page);
}

export async function gotoDashboard(page: Page) {
  await page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard\//, { timeout: 30_000 });
  const searchButton = page.getByRole('button', { name: /Search/i });
  if (!(await searchButton.isVisible())) {
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  await expect(searchButton).toBeVisible({ timeout: 30_000 });
}
