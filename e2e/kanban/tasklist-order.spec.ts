import { expect, test } from '@playwright/test';
import { createTasklist, deleteAllTasklists, gotoKanban } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('칸반 목록 순서 (localStorage)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('저장된 tasklist 순서가 새로고침 후 유지된다', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const listA = await createTasklist(request, '첫번째');
    const listB = await createTasklist(request, '두번째');
    await gotoKanban(page);

    await page.evaluate(
      ({ key, order }) => {
        localStorage.setItem(key, JSON.stringify(order));
      },
      { key: 'wakeone-kanban-tasklist-order', order: [listB.id, listA.id] }
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '칸반' })).toBeVisible({ timeout: 30_000 });
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/google-tasks/tasklists') &&
        response.request().method() === 'GET' &&
        response.status() === 200
    );

    const titles = page.getByTestId('kanban-column-title');
    await expect(titles).toHaveCount(2);
    await expect(titles.nth(0)).toHaveText('두번째');
    await expect(titles.nth(1)).toHaveText('첫번째');
  });
});
