import { expect, test, type APIRequestContext } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  markAllNotificationsReadAsUser,
  resolveUserIdByEmail,
  updateUserFullName
} from '../notifications/helpers';

test.describe.configure({ mode: 'serial' });
test.use({ storageState: 'e2e/.auth/user.json' });

test.describe('알림 user.update 표시 정책', () => {
  const userEmail = process.env.E2E_USER_EMAIL!;
  let adminRequest: APIRequestContext;
  let userId: string;

  test.beforeAll(async ({ playwright }) => {
    adminRequest = await createAdminRequest(playwright);
    userId = await resolveUserIdByEmail(adminRequest, userEmail);
  });

  test.afterAll(async () => {
    await adminRequest.dispose();
  });

  test('AC-07: full_name 변경 후에도 알림 제목·본문 템플릿이 유지된다', async ({
    page,
    request
  }) => {
    await markAllNotificationsReadAsUser(request);
    const seedName = `E2E-P29-AC7-SEED-${Date.now()}`;
    const changedName = `E2E-P29-AC7-CHANGED-${Date.now()}`;

    await updateUserFullName(adminRequest, userId, seedName);
    await updateUserFullName(adminRequest, userId, changedName);

    await page.goto('/dashboard/notifications');
    await expect(page.getByTestId('notifications-page')).toBeVisible();

    const card = page.getByTestId(/^notification-card-/).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(
      card.getByRole('heading', {
        name: '프로필 정보가 변경되었습니다',
        level: 3
      })
    ).toBeVisible();
    await expect(card.getByText(/이름.*관리자에 의해 변경되었습니다/).first()).toBeVisible();
    await expect(card).not.toContainText(seedName);
    await expect(card).not.toContainText(changedName);
  });
});
