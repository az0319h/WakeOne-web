import { expect, test } from '@playwright/test';
import {
  createUserViaApi,
  fetchNotifications,
  markAllNotificationsReadAsUser,
  openNotificationPopover,
  resolveUserIdByEmail,
  uniqueEmail,
  updateUserFullName
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('알림 user.update fan-out', () => {
  test('AC-01: admin이 이름 변경 시 대상 사용자 벨·Popover에 알림 표시', async ({
    request,
    browser,
    playwright
  }) => {
    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(request, userEmail);

    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    await markAllNotificationsReadAsUser(userRequest);

    const updatedName = `E2E알림AC01-${Date.now()}`;
    await updateUserFullName(request, userId, updatedName);

    const userContext = await browser.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    const userPage = await userContext.newPage();
    await userPage.goto('/dashboard/overview');

    await expect
      .poll(async () => {
        const response = await userRequest.get('/api/notifications?limit=10');
        const body = (await response.json()) as {
          data?: { notifications?: Array<{ status: string }> };
        };
        return (
          body.data?.notifications?.filter((item) => item.status === 'unread')
            .length ?? 0
        );
      })
      .toBeGreaterThan(0);

    await openNotificationPopover(userPage);
    await expect(
      userPage
        .getByRole('heading', {
          name: '프로필 정보가 변경되었습니다',
          level: 3
        })
        .first()
    ).toBeVisible();
    await expect(userPage.getByText(/이름.*관리자에 의해 변경되었습니다/).first()).toBeVisible();

    await userContext.close();
    await userRequest.dispose();
  });

  test('AC-02: 감시 필드 외 PUT 시 알림이 추가되지 않는다', async ({
    request
  }) => {
    const email = uniqueEmail('notif-ac02');
    const userId = await createUserViaApi(request, email, `AC02-${Date.now()}`);

    const beforeResponse = await fetchNotifications(
      request,
      `&notif_user=${encodeURIComponent(userId)}`
    );
    expect(beforeResponse.status()).toBe(200);
    const beforeBody = (await beforeResponse.json()) as {
      data?: { notifications?: unknown[] };
    };
    const beforeCount = beforeBody.data?.notifications?.length ?? 0;

    const phoneOnlyResponse = await request.put(`/api/users/${userId}`, {
      data: { phone: '010-1234-5678' }
    });
    expect(phoneOnlyResponse.status()).toBe(400);

    const afterResponse = await fetchNotifications(
      request,
      `&notif_user=${encodeURIComponent(userId)}`
    );
    expect(afterResponse.status()).toBe(200);
    const afterBody = (await afterResponse.json()) as {
      data?: { notifications?: unknown[] };
    };
    const afterCount = afterBody.data?.notifications?.length ?? 0;

    expect(afterCount).toBe(beforeCount);
  });

  test('AC-03: admin 본인 수정 시 신규 알림이 없다', async ({ request }) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL!;
    const adminId = await resolveUserIdByEmail(request, adminEmail);

    const beforeResponse = await fetchNotifications(request);
    expect(beforeResponse.status()).toBe(200);
    const beforeBody = (await beforeResponse.json()) as {
      data?: { notifications?: Array<{ status: string }> };
    };
    const beforeUnread =
      beforeBody.data?.notifications?.filter((item) => item.status === 'unread')
        .length ?? 0;

    const updatedName = `E2E관리자본인-${Date.now()}`;
    await updateUserFullName(request, adminId, updatedName);

    const afterResponse = await fetchNotifications(request);
    expect(afterResponse.status()).toBe(200);
    const afterBody = (await afterResponse.json()) as {
      data?: { notifications?: Array<{ status: string }> };
    };
    const afterUnread =
      afterBody.data?.notifications?.filter((item) => item.status === 'unread')
        .length ?? 0;

    expect(afterUnread).toBe(beforeUnread);
  });
});
