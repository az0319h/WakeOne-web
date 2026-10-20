import 'server-only';

import * as googleTasksClient from '@/lib/google-tasks/client';
import { mapGoogleTasksError } from '@/lib/google-tasks/client';
import { GoogleTasksApiError } from '@/lib/google-tasks/types';
import {
  buildGoogleTasksClientContext,
  ensureMockGoogleTasksConnection,
  getGoogleTasksConnection
} from './connection.server';
import type { GoogleTasksConnectionRow } from './types';

export class GoogleTasksConnectionError extends Error {
  readonly code: 'not_connected';

  constructor() {
    super('Google Tasks 연결이 필요합니다. Google 로그인을 다시 시도해 주세요.');
    this.name = 'GoogleTasksConnectionError';
    this.code = 'not_connected';
  }
}

async function resolveConnection(
  userId: string,
  googleEmail: string
): Promise<GoogleTasksConnectionRow> {
  if (process.env.E2E_GOOGLE_TASKS_MOCK === '1') {
    return ensureMockGoogleTasksConnection(userId, googleEmail);
  }

  const connection = await getGoogleTasksConnection(userId);
  if (!connection) {
    throw new GoogleTasksConnectionError();
  }
  return connection;
}

function ctxFrom(connection: GoogleTasksConnectionRow, userId: string) {
  return buildGoogleTasksClientContext(userId, connection);
}

export async function listGoogleTasklists(userId: string, googleEmail: string) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    const tasklists = await googleTasksClient.listTasklists(ctxFrom(connection, userId));
    return { tasklists };
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function createGoogleTasklist(
  userId: string,
  googleEmail: string,
  title: string
) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    const tasklist = await googleTasksClient.insertTasklist(ctxFrom(connection, userId), title);
    return { tasklist };
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function updateGoogleTasklist(
  userId: string,
  googleEmail: string,
  tasklistId: string,
  title: string
) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    const tasklist = await googleTasksClient.patchTasklist(
      ctxFrom(connection, userId),
      tasklistId,
      title
    );
    return { tasklist };
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function deleteGoogleTasklist(
  userId: string,
  googleEmail: string,
  tasklistId: string
) {
  const normalizedId = tasklistId.trim();
  if (!normalizedId) {
    throw new GoogleTasksApiError('목록 ID가 올바르지 않습니다.', 400, 'invalid_argument');
  }
  const connection = await resolveConnection(userId, googleEmail);
  try {
    await googleTasksClient.deleteTasklist(ctxFrom(connection, userId), normalizedId);
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function listGoogleTasks(
  userId: string,
  googleEmail: string,
  tasklistId: string,
  showCompleted = true
) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    const tasks = await googleTasksClient.listTasks(
      ctxFrom(connection, userId),
      tasklistId,
      showCompleted
    );
    return { tasks };
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function createGoogleTask(
  userId: string,
  googleEmail: string,
  tasklistId: string,
  input: { title: string; notes?: string; parent?: string; due?: string }
) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    const task = await googleTasksClient.insertTask(
      ctxFrom(connection, userId),
      tasklistId,
      input
    );
    return { task };
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function updateGoogleTask(
  userId: string,
  googleEmail: string,
  tasklistId: string,
  taskId: string,
  patch: { title?: string; notes?: string; due?: string | null }
) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    const task = await googleTasksClient.patchTask(
      ctxFrom(connection, userId),
      tasklistId,
      taskId,
      {
        ...patch,
        due: patch.due === null ? undefined : patch.due
      }
    );
    return { task };
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function deleteGoogleTask(
  userId: string,
  googleEmail: string,
  tasklistId: string,
  taskId: string
) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    await googleTasksClient.deleteTask(ctxFrom(connection, userId), tasklistId, taskId);
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function completeGoogleTask(
  userId: string,
  googleEmail: string,
  tasklistId: string,
  taskId: string
) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    const task = await googleTasksClient.completeTask(
      ctxFrom(connection, userId),
      tasklistId,
      taskId
    );
    return { task };
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function uncompleteGoogleTask(
  userId: string,
  googleEmail: string,
  tasklistId: string,
  taskId: string
) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    const task = await googleTasksClient.uncompleteTask(
      ctxFrom(connection, userId),
      tasklistId,
      taskId
    );
    return { task };
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function moveGoogleTask(
  userId: string,
  googleEmail: string,
  input: {
    tasklistId: string;
    taskId: string;
    destinationTasklistId?: string;
    previous?: string;
    parent?: string;
  }
) {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    const task = await googleTasksClient.moveTask(ctxFrom(connection, userId), input);
    return { task };
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}

export async function clearCompletedGoogleTasks(
  userId: string,
  googleEmail: string,
  tasklistId: string
): Promise<{ deletedCount: number }> {
  const connection = await resolveConnection(userId, googleEmail);
  try {
    return await googleTasksClient.clearCompletedTasks(ctxFrom(connection, userId), tasklistId);
  } catch (error) {
    throw mapGoogleTasksError(error);
  }
}
