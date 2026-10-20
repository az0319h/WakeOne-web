import { mutationOptions, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { compareGoogleTaskPosition, googleTaskPositionBetween } from '@/lib/google-tasks/position';
import type { GoogleTask } from '@/lib/google-tasks/types';
import { notifyError } from '@/lib/notify';
import { getQueryClient } from '@/lib/query-client';
import {
  clearCompletedGoogleTasks,
  completeGoogleTask,
  createGoogleTask,
  createGoogleTasklist,
  deleteGoogleTask,
  deleteGoogleTasklist,
  moveGoogleTask,
  uncompleteGoogleTask,
  updateGoogleTask,
  updateGoogleTasklist
} from './service';
import type {
  CreateTasklistPayload,
  CreateTaskPayload,
  GoogleTasksTaskResponse,
  GoogleTasksTasksResponse,
  MoveTaskPayload,
  UpdateTaskPayload,
  UpdateTasklistPayload
} from './types';
import { googleTasksKeys } from './types';

type TasksQuerySnapshot = Array<[QueryKey, GoogleTasksTasksResponse | undefined]>;

type GoogleTasksMutationContext = {
  snapshot: TasksQuerySnapshot;
};

function invalidateGoogleTasks() {
  getQueryClient().invalidateQueries({ queryKey: googleTasksKeys.all });
}

/** move는 출발·도착 목록만 다시 불러온다 (전체 목록·tasklists 재조회 생략). */
function invalidateMovedTasklists(payload: MoveTaskPayload) {
  const queryClient = getQueryClient();
  const destinationId = payload.destinationTasklistId ?? payload.tasklistId;
  for (const tasklistId of new Set([payload.tasklistId, destinationId])) {
    queryClient.invalidateQueries({ queryKey: googleTasksKeys.tasks(tasklistId) });
  }
}

function mutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    if (error.message.startsWith('API error:')) {
      return fallback;
    }
    return error.message;
  }
  return fallback;
}

function readShowCompleted(queryKey: QueryKey) {
  const last = queryKey[queryKey.length - 1];
  if (typeof last === 'object' && last !== null && 'showCompleted' in last) {
    return (last as { showCompleted?: boolean }).showCompleted !== false;
  }
  return true;
}

function snapshotTaskQueries(queryClient: QueryClient, tasklistIds: string[]): TasksQuerySnapshot {
  const snapshot: TasksQuerySnapshot = [];
  for (const tasklistId of tasklistIds) {
    snapshot.push(
      ...queryClient.getQueriesData<GoogleTasksTasksResponse>({
        queryKey: googleTasksKeys.tasks(tasklistId)
      })
    );
  }
  return snapshot;
}

function restoreTaskQueries(queryClient: QueryClient, snapshot: TasksQuerySnapshot) {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data);
  }
}

function mapTaskQueries(
  queryClient: QueryClient,
  tasklistId: string,
  mapTasks: (tasks: GoogleTask[], showCompleted: boolean) => GoogleTask[]
) {
  const entries = queryClient.getQueriesData<GoogleTasksTasksResponse>({
    queryKey: googleTasksKeys.tasks(tasklistId)
  });
  for (const [queryKey, data] of entries) {
    if (!data) {
      continue;
    }
    const showCompleted = readShowCompleted(queryKey);
    queryClient.setQueryData<GoogleTasksTasksResponse>(queryKey, {
      ...data,
      tasks: mapTasks(data.tasks, showCompleted)
    });
  }
}

function readTaskList(queryClient: QueryClient, tasklistId: string): GoogleTask[] {
  const entries = queryClient.getQueriesData<GoogleTasksTasksResponse>({
    queryKey: googleTasksKeys.tasks(tasklistId)
  });
  let best: GoogleTask[] = [];
  for (const [, data] of entries) {
    if (data && data.tasks.length >= best.length) {
      best = data.tasks;
    }
  }
  return best.map((task) => ({ ...task }));
}

function writeTaskList(queryClient: QueryClient, tasklistId: string, tasks: GoogleTask[]) {
  const entries = queryClient.getQueriesData<GoogleTasksTasksResponse>({
    queryKey: googleTasksKeys.tasks(tasklistId)
  });
  for (const [queryKey, data] of entries) {
    if (!data) {
      continue;
    }
    const showCompleted = readShowCompleted(queryKey);
    const nextTasks = showCompleted
      ? tasks.map((task) => ({ ...task }))
      : tasks.filter((task) => task.status !== 'completed').map((task) => ({ ...task }));
    queryClient.setQueryData<GoogleTasksTasksResponse>(queryKey, {
      ...data,
      tasks: nextTasks
    });
  }
}

function applyTaskPatch(
  queryClient: QueryClient,
  tasklistId: string,
  taskId: string,
  patch: (task: GoogleTask) => GoogleTask | null,
  hideWhenIncompleteList = false
) {
  mapTaskQueries(queryClient, tasklistId, (tasks, showCompleted) => {
    const next: GoogleTask[] = [];
    for (const task of tasks) {
      if (task.id !== taskId) {
        next.push(task);
        continue;
      }
      const patched = patch(task);
      if (!patched) {
        continue;
      }
      if (hideWhenIncompleteList && !showCompleted && patched.status === 'completed') {
        continue;
      }
      next.push(patched);
    }
    return next;
  });
}

function optimisticMovePosition(
  destinationTasks: GoogleTask[],
  parent: string | undefined,
  previousId: string | undefined
): string {
  const siblings = destinationTasks
    .filter((task) => (task.parent ?? undefined) === parent)
    .sort(compareGoogleTaskPosition);
  const previousIndex = previousId ? siblings.findIndex((task) => task.id === previousId) : -1;
  const previousPosition = previousIndex >= 0 ? (siblings[previousIndex]?.position ?? '') : '';
  const nextPosition = siblings[previousIndex + 1]?.position || null;
  return googleTaskPositionBetween(previousPosition, nextPosition);
}

function applyMove(queryClient: QueryClient, payload: MoveTaskPayload) {
  const sourceId = payload.tasklistId;
  const destinationId = payload.destinationTasklistId ?? payload.tasklistId;
  const sourceTasks = readTaskList(queryClient, sourceId);
  const movingIndex = sourceTasks.findIndex((task) => task.id === payload.taskId);
  if (movingIndex < 0) {
    return;
  }
  const [moving] = sourceTasks.splice(movingIndex, 1);
  if (!moving) {
    return;
  }
  const destinationTasks =
    sourceId === destinationId ? sourceTasks : readTaskList(queryClient, destinationId);
  let insertAt = 0;
  if (payload.previous) {
    const previousIndex = destinationTasks.findIndex((task) => task.id === payload.previous);
    insertAt = previousIndex >= 0 ? previousIndex + 1 : destinationTasks.length;
  }
  const reparented =
    payload.parent !== undefined ? { ...moving, parent: payload.parent || undefined } : moving;
  // The board sorts by `position`, so the optimistic row needs one that lands between its new neighbors.
  const moved = {
    ...reparented,
    position: optimisticMovePosition(destinationTasks, reparented.parent, payload.previous)
  };
  destinationTasks.splice(insertAt, 0, moved);
  writeTaskList(queryClient, sourceId, sourceId === destinationId ? destinationTasks : sourceTasks);
  if (sourceId !== destinationId) {
    writeTaskList(queryClient, destinationId, destinationTasks);
  }
}

async function beginTaskMutation(tasklistIds: string[]) {
  const queryClient = getQueryClient();
  await Promise.all(
    tasklistIds.map((tasklistId) =>
      queryClient.cancelQueries({ queryKey: googleTasksKeys.tasks(tasklistId) })
    )
  );
  return {
    queryClient,
    snapshot: snapshotTaskQueries(queryClient, tasklistIds)
  };
}

function rollbackTaskMutation(context: GoogleTasksMutationContext | undefined, fallback: string, error: unknown) {
  if (context?.snapshot) {
    restoreTaskQueries(getQueryClient(), context.snapshot);
  }
  notifyError(mutationErrorMessage(error, fallback));
}

export const createGoogleTasklistMutation = mutationOptions({
  mutationFn: (payload: CreateTasklistPayload) => createGoogleTasklist(payload),
  onSettled: invalidateGoogleTasks
});

export const updateGoogleTasklistMutation = mutationOptions({
  mutationFn: ({ tasklistId, payload }: { tasklistId: string; payload: UpdateTasklistPayload }) =>
    updateGoogleTasklist(tasklistId, payload),
  onSettled: invalidateGoogleTasks
});

export const deleteGoogleTasklistMutation = mutationOptions({
  mutationFn: (tasklistId: string) => deleteGoogleTasklist(tasklistId),
  onSettled: invalidateGoogleTasks
});

export const createGoogleTaskMutation = mutationOptions({
  mutationFn: ({
    tasklistId,
    payload
  }: {
    tasklistId: string;
    payload: CreateTaskPayload;
  }) => createGoogleTask(tasklistId, payload),
  onSettled: invalidateGoogleTasks
});

export const updateGoogleTaskMutation = mutationOptions({
  mutationFn: ({ taskId, payload }: { taskId: string; payload: UpdateTaskPayload }) =>
    updateGoogleTask(taskId, payload),
  onMutate: async ({ taskId, payload }) => {
    const { queryClient, snapshot } = await beginTaskMutation([payload.tasklistId]);
    applyTaskPatch(queryClient, payload.tasklistId, taskId, (task) => ({
      ...task,
      title: payload.title ?? task.title,
      notes: payload.notes !== undefined ? payload.notes || undefined : task.notes
    }));
    return { snapshot } satisfies GoogleTasksMutationContext;
  },
  onError: (error, _variables, context) => {
    rollbackTaskMutation(context, '할 일을 수정하지 못했습니다.', error);
  },
  onSettled: invalidateGoogleTasks
});

export const deleteGoogleTaskMutation = mutationOptions({
  mutationFn: ({ taskId, tasklistId }: { taskId: string; tasklistId: string }) =>
    deleteGoogleTask(taskId, { tasklistId }),
  onMutate: async ({ taskId, tasklistId }) => {
    const { queryClient, snapshot } = await beginTaskMutation([tasklistId]);
    applyTaskPatch(queryClient, tasklistId, taskId, () => null);
    return { snapshot } satisfies GoogleTasksMutationContext;
  },
  onError: (error, _variables, context) => {
    rollbackTaskMutation(context, '할 일을 삭제하지 못했습니다.', error);
  },
  onSettled: invalidateGoogleTasks
});

export const completeGoogleTaskMutation = mutationOptions({
  mutationFn: ({ taskId, tasklistId }: { taskId: string; tasklistId: string }) =>
    completeGoogleTask(taskId, { tasklistId }),
  onMutate: async ({ taskId, tasklistId }) => {
    const { queryClient, snapshot } = await beginTaskMutation([tasklistId]);
    const completedAt = new Date().toISOString();
    applyTaskPatch(
      queryClient,
      tasklistId,
      taskId,
      (task) => ({ ...task, status: 'completed', completed: completedAt }),
      true
    );
    return { snapshot } satisfies GoogleTasksMutationContext;
  },
  onError: (error, _variables, context) => {
    rollbackTaskMutation(context, '완료 처리에 실패했습니다.', error);
  },
  onSettled: invalidateGoogleTasks
});

export const uncompleteGoogleTaskMutation = mutationOptions({
  mutationFn: ({ taskId, tasklistId }: { taskId: string; tasklistId: string }) =>
    uncompleteGoogleTask(taskId, { tasklistId }),
  onMutate: async ({ taskId, tasklistId }) => {
    const { queryClient, snapshot } = await beginTaskMutation([tasklistId]);
    applyTaskPatch(queryClient, tasklistId, taskId, (task) => ({
      ...task,
      status: 'needsAction',
      completed: undefined
    }));
    return { snapshot } satisfies GoogleTasksMutationContext;
  },
  onError: (error, _variables, context) => {
    rollbackTaskMutation(context, '완료 취소에 실패했습니다.', error);
  },
  onSettled: invalidateGoogleTasks
});

export const moveGoogleTaskMutation = mutationOptions({
  mutationFn: (payload: MoveTaskPayload) => moveGoogleTask(payload),
  onMutate: async (payload) => {
    const destinationId = payload.destinationTasklistId ?? payload.tasklistId;
    const tasklistIds =
      destinationId === payload.tasklistId
        ? [payload.tasklistId]
        : [payload.tasklistId, destinationId];
    const { queryClient, snapshot } = await beginTaskMutation(tasklistIds);
    applyMove(queryClient, payload);
    return { snapshot } satisfies GoogleTasksMutationContext;
  },
  onSuccess: (response: GoogleTasksTaskResponse, payload) => {
    const destinationId = payload.destinationTasklistId ?? payload.tasklistId;
    applyTaskPatch(getQueryClient(), destinationId, payload.taskId, (task) => ({
      ...task,
      ...response.task
    }));
  },
  onError: (error, _variables, context) => {
    rollbackTaskMutation(context, '할 일 이동에 실패했습니다.', error);
  },
  onSettled: (_data, _error, payload) => {
    invalidateMovedTasklists(payload);
  }
});

export const clearCompletedGoogleTasksMutation = mutationOptions({
  mutationFn: (tasklistId: string) => clearCompletedGoogleTasks(tasklistId),
  onMutate: async (tasklistId) => {
    const queryClient = getQueryClient();
    const snapshot = snapshotTaskQueries(queryClient, [tasklistId]);
    mapTaskQueries(queryClient, tasklistId, (tasks) =>
      tasks.filter((task) => task.status !== 'completed')
    );
    return { snapshot } satisfies GoogleTasksMutationContext;
  },
  onError: (error, _tasklistId, context) => {
    rollbackTaskMutation(context, '완료 항목 삭제에 실패했습니다.', error);
  },
  onSettled: invalidateGoogleTasks
});
