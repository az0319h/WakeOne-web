import 'server-only';

import { fetchGoogleAccessToken } from './oauth';
import { googleTasksMockStore } from './mock-store';
import type { GoogleTask, GoogleTaskList, GoogleTaskListResponse } from './types';
import { GoogleTasksApiError as ApiError } from './types';

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1';
const TASKS_PAGE_SIZE = '100';
const MAX_TASK_PAGES = 100;

function isMockMode(): boolean {
  return process.env.E2E_GOOGLE_TASKS_MOCK === '1';
}

function hasRequestBody(init?: RequestInit): boolean {
  return init?.body !== undefined && init?.body !== null && init.body !== '';
}

function buildGoogleFetchHeaders(accessToken: string, init?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`
  };
  const hasBody = init?.body !== undefined && init?.body !== null && init?.body !== '';
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function googleFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const method = init?.method ?? 'GET';
  const response = await fetch(`${TASKS_BASE}${path}`, {
    method,
    body: hasRequestBody(init) ? init?.body : undefined,
    headers: buildGoogleFetchHeaders(accessToken, init)
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let json: unknown = {};
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { message: text };
    }
  }

  if (!response.ok) {
    const err = json as { error?: { message?: string; code?: number; status?: string } };
    const message =
      err.error?.message ?? (typeof (json as { message?: string }).message === 'string'
        ? (json as { message: string }).message
        : 'Google Tasks API 요청에 실패했습니다.');
    throw new ApiError(message, response.status, err.error?.status);
  }

  return json as T;
}

export type GoogleTasksClientContext = {
  userId: string;
  encryptedRefreshToken: string;
};

async function withAccessToken<T>(
  ctx: GoogleTasksClientContext,
  fn: (accessToken: string) => Promise<T>
): Promise<T> {
  const accessToken = await fetchGoogleAccessToken(ctx.encryptedRefreshToken);
  return fn(accessToken);
}

export async function listTasklists(ctx: GoogleTasksClientContext): Promise<GoogleTaskList[]> {
  if (isMockMode()) {
    return googleTasksMockStore.listTasklists(ctx.userId);
  }
  return withAccessToken(ctx, async (token) => {
    const data = await googleFetch<{ items?: GoogleTaskList[] }>(token, '/users/@me/lists');
    const items = data.items ?? [];
    let defaultId: string | undefined;
    try {
      const defaultList = await googleFetch<GoogleTaskList>(token, '/users/@me/lists/@default');
      defaultId = defaultList.id;
    } catch {
      defaultId = items[0]?.id;
    }
    return items.map((item) => ({
      ...item,
      isDefault: item.id === defaultId
    }));
  });
}

export async function insertTasklist(
  ctx: GoogleTasksClientContext,
  title: string
): Promise<GoogleTaskList> {
  if (isMockMode()) {
    return googleTasksMockStore.insertTasklist(ctx.userId, title);
  }
  return withAccessToken(ctx, (token) =>
    googleFetch<GoogleTaskList>(token, '/users/@me/lists', {
      method: 'POST',
      body: JSON.stringify({ title })
    })
  );
}

export async function patchTasklist(
  ctx: GoogleTasksClientContext,
  tasklistId: string,
  title: string
): Promise<GoogleTaskList> {
  if (isMockMode()) {
    try {
      return googleTasksMockStore.patchTasklist(ctx.userId, tasklistId, title);
    } catch {
      throw new ApiError('목록을 찾을 수 없습니다.', 404, 'not_found');
    }
  }
  return withAccessToken(ctx, (token) =>
    googleFetch<GoogleTaskList>(token, `/users/@me/lists/${encodeURIComponent(tasklistId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title })
    })
  );
}

function sortTasksForDeletion(tasks: GoogleTask[]): GoogleTask[] {
  const taskIds = new Set(tasks.map((task) => task.id).filter((id): id is string => Boolean(id)));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const depth = (task: GoogleTask): number => {
    let level = 0;
    let parentId = task.parent;
    while (parentId && taskIds.has(parentId)) {
      level += 1;
      parentId = byId.get(parentId)?.parent;
    }
    return level;
  };
  return [...tasks].sort((a, b) => depth(b) - depth(a));
}

async function getDefaultTasklistId(token: string): Promise<string | undefined> {
  try {
    const defaultList = await googleFetch<GoogleTaskList>(token, '/users/@me/lists/@default');
    return defaultList.id;
  } catch {
    return undefined;
  }
}

export async function deleteTasklist(
  ctx: GoogleTasksClientContext,
  tasklistId: string
): Promise<void> {
  const normalizedId = tasklistId.trim();
  if (!normalizedId) {
    throw new ApiError('목록 ID가 올바르지 않습니다.', 400, 'invalid_argument');
  }

  if (isMockMode()) {
    try {
      googleTasksMockStore.deleteTasklist(ctx.userId, normalizedId);
      return;
    } catch (error) {
      if (error instanceof Error && error.message === 'DEFAULT_LIST') {
        throw new ApiError(
          'Google 기본 목록은 삭제할 수 없습니다. 추가로 만든 목록만 삭제됩니다.',
          400,
          'invalid_argument'
        );
      }
      throw new ApiError('목록을 찾을 수 없습니다.', 404, 'not_found');
    }
  }

  await withAccessToken(ctx, async (token) => {
    const defaultId = await getDefaultTasklistId(token);
    if (defaultId && (normalizedId === defaultId || normalizedId === '@default')) {
      throw new ApiError(
        'Google 기본 목록은 삭제할 수 없습니다. 추가로 만든 목록만 삭제됩니다.',
        400,
        'invalid_argument'
      );
    }

    await googleFetch<void>(token, `/users/@me/lists/${encodeURIComponent(normalizedId)}`, {
      method: 'DELETE'
    });
  });
}

function buildListTasksQuery(showCompleted: boolean, pageToken?: string): URLSearchParams {
  const params = new URLSearchParams({
    showCompleted: showCompleted ? 'true' : 'false',
    maxResults: TASKS_PAGE_SIZE
  });
  // Completed tasks are hidden. showCompleted alone does not return them.
  if (showCompleted) {
    params.set('showHidden', 'true');
  }
  if (pageToken) {
    params.set('pageToken', pageToken);
  }
  return params;
}

export async function listTasks(
  ctx: GoogleTasksClientContext,
  tasklistId: string,
  showCompleted = true
): Promise<GoogleTask[]> {
  if (isMockMode()) {
    try {
      return googleTasksMockStore.listTasks(ctx.userId, tasklistId, showCompleted);
    } catch {
      throw new ApiError('목록을 찾을 수 없습니다.', 404, 'not_found');
    }
  }

  return withAccessToken(ctx, async (token) => {
    const tasks: GoogleTask[] = [];
    const seenPageTokens = new Set<string>();
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_TASK_PAGES; page += 1) {
      const params = buildListTasksQuery(showCompleted, pageToken);
      const data = await googleFetch<GoogleTaskListResponse>(
        token,
        `/lists/${encodeURIComponent(tasklistId)}/tasks?${params}`
      );
      if (data.items?.length) {
        tasks.push(...data.items);
      }
      const nextPageToken = data.nextPageToken;
      if (!nextPageToken || seenPageTokens.has(nextPageToken)) {
        break;
      }
      seenPageTokens.add(nextPageToken);
      pageToken = nextPageToken;
    }

    return tasks;
  });
}

export async function insertTask(
  ctx: GoogleTasksClientContext,
  tasklistId: string,
  input: { title: string; notes?: string; parent?: string; due?: string }
): Promise<GoogleTask> {
  if (isMockMode()) {
    try {
      return googleTasksMockStore.insertTask(ctx.userId, tasklistId, input);
    } catch {
      throw new ApiError('목록을 찾을 수 없습니다.', 404, 'not_found');
    }
  }
  return withAccessToken(ctx, (token) =>
    googleFetch<GoogleTask>(token, `/lists/${encodeURIComponent(tasklistId)}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        notes: input.notes,
        parent: input.parent,
        due: input.due
      })
    })
  );
}

export async function patchTask(
  ctx: GoogleTasksClientContext,
  tasklistId: string,
  taskId: string,
  patch: Partial<Pick<GoogleTask, 'title' | 'notes' | 'due' | 'status' | 'completed'>>
): Promise<GoogleTask> {
  if (isMockMode()) {
    try {
      return googleTasksMockStore.patchTask(ctx.userId, tasklistId, taskId, patch);
    } catch {
      throw new ApiError('할 일을 찾을 수 없습니다.', 404, 'not_found');
    }
  }
  return withAccessToken(ctx, (token) =>
    googleFetch<GoogleTask>(
      token,
      `/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      }
    )
  );
}

export async function deleteTask(
  ctx: GoogleTasksClientContext,
  tasklistId: string,
  taskId: string
): Promise<void> {
  if (isMockMode()) {
    try {
      googleTasksMockStore.deleteTask(ctx.userId, tasklistId, taskId);
      return;
    } catch {
      throw new ApiError('할 일을 찾을 수 없습니다.', 404, 'not_found');
    }
  }
  await withAccessToken(ctx, (token) =>
    googleFetch<void>(
      token,
      `/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: 'DELETE' }
    )
  );
}

export async function completeTask(
  ctx: GoogleTasksClientContext,
  tasklistId: string,
  taskId: string
): Promise<GoogleTask> {
  return patchTask(ctx, tasklistId, taskId, {
    status: 'completed',
    completed: new Date().toISOString()
  });
}

export async function uncompleteTask(
  ctx: GoogleTasksClientContext,
  tasklistId: string,
  taskId: string
): Promise<GoogleTask> {
  return patchTask(ctx, tasklistId, taskId, {
    status: 'needsAction',
    completed: undefined
  });
}

export async function moveTask(
  ctx: GoogleTasksClientContext,
  input: {
    tasklistId: string;
    taskId: string;
    destinationTasklistId?: string;
    previous?: string;
    parent?: string;
  }
): Promise<GoogleTask> {
  if (isMockMode()) {
    try {
      return googleTasksMockStore.moveTask(ctx.userId, input);
    } catch {
      throw new ApiError('할 일을 찾을 수 없습니다.', 404, 'not_found');
    }
  }
  const params = new URLSearchParams();
  if (input.destinationTasklistId) {
    params.set('destinationTasklist', input.destinationTasklistId);
  }
  if (input.previous) {
    params.set('previous', input.previous);
  }
  if (input.parent) {
    params.set('parent', input.parent);
  }
  const query = params.toString();
  const path = `/lists/${encodeURIComponent(input.tasklistId)}/tasks/${encodeURIComponent(input.taskId)}/move${query ? `?${query}` : ''}`;
  return withAccessToken(ctx, (token) =>
    googleFetch<GoogleTask>(token, path, { method: 'POST' })
  );
}

export async function clearCompletedTasks(
  ctx: GoogleTasksClientContext,
  tasklistId: string
): Promise<{ deletedCount: number }> {
  if (isMockMode()) {
    try {
      const deletedCount = googleTasksMockStore.clearCompleted(ctx.userId, tasklistId);
      return { deletedCount };
    } catch {
      throw new ApiError('목록을 찾을 수 없습니다.', 404, 'not_found');
    }
  }

  const allTasks = await listTasks(ctx, tasklistId, true);
  const completed = allTasks.filter((task) => task.status === 'completed');
  if (completed.length === 0) {
    return { deletedCount: 0 };
  }

  const ordered = sortTasksForDeletion(completed);
  await withAccessToken(ctx, async (token) => {
    for (const task of ordered) {
      if (!task.id) {
        throw new ApiError('완료된 할 일 ID가 없습니다.', 502, 'google_api_error');
      }
      await googleFetch<void>(
        token,
        `/lists/${encodeURIComponent(tasklistId)}/tasks/${encodeURIComponent(task.id)}`,
        { method: 'DELETE' }
      );
    }
  });

  return { deletedCount: completed.length };
}

export function mapGoogleTasksError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  const message = error instanceof Error ? error.message : 'Google Tasks 처리 중 오류가 발생했습니다.';
  return new ApiError(message, 502, 'google_api_error');
}
