import { expect, test } from '@playwright/test';
import {
  createTask,
  createTasklist,
  deleteAllTasklists,
  fetchTasklists,
  gotoKanban
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('칸반 보드 (mock)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-10: mock 기본 목록 2열(업무·개인) 표시', async ({ page, request }) => {
    await deleteAllTasklists(request);
    await createTasklist(request, '업무');
    await createTasklist(request, '개인');
    await gotoKanban(page);
    const titles = page.getByTestId('kanban-column-title');
    await expect(titles).toHaveCount(2);
    await expect(titles.nth(0)).toHaveText('업무');
    await expect(titles.nth(1)).toHaveText('개인');
  });

  test('AC-11: 워크플로 열명(Backlog 등) 없음', async ({ page }) => {
    await gotoKanban(page);
    for (const label of ['Backlog', 'In Progress', 'Done', '백로그', '진행 중']) {
      await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
  });

  test('AC-12: tasklist 0개일 때 빈 보드 + 새 목록 CTA', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const remaining = await fetchTasklists(request);
    expect(remaining).toHaveLength(0);
    await gotoKanban(page);
    await expect(page.getByTestId('kanban-empty-board')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId('kanban-empty-board').getByTestId('kanban-new-tasklist-trigger')
    ).toBeVisible();
  });

  test('AC-13: 카드 title만 · priority/assignee 없음', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const list = await createTasklist(request, '단일');
    await createTask(request, list.id, { title: '미완료 할 일' });
    await gotoKanban(page);
    await expect(page.getByTestId('kanban-task-card').getByText('미완료 할 일')).toBeVisible();
    await expect(page.getByText('priority', { exact: false })).toHaveCount(0);
    await expect(page.getByText('assignee', { exact: false })).toHaveCount(0);
  });

  test('AC-14: due 날짜 yyyy-MM-dd 형식', async ({ page, request }) => {
    const list = await createTasklist(request, '마감');
    await createTask(request, list.id, { title: '마감일 테스트', due: '2026-10-18' });
    await gotoKanban(page);
    const card = page.getByTestId('kanban-task-card').filter({ hasText: '마감일 테스트' });
    await expect(card.getByText('2026-10-18')).toBeVisible();
    await expect(card.getByText(/\d{2}:\d{2}:\d{2}/)).toHaveCount(0);
  });
});
