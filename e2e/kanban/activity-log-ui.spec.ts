import { expect, test } from '@playwright/test';
import { createTasklist, deleteAllTasklists, gotoKanban, submitAddTaskDialog } from './helpers';

test.describe('칸반 activity log UI', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-29: task 생성 후 활동 로그에 Google Tasks 할 일 생성', async ({ page, request }) => {
    await deleteAllTasklists(request);
    await createTasklist(request, '로그열');
    await gotoKanban(page);
    const uniqueTitle = `로그검증-${Date.now()}`;
    await submitAddTaskDialog(page, { title: uniqueTitle });

    await page.goto('/dashboard/logs');
    await expect(page.getByTestId('activity-logs-page')).toBeVisible();
    await expect(page.getByText('Google Tasks 할 일 생성').first()).toBeVisible({ timeout: 20_000 });

    const expandButton = page
      .getByTestId('activity-log-row')
      .filter({ hasText: 'Google Tasks 할 일 생성' })
      .getByRole('button', { name: '행 펼치기' })
      .first();
    await expandButton.click();
    await expect(page.getByText('Method').first()).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: 'POST' }).first()).toBeVisible();
  });
});
