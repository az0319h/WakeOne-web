import { expect, test } from '@playwright/test';
import {
  createFreshPendingGoogleUser,
  triggerFirstPendingApprovalAdminNotifications
} from '../helpers/google-pending-notifications';

test.describe.configure({ mode: 'serial' });

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('Google 승인 요청 admin 알림 페이지', () => {
  test('AC-13: /dashboard/notifications 카드 CTA 승인 대기 목록', async ({ page }) => {
    const pending = await createFreshPendingGoogleUser('ac13-notif-page');
    await triggerFirstPendingApprovalAdminNotifications(pending);

    await page.goto('/dashboard/notifications');
    await expect(page.getByTestId('notifications-page')).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Google 가입 승인 요청', level: 3 }).first()
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '승인 대기 목록' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/users\?status=pending_approval/);
  });
});
