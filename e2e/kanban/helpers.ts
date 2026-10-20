import { expect, type APIRequestContext, type Page } from '@playwright/test';

export type GoogleTaskList = { id: string; title: string; isDefault?: boolean };
export type GoogleTask = {
  id: string;
  title: string;
  status?: string;
  due?: string;
  completed?: string;
};

export async function fetchTasklists(request: APIRequestContext): Promise<GoogleTaskList[]> {
  const response = await request.get('/api/google-tasks/tasklists');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { tasklists?: GoogleTaskList[] };
  return body.tasklists ?? [];
}

export async function deleteAllTasklists(request: APIRequestContext) {
  const tasklists = await fetchTasklists(request);
  for (const tasklist of tasklists) {
    const response = await request.delete(`/api/google-tasks/tasklists/${tasklist.id}`);
    expect(response.status()).toBe(200);
  }
}

export async function createTasklist(
  request: APIRequestContext,
  title: string
): Promise<GoogleTaskList> {
  const response = await request.post('/api/google-tasks/tasklists', {
    data: { title }
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { tasklist?: GoogleTaskList };
  expect(body.tasklist?.id).toBeTruthy();
  return body.tasklist!;
}

export async function createTask(
  request: APIRequestContext,
  tasklistId: string,
  input: { title: string; notes?: string; due?: string; parent?: string }
): Promise<GoogleTask> {
  const response = await request.post(`/api/google-tasks/tasklists/${tasklistId}/tasks`, {
    data: input
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { task?: GoogleTask };
  expect(body.task?.id).toBeTruthy();
  return body.task!;
}

export async function gotoKanban(page: Page) {
  await page.goto('/dashboard/kanban', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '칸반' })).toBeVisible({ timeout: 30_000 });
  await page.waitForResponse(
    (response) =>
      response.url().includes('/api/google-tasks/tasklists') &&
      response.request().method() === 'GET' &&
      response.status() === 200
  );
}

export async function openKanbanFromSidebar(page: Page) {
  await page.goto('/dashboard/overview', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: '칸반' }).click();
  await expect(page).toHaveURL('/dashboard/kanban');
}

export async function deleteNonDefaultTasklists(request: APIRequestContext) {
  const tasklists = await fetchTasklists(request);
  for (const tasklist of tasklists) {
    if (tasklist.isDefault) {
      continue;
    }
    const response = await request.delete(`/api/google-tasks/tasklists/${tasklist.id}`);
    expect(response.status()).toBe(200);
  }
}

export async function openRenameTasklistDialog(page: Page, currentTitle: string) {
  await page.getByRole('button', { name: `${currentTitle} 목록 메뉴` }).click();
  await page.getByTestId('kanban-rename-tasklist-menu-item').click();
  const dialog = page.getByRole('dialog', { name: '이름 바꾸기' });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function submitRenameTasklistDialog(page: Page, currentTitle: string, nextTitle: string) {
  const dialog = await openRenameTasklistDialog(page, currentTitle);
  await dialog.getByPlaceholder('예: 업무').fill(nextTitle);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('목록 이름을 변경했습니다.')).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toBeHidden();
}

export async function submitNewTasklistDialog(page: Page, title: string) {
  await page.getByTestId('kanban-new-tasklist-trigger').first().click();
  const dialog = page.getByRole('dialog', { name: '새 목록' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('예: 업무').fill(title);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('새 목록이 추가되었습니다.')).toBeVisible({ timeout: 15_000 });
}

export function kanbanColumnLocator(page: Page, columnTitle: string) {
  return page
    .locator('[data-kanban-tasklist-id]')
    .filter({
      has: page.getByTestId('kanban-column-title').getByText(columnTitle, { exact: true })
    })
    .first();
}

export async function getActiveTaskTitlesInColumn(page: Page, columnTitle: string) {
  const column = kanbanColumnLocator(page, columnTitle);
  const cards = column.getByTestId('kanban-task-card');
  const count = await cards.count();
  const titles: string[] = [];
  for (let i = 0; i < count; i++) {
    const titleLine = (await cards.nth(i).getByTestId('kanban-task-edit-trigger').innerText()).trim();
    titles.push(titleLine);
  }
  return titles;
}

export function taskDragHandle(page: Page, taskTitle: string) {
  return page
    .getByTestId('kanban-task-card')
    .filter({ hasText: taskTitle })
    .getByRole('button', { name: `${taskTitle} 카드 이동` });
}

/** Pointer down on grip and move past dnd-kit activation distance (8px). */
export async function beginTaskPointerDrag(page: Page, taskTitle: string) {
  const handle = taskDragHandle(page, taskTitle);
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) {
    throw new Error(`drag handle bounding box missing: ${taskTitle}`);
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 24, { steps: 6 });
}

export async function moveTaskPointer(page: Page, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 12 });
}

export async function endTaskPointerDrag(page: Page) {
  await page.mouse.up();
}

export async function submitAddTaskDialog(
  page: Page,
  input: { title: string; notes?: string },
  options?: { subtask?: boolean }
) {
  const triggerTestId = options?.subtask ? 'kanban-add-subtask-trigger' : 'kanban-add-task-trigger';
  await page.getByTestId(triggerTestId).first().click();
  const dialog = page.getByRole('dialog', { name: options?.subtask ? '하위 할 일 추가' : '할 일 추가' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('할 일 제목').fill(input.title);
  if (input.notes) {
    await dialog.getByPlaceholder('설명 (선택)').fill(input.notes);
  }
  await dialog.getByRole('button', { name: '추가' }).click();
  await expect(
    page.getByText(options?.subtask ? '하위 할 일이 추가되었습니다.' : '할 일이 추가되었습니다.')
  ).toBeVisible({ timeout: 15_000 });
}
