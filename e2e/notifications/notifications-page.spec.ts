import { expect, test } from '@playwright/test';
import {
  countNotificationCards,
  markAllNotificationsReadAsUser,
  notificationBellButton,
  openNotificationPopover,
  resolveUserIdByEmail,
  seedUserUpdateNotifications,
  updateUserFullName
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('알림 페이지 (user)', () => {
  test('AC-04: 알림 페이지에 한국어 탭·CTA·프로필 이동', async ({
    page,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await updateUserFullName(adminRequest, userId, `E2E알림AC04-${Date.now()}`);
    await adminRequest.dispose();

    await page.goto('/dashboard/notifications');
    await expect(page.getByTestId('notifications-page')).toBeVisible();
    await expect(page.getByRole('tab', { name: /전체/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /읽지 않음/ })).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: '프로필 정보가 변경되었습니다',
        level: 3
      }).first()
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '프로필 보기' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/profile/);
  });

  test('AC-05: 알림 읽음 처리 시 벨 unread count 감소', async ({
    page,
    request,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await markAllNotificationsReadAsUser(request);
    await updateUserFullName(adminRequest, userId, `E2E알림AC05-${Date.now()}`);
    await adminRequest.dispose();

    await expect
      .poll(async () => {
        const response = await request.get('/api/notifications?limit=10');
        const body = (await response.json()) as {
          data?: { notifications?: Array<{ status: string }> };
        };
        return (
          body.data?.notifications?.filter((item) => item.status === 'unread')
            .length ?? 0
        );
      })
      .toBeGreaterThan(0);

    await page.goto('/dashboard/overview');
    const bellButton = notificationBellButton(page);
    await expect(bellButton.locator('span').filter({ hasText: /^\d/ })).toBeVisible({
      timeout: 15_000
    });

    await page.goto('/dashboard/notifications');
    const unreadCard = page
      .getByRole('heading', { name: '프로필 정보가 변경되었습니다', level: 3 })
      .first();
    await expect(unreadCard).toBeVisible();
    await page.getByRole('button', { name: '읽음 처리' }).first().click();

    await expect
      .poll(async () => {
        const response = await request.get('/api/notifications?limit=10');
        const body = (await response.json()) as {
          data?: { notifications?: Array<{ status: string }> };
        };
        return (
          body.data?.notifications?.filter((item) => item.status === 'unread')
            .length ?? 0
        );
      })
      .toBe(0);
  });

  test('AC-06: 모두 읽음 클릭 시 전부 읽음·벨 badge 0', async ({
    page,
    request,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await markAllNotificationsReadAsUser(request);
    await updateUserFullName(adminRequest, userId, `E2E알림AC06a-${Date.now()}`);
    await updateUserFullName(adminRequest, userId, `E2E알림AC06b-${Date.now()}`);
    await adminRequest.dispose();

    await page.goto('/dashboard/notifications');
    await expect(page.getByRole('button', { name: '모두 읽음' })).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole('button', { name: '모두 읽음' }).click();

    await expect
      .poll(async () => {
        const response = await request.get('/api/notifications?limit=50');
        const body = (await response.json()) as {
          data?: { notifications?: Array<{ status: string }> };
        };
        return (
          body.data?.notifications?.filter((item) => item.status === 'unread')
            .length ?? 0
        );
      })
      .toBe(0);

    await page.goto('/dashboard/overview');
    const bellButton = notificationBellButton(page);
    await expect
      .poll(async () => bellButton.locator('span').filter({ hasText: /^\d/ }).count())
      .toBe(0);
  });

  test('AC-07: 알림 페이지 infinite scroll 10건씩 로드·중복 없음', async ({
    page,
    request,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await markAllNotificationsReadAsUser(request);
    await seedUserUpdateNotifications(adminRequest, userId, 15);
    await adminRequest.dispose();

    await page.goto('/dashboard/notifications');
    const cards = countNotificationCards(page);
    await expect(cards).toHaveCount(10, { timeout: 15_000 });

    const initialCount = await cards.count();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(async () => cards.count(), { timeout: 15_000 })
      .toBeGreaterThan(initialCount);

    const cardTestIds = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-testid'))
    );
    expect(new Set(cardTestIds).size).toBe(cardTestIds.length);
  });

  test('AC-08: Popover infinite scroll·알림 링크', async ({
    page,
    request,
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(adminRequest, userEmail);
    await markAllNotificationsReadAsUser(request);
    await seedUserUpdateNotifications(adminRequest, userId, 15);
    await adminRequest.dispose();

    await page.goto('/dashboard/overview');
    await openNotificationPopover(page);

    const cards = countNotificationCards(page);
    await expect(cards).toHaveCount(10, { timeout: 15_000 });

    const initialCount = await cards.count();
    await cards.last().scrollIntoViewIfNeeded();
    await expect
      .poll(async () => cards.count(), { timeout: 15_000 })
      .toBeGreaterThan(initialCount);
    await page.getByTestId('notification-popover-all-link').click();
    await expect(page).toHaveURL(/\/dashboard\/notifications/);
  });
});
