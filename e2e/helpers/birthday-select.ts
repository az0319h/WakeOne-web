import type { Locator, Page } from '@playwright/test';

export function birthdaySelectTriggers(container: Locator) {
  const birthdayField = container.locator('fieldset').filter({ hasText: '생일' });
  const triggers = birthdayField.locator('[data-slot="select-trigger"]');
  return {
    year: triggers.nth(0),
    month: triggers.nth(1),
    day: triggers.nth(2)
  };
}

export async function selectBirthdayOption(
  page: Page,
  combobox: Locator,
  optionName: string
) {
  await combobox.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

export async function fillBirthday(
  page: Page,
  container: Locator,
  parts: { year: string; month: string; day: string }
) {
  const triggers = birthdaySelectTriggers(container);
  await selectBirthdayOption(page, triggers.year, parts.year);
  await selectBirthdayOption(page, triggers.month, parts.month);
  await selectBirthdayOption(page, triggers.day, parts.day);
}
