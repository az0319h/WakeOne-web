import { expect, test } from '@playwright/test';
import {
  countUnreadNotifications,
  createFreshPendingGoogleUser,
  filterApprovalRequestAdminNotifications,
  listNotificationsForUser,
  triggerFirstPendingApprovalAdminNotifications
} from '../helpers/google-pending-notifications';
import {
  notificationBellButton,
  openNotificationPopover
} from '../notifications/helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Google pending admin 인앱 알림 UI', () => {
  test('AC-05: 최초 pending 시 admin 벨 unread +1 · Popover 제목·body', async ({
    page,
    request
  }) => {
    const pending = await createFreshPendingGoogleUser('ac05-admin-ui');
    await triggerFirstPendingApprovalAdminNotifications(pending);

    await expect
      .poll(async () => {
        const notifications = await listNotificationsForUser(request);
        return filterApprovalRequestAdminNotifications(notifications, pending.userId).length;
      })
      .toBe(1);

    await page.goto('/dashboard/overview');
    const bellButton = notificationBellButton(page);
    await expect(bellButton.locator('span').filter({ hasText: /^\d/ })).toBeVisible({
      timeout: 15_000
    });

    await openNotificationPopover(page);
    await expect(
      page.getByRole('heading', { name: 'Google 가입 승인 요청', level: 3 }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(pending.email).first()).toBeVisible();
  });

  test('AC-06: Popover CTA 승인 대기 목록 → pending users', async ({ page }) => {
    const pending = await createFreshPendingGoogleUser('ac06-admin-cta');
    await triggerFirstPendingApprovalAdminNotifications(pending);

    await page.goto('/dashboard/overview');
    await openNotificationPopover(page);
    const targetCard = page
      .locator('[data-testid^="notification-card-"]')
      .filter({ hasText: pending.email })
      .first();
    await expect(targetCard).toBeVisible({ timeout: 15_000 });
    await targetCard.getByRole('button', { name: '승인 대기 목록' }).click();
    await expect(page).toHaveURL(/\/dashboard\/users\?status=pending_approval/);
    await expect(page.getByRole('row', { name: new RegExp(pending.email) })).toBeVisible({
      timeout: 15_000
    });
  });

  test('AC-07: pending 재로그인 시 admin unread count 변화 없음', async ({ request }) => {
    const pending = await createFreshPendingGoogleUser('ac07-no-dup');
    await triggerFirstPendingApprovalAdminNotifications(pending);

    const afterFirstCount = await expect
      .poll(async () => {
        const notifications = await listNotificationsForUser(request);
        return filterApprovalRequestAdminNotifications(notifications, pending.userId).length;
      })
      .toBe(1);

    void afterFirstCount;

    const second = await triggerFirstPendingApprovalAdminNotifications(pending, { request });
    expect(second.triggered).toBe(false);

    await expect
      .poll(async () => {
        const notifications = await listNotificationsForUser(request);
        return filterApprovalRequestAdminNotifications(notifications, pending.userId).length;
      })
      .toBe(1);
  });
});
