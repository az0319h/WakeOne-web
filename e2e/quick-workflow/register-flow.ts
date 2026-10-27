import type { Page } from '@playwright/test';

export { confirmPreviewAndRegister } from '../quick-request/helpers';

export async function writeClipboardSentinel(page: Page, value: string) {
  await page.evaluate((text) => navigator.clipboard.writeText(text), value);
}

export async function readClipboard(page: Page) {
  return page.evaluate(() => navigator.clipboard.readText());
}
