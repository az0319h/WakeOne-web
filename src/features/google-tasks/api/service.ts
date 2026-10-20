import { apiClient, apiClientWithMessage } from '@/lib/api-client';
import type {
  CreateTasklistPayload,
  CreateTaskPayload,
  GoogleTasksTasklistResponse,
  GoogleTasksTasklistsResponse,
  GoogleTasksTaskResponse,
  GoogleTasksTasksResponse,
  MoveTaskPayload,
  UpdateTaskPayload,
  UpdateTasklistPayload
} from './types';

function encodeTasklistId(tasklistId: string): string {
  return encodeURIComponent(tasklistId);
}

export async function fetchGoogleTasklists(): Promise<GoogleTasksTasklistsResponse> {
  return apiClient<GoogleTasksTasklistsResponse>('/google-tasks/tasklists');
}

export async function createGoogleTasklist(
  payload: CreateTasklistPayload
): Promise<GoogleTasksTasklistResponse> {
  return apiClient<GoogleTasksTasklistResponse>('/google-tasks/tasklists', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateGoogleTasklist(
  tasklistId: string,
  payload: UpdateTasklistPayload
): Promise<GoogleTasksTasklistResponse> {
  return apiClient<GoogleTasksTasklistResponse>(
    `/google-tasks/tasklists/${encodeTasklistId(tasklistId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteGoogleTasklist(tasklistId: string): Promise<{ success: boolean; message: string }> {
  return apiClientWithMessage<{ success: boolean; message: string }>('/google-tasks/tasklists/delete', {
    method: 'POST',
    body: JSON.stringify({ tasklistId })
  });
}

export async function fetchGoogleTasks(
  tasklistId: string,
  showCompleted = true
): Promise<GoogleTasksTasksResponse> {
  const params = new URLSearchParams();
  if (!showCompleted) {
    params.set('showCompleted', 'false');
  }
  const query = params.toString();
  return apiClient<GoogleTasksTasksResponse>(
    `/google-tasks/tasklists/${encodeTasklistId(tasklistId)}/tasks${query ? `?${query}` : ''}`
  );
}

export async function createGoogleTask(
  tasklistId: string,
  payload: CreateTaskPayload
): Promise<GoogleTasksTaskResponse> {
  return apiClient<GoogleTasksTaskResponse>(
    `/google-tasks/tasklists/${encodeTasklistId(tasklistId)}/tasks`,
    {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateGoogleTask(
  taskId: string,
  payload: UpdateTaskPayload
): Promise<GoogleTasksTaskResponse> {
  return apiClient<GoogleTasksTaskResponse>(`/google-tasks/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteGoogleTask(
  taskId: string,
  payload: { tasklistId: string }
): Promise<{ success: boolean; message: string }> {
  return apiClient<{ success: boolean; message: string }>(`/google-tasks/tasks/${taskId}`, {
    method: 'DELETE',
    body: JSON.stringify(payload)
  });
}

export async function completeGoogleTask(
  taskId: string,
  payload: { tasklistId: string }
): Promise<GoogleTasksTaskResponse> {
  return apiClient<GoogleTasksTaskResponse>(`/google-tasks/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function uncompleteGoogleTask(
  taskId: string,
  payload: { tasklistId: string }
): Promise<GoogleTasksTaskResponse> {
  return apiClient<GoogleTasksTaskResponse>(`/google-tasks/tasks/${taskId}/uncomplete`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function moveGoogleTask(payload: MoveTaskPayload): Promise<GoogleTasksTaskResponse> {
  return apiClientWithMessage<GoogleTasksTaskResponse>('/google-tasks/tasks/move', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function clearCompletedGoogleTasks(
  tasklistId: string
): Promise<{ success: boolean; message: string }> {
  return apiClientWithMessage<{ success: boolean; message: string }>(
    `/google-tasks/tasklists/${encodeTasklistId(tasklistId)}/clear-completed`,
    { method: 'POST' }
  );
}
