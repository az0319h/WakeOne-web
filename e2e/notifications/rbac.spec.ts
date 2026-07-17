import { expect, test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('알림 RBAC', () => {
  test('AC-11: 일반 user는 Combobox 없이 본인 알림만', async ({ page }) => {
    await page.goto('/dashboard/notifications');

    await expect(page.getByTestId('notifications-page')).toBeVisible();
    await expect(page.getByTestId('notif-user-combobox')).toHaveCount(0);
    await expect(page).not.toHaveURL(/notif_user=/);
  });
});
