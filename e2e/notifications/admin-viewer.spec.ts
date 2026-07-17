import { expect, test } from '@playwright/test';
import { resolveUserIdByEmail } from './helpers';

test.describe('알림 admin 뷰어', () => {
  test('AC-09: admin 기본 notif_user=self·본인 Combobox', async ({ page }) => {
    await page.goto('/dashboard/notifications');

    await expect(page.getByTestId('notifications-page')).toBeVisible();
    await expect(page.getByTestId('notif-user-combobox')).toContainText('본인');
    await expect(page).toHaveURL(/notif_user=self/, { timeout: 10_000 });
  });

  test('AC-10: admin Combobox에서 user B 선택 시 B 알림 표시', async ({
    page,
    request
  }) => {
    const user2Email = process.env.E2E_USER2_EMAIL;
    test.skip(!user2Email, 'E2E_USER2_EMAIL required');

    const userBId = await resolveUserIdByEmail(request, user2Email!);
    const usersResponse = await request.get(
      `/api/users?search=${encodeURIComponent(user2Email!)}&limit=5`
    );
    const usersBody = (await usersResponse.json()) as {
      users?: Array<{ id: string; email: string; full_name: string }>;
    };
    const userB = usersBody.users?.find((user) => user.email === user2Email);
    test.skip(!userB, 'E2E user2 not found');

    await page.goto('/dashboard/notifications');
    await page.getByTestId('notif-user-combobox').click();
    await page.getByPlaceholder('이름·이메일 검색…').fill(user2Email!);
    await page
      .getByRole('option', {
        name: new RegExp(userB!.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      })
      .first()
      .click();

    await expect(page).toHaveURL(new RegExp(`notif_user=${userBId}`));
    await expect(page.getByTestId('notif-user-combobox')).not.toContainText('본인');
    await expect(page.getByRole('button', { name: '모두 읽음' })).toHaveCount(0);
  });
});
