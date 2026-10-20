import { expect, test } from '@playwright/test';
import { createTasklist, gotoKanban } from './helpers';

test.describe('칸반 RBAC', () => {
  test('AC-25: admin이 타인 tasklist ID로 mutate 시 거부', async ({ playwright }) => {
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });

    try {
      const userList = await createTasklist(userRequest, '타인 목록');
      const response = await adminRequest.post(
        `/api/google-tasks/tasklists/${userList.id}/tasks`,
        { data: { title: '침범 시도' } }
      );
      expect([403, 404]).toContain(response.status());
      expect(response.headers()['x-request-id']).toBeTruthy();
    } finally {
      await userRequest.dispose();
      await adminRequest.dispose();
    }
  });

  test('AC-26: admin 칸반에 타인 task proxy UI 없음', async ({ page }) => {
    await gotoKanban(page);
    await expect(page.getByRole('combobox', { name: /다른 사용자|사용자 선택|tasks_user/i })).toHaveCount(
      0
    );
    await expect(page.getByText(/다른 사용자.*Tasks|Tasks proxy/i)).toHaveCount(0);
  });
});
