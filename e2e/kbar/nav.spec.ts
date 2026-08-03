import { expect, test } from '@playwright/test';
import {
  fillKbarSearch,
  gotoDashboard,
  kbarSearchAndSelect,
  openKbar,
  submitKbarSelection,
  waitForKbarDebounce
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('KBar Phase A — admin nav', () => {
  test.beforeEach(async ({ page }) => {
    await gotoDashboard(page);
  });

  test('AC A-3: admin navigates to contracts without search param', async ({ page }) => {
    await openKbar(page);
    await fillKbarSearch(page, '계약서 관리');
    await waitForKbarDebounce(page);
    await submitKbarSelection(page);

    await expect(page).toHaveURL('/dashboard/contracts');
    expect(page.url()).not.toContain('search=');
  });

  test('AC A-4: admin navigates to system email logs', async ({ page }) => {
    await kbarSearchAndSelect(page, '독촉 이메일 로그');
    await expect(page).toHaveURL('/dashboard/system-email-logs');
  });

  test('AC A-5: admin navigates to activity logs', async ({ page }) => {
    await kbarSearchAndSelect(page, '활동 로그');
    await expect(page).toHaveURL('/dashboard/logs');
  });

  test('AC A-6: admin navigates to notifications', async ({ page }) => {
    await kbarSearchAndSelect(page, '알림');
    await expect(page).toHaveURL('/dashboard/notifications');
  });

  test('AC A-7: admin navigates to profile', async ({ page }) => {
    await kbarSearchAndSelect(page, '프로필');
    await expect(page).toHaveURL('/dashboard/profile');
  });

  test('AC A-8: admin navigates to users management', async ({ page }) => {
    await kbarSearchAndSelect(page, '사용자 관리');
    await expect(page).toHaveURL('/dashboard/users');
  });

  test('AC A-9: theme toggle works without navigation', async ({ page }) => {
    const urlBefore = page.url();
    const themeBefore = await page.getByRole('combobox', { name: 'Theme' }).innerText();

    await openKbar(page);
    await fillKbarSearch(page, 'Switch Theme');
    await waitForKbarDebounce(page);
    await submitKbarSelection(page);

    await expect(page).toHaveURL(urlBefore);
    const themeAfter = await page.getByRole('combobox', { name: 'Theme' }).innerText();
    expect(themeAfter).not.toBe(themeBefore);
  });
});
