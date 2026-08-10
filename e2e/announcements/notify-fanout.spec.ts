import { expect, test } from '@playwright/test';
import {
  createAnnouncementOrThrow,
  countUnreadNotifications,
  resetUserNotifications,
  uniqueAnnouncementTitle
} from './helpers';
import { openNotificationPopover } from '../notifications/helpers';

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe.configure({ mode: 'serial' });

test.describe('공지사항 notify fan-out (user B)', () => {
  test('AC-04: user B 벨 Popover에 announcement 알림 title·body·CTA가 표시된다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    await resetUserNotifications(userRequest);

    const title = uniqueAnnouncementTitle('bell');
    await createAnnouncementOrThrow(adminRequest, { title, body: '벨 알림 본문' });

    await expect
      .poll(async () => countUnreadNotifications(userRequest), { timeout: 20_000 })
      .toBeGreaterThan(0);

    await adminRequest.dispose();
    await userRequest.dispose();

    await page.goto('/dashboard/overview');
    await openNotificationPopover(page);

    await expect(
      page.getByRole('heading', { name: '새 공지가 등록되었습니다', level: 3 }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '공지 보기' }).first()).toBeVisible();
  });

  test('AC-05: CTA 공지 보기 클릭 시 announcements deep-link와 detail Dialog가 열린다', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    await resetUserNotifications(userRequest);

    const title = uniqueAnnouncementTitle('cta');
    const body = 'CTA deep-link 본문 전체';
    const announcement = await createAnnouncementOrThrow(adminRequest, { title, body });

    await expect
      .poll(async () => countUnreadNotifications(userRequest), { timeout: 20_000 })
      .toBeGreaterThan(0);

    await adminRequest.dispose();
    await userRequest.dispose();

    await page.goto('/dashboard/overview');
    await openNotificationPopover(page);
    await page.getByRole('button', { name: '공지 보기' }).first().click();

    await expect(page).toHaveURL(
      new RegExp(`/dashboard/announcements\\?announcement=${announcement.id}`)
    );
    await expect(page.getByTestId('announcement-detail-dialog')).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByTestId('announcement-detail-body')).toHaveText(body);
  });
});
