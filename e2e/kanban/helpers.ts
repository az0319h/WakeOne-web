import { expect, type APIRequestContext, type Page } from '@playwright/test';

export type GoogleTaskList = { id: string; title: string };
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

export async function submitNewTasklistDialog(page: Page, title: string) {
  await page.getByTestId('kanban-new-tasklist-trigger').first().click();
  const dialog = page.getByRole('dialog', { name: '새 목록' });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('예: 업무').fill(title);
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('새 목록이 추가되었습니다.')).toBeVisible({ timeout: 15_000 });
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
