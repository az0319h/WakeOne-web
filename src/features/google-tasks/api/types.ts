import type { GoogleTask, GoogleTaskList } from '@/lib/google-tasks/types';

export type GoogleTasksConnectionRow = {
  user_id: string;
  google_email: string;
  encrypted_refresh_token: string;
  token_updated_at: string;
  created_at: string;
};

export type GoogleTasksTasklistsResponse = {
  success: boolean;
  message: string;
  tasklists: GoogleTaskList[];
};

export type GoogleTasksTasklistResponse = {
  success: boolean;
  message: string;
  tasklist: GoogleTaskList;
};

export type GoogleTasksTasksResponse = {
  success: boolean;
  message: string;
  tasks: GoogleTask[];
};

export type GoogleTasksTaskResponse = {
  success: boolean;
  message: string;
  task: GoogleTask;
};

export type CreateTasklistPayload = {
  title: string;
};

export type UpdateTasklistPayload = {
  title: string;
};

export type CreateTaskPayload = {
  title: string;
  notes?: string;
  parent?: string;
  due?: string;
};

export type UpdateTaskPayload = {
  tasklistId: string;
  title?: string;
  notes?: string;
  due?: string | null;
};

export type MoveTaskPayload = {
  tasklistId: string;
  taskId: string;
  destinationTasklistId?: string;
  previous?: string;
  parent?: string;
};

export type TaskMutationPayload = {
  tasklistId: string;
};

export const googleTasksKeys = {
  all: ['google-tasks'] as const,
  tasklists: () => [...googleTasksKeys.all, 'tasklists'] as const,
  tasks: (tasklistId: string) => [...googleTasksKeys.all, 'tasks', tasklistId] as const
};
