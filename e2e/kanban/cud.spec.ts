import { expect, test } from '@playwright/test';
import {
  createTask,
  createTasklist,
  deleteAllTasklists,
  fetchTasklists,
  gotoKanban,
  submitAddTaskDialog,
  submitNewTasklistDialog
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('칸반 CUD · DnD · 완료', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-15: + 새 목록으로 열 추가', async ({ page, request }) => {
    await deleteAllTasklists(request);
    await gotoKanban(page);
    await submitNewTasklistDialog(page, 'E2E 신규 목록');
    await expect(page.getByTestId('kanban-column-title').filter({ hasText: 'E2E 신규 목록' })).toBeVisible();
    const lists = await fetchTasklists(request);
    expect(lists.some((item) => item.title === 'E2E 신규 목록')).toBe(true);
  });

  test('AC-16: 할 일 추가 Dialog', async ({ page, request }) => {
    await deleteAllTasklists(request);
    await createTasklist(request, '열 A');
    await gotoKanban(page);
    await submitAddTaskDialog(page, { title: 'Dialog 할 일', notes: '설명 텍스트' });
    await expect(page.getByTestId('kanban-task-card').getByText('Dialog 할 일')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('kanban-task-card').getByText('Dialog 할 일')).toBeVisible();
  });

  test('AC-17: 체크 완료 → 완료됨 섹션', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const list = await createTasklist(request, '완료열');
    await createTask(request, list.id, { title: '완료 대상' });
    await gotoKanban(page);
    const completeResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/google-tasks/tasks/') &&
        response.url().includes('/complete') &&
        response.request().method() === 'POST'
    );
    await page
      .getByTestId('kanban-task-card')
      .filter({ hasText: '완료 대상' })
      .getByTestId('kanban-task-complete-checkbox')
      .click();
    await completeResponse;
    await expect(page.getByTestId('kanban-completed-section-trigger')).toContainText('완료됨 (1개)', {
      timeout: 15_000
    });
    await expect(page.getByTestId('kanban-task-card').filter({ hasText: '완료 대상' })).toHaveCount(0);
    await page.getByTestId('kanban-completed-section-trigger').click();
    await expect(page.getByTestId('kanban-completed-task-card').getByText('완료 대상')).toBeVisible();
  });

  test('AC-18: 완료 시각 절대 포맷', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const list = await createTasklist(request, '시각열');
    await createTask(request, list.id, { title: '완료 시각' });
    await gotoKanban(page);
    await page
      .getByTestId('kanban-task-card')
      .filter({ hasText: '완료 시각' })
      .getByTestId('kanban-task-complete-checkbox')
      .click();
    await page.getByTestId('kanban-completed-section-trigger').click();
    await expect(
      page.getByTestId('kanban-completed-task-card').getByText(/\d{4}-\d{2}-\d{2} \(.\) \d{2}:\d{2}:\d{2}/)
    ).toBeVisible();
  });

  test('AC-19: 열 간 task DnD 이동', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const listA = await createTasklist(request, 'DnD A');
    const listB = await createTasklist(request, 'DnD B');
    await createTask(request, listA.id, { title: '이동할 카드' });
    await gotoKanban(page);
    const cardHandle = page
      .getByTestId('kanban-task-card')
      .filter({ hasText: '이동할 카드' })
      .getByRole('button', { name: '이동할 카드 카드 이동' });
    const dropTarget = page.getByTestId('kanban-add-task-trigger').nth(1);
    const moveResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/google-tasks/tasks/move') &&
        response.request().method() === 'POST' &&
        response.status() === 200
    );
    await cardHandle.dragTo(dropTarget);
    await moveResponse;
    await expect
      .poll(async () => {
        const tasksResponse = await request.get(
          `/api/google-tasks/tasklists/${listB.id}/tasks?showCompleted=true`
        );
        const tasksBody = (await tasksResponse.json()) as { tasks?: Array<{ title: string }> };
        return tasksBody.tasks?.some((task) => task.title === '이동할 카드') ?? false;
      })
      .toBe(true);
  });

  test('AC-20: 같은 열 내 reorder DnD', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const list = await createTasklist(request, 'Reorder');
    await createTask(request, list.id, { title: '첫 번째' });
    await createTask(request, list.id, { title: '두 번째' });
    await gotoKanban(page);
    const first = page
      .getByTestId('kanban-task-card')
      .filter({ hasText: '첫 번째' })
      .getByRole('button', { name: '첫 번째 카드 이동' });
    const second = page
      .getByTestId('kanban-task-card')
      .filter({ hasText: '두 번째' })
      .getByRole('button', { name: '두 번째 카드 이동' });
    await second.dragTo(first, { targetPosition: { x: 10, y: 5 } });
    const cards = page.getByTestId('kanban-task-card');
    await expect(cards.nth(0)).toContainText('두 번째');
    await expect(cards.nth(1)).toContainText('첫 번째');
  });

  test('AC-21: 완료 항목 삭제 AlertModal · 확인 전 API 미호출', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const list = await createTasklist(request, 'Clear');
    await createTask(request, list.id, { title: '삭제될 완료' });
    await gotoKanban(page);
    await page
      .getByTestId('kanban-task-card')
      .filter({ hasText: '삭제될 완료' })
      .getByTestId('kanban-task-complete-checkbox')
      .click();

    let clearCalls = 0;
    await page.route('**/api/google-tasks/tasklists/*/clear-completed', async (route) => {
      clearCalls += 1;
      await route.continue();
    });

    await page.getByTestId('kanban-column-menu-trigger').first().click();
    await page.getByTestId('kanban-clear-completed-menu-item').click();
    const dialog = page.getByRole('dialog', { name: '완료 항목 삭제' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/완료된 할 일을 모두 삭제/)).toBeVisible();
    expect(clearCalls).toBe(0);
    await dialog.getByRole('button', { name: '취소' }).click();
    expect(clearCalls).toBe(0);
  });

  test('AC-22: 완료 항목 삭제 확인 후 비움', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const list = await createTasklist(request, 'ClearOk');
    await createTask(request, list.id, { title: '지울 완료' });
    await gotoKanban(page);
    await page
      .getByTestId('kanban-task-card')
      .filter({ hasText: '지울 완료' })
      .getByTestId('kanban-task-complete-checkbox')
      .click();
    await page.getByTestId('kanban-column-menu-trigger').first().click();
    await page.getByTestId('kanban-clear-completed-menu-item').click();
    const dialog = page.getByRole('dialog', { name: '완료 항목 삭제' });
    await dialog.getByRole('button', { name: '삭제' }).click();
    await expect(page.getByText('완료된 할 일을 삭제했습니다.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('kanban-completed-section-trigger')).toContainText('완료됨 (0개)');
  });

  test('AC-23: tasklist 삭제 AlertModal', async ({ page, request }) => {
    await deleteAllTasklists(request);
    await createTasklist(request, '삭제 목록');
    await gotoKanban(page);
    await page.getByTestId('kanban-column-menu-trigger').first().click();
    await page.getByTestId('kanban-delete-tasklist-menu-item').click();
    const dialog = page.getByRole('dialog', { name: '목록 삭제' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '삭제' }).click();
    await expect(page.getByText('목록을 삭제했습니다.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('kanban-empty-board')).toBeVisible();
  });

  test('AC-24: subtask API 데이터 read-only UI 표시', async ({ page, request }) => {
    await deleteAllTasklists(request);
    const list = await createTasklist(request, 'Sub');
    const parent = await createTask(request, list.id, { title: '부모 할 일' });
    await createTask(request, list.id, { title: '하위 항목', parent: parent.id });
    await gotoKanban(page);
    await expect(page.getByTestId('kanban-subtask-row').getByText('하위 항목')).toBeVisible();
    await expect(page.getByTestId('kanban-add-subtask-trigger')).toHaveCount(0);
  });
});
