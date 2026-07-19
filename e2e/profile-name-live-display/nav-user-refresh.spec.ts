import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  resolveUserIdByEmail,
  updateUserAvatar,
  updateUserFullName
} from './helpers';

test.describe.configure({ mode: 'serial' });
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('NavUser Realtime 갱신', () => {
  const userEmail = process.env.E2E_USER_EMAIL!;

  test('AC-05: admin이 full_name 변경 시 NavUser 표시 이름이 갱신된다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    const updatedName = `E2E-P29-AC5-${Date.now()}`;

    await page.goto('/dashboard/overview');
    await expect(page.getByTestId('nav-user-display-name')).toBeAttached();
    await page.waitForTimeout(2_000);

    await updateUserFullName(adminRequest, userId, updatedName);

    await expect
      .poll(
        async () =>
          page.getByTestId('nav-user-display-name').evaluate((node) => node.textContent?.trim()),
        { timeout: 5_000 }
      )
      .toBe(updatedName);

    await adminRequest.dispose();
  });

  test('AC-06: admin이 avatar만 변경 시 NavUser 아바타가 갱신된다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    const avatarUrl = `${baseURL}/vercel.svg?e2e-p29-ac6=${Date.now()}`;

    await page.goto('/dashboard/overview');
    await expect(page.getByTestId('nav-user-display-name')).toBeAttached();
    await page.waitForTimeout(2_000);

    const displayName = await page
      .getByTestId('nav-user-display-name')
      .evaluate((node) => node.textContent?.trim() ?? '');
    expect(displayName).toBeTruthy();

    await updateUserAvatar(adminRequest, userId, avatarUrl);

    await expect
      .poll(
        async () => page.getByRole('img', { name: displayName }).getAttribute('src'),
        { timeout: 10_000 }
      )
      .toContain('vercel.svg');

    await adminRequest.dispose();
  });
});
