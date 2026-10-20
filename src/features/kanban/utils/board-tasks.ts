import type { GoogleTask } from '@/lib/google-tasks/types';
import type { MoveTaskPayload } from '@/features/google-tasks/api/types';
import { compareGoogleTaskPosition } from '@/lib/google-tasks/position';

export { compareGoogleTaskPosition };

export type KanbanBoardTask = GoogleTask & {
  subtasks: GoogleTask[];
};

export function isVisibleGoogleTask(task: GoogleTask): boolean {
  return task.hidden !== true;
}

function sortTasksByPosition(tasks: GoogleTask[]): GoogleTask[] {
  return [...tasks].sort(compareGoogleTaskPosition);
}

export function partitionTasksByStatus(tasks: GoogleTask[]) {
  const active: GoogleTask[] = [];
  const completed: GoogleTask[] = [];

  for (const task of tasks) {
    if (!isVisibleGoogleTask(task)) {
      continue;
    }
    if (task.status === 'completed') {
      completed.push(task);
    } else {
      active.push(task);
    }
  }

  return {
    active: sortTasksByPosition(active),
    completed: sortTasksByPosition(completed)
  };
}

export function buildKanbanColumnTasks(tasks: GoogleTask[]): KanbanBoardTask[] {
  const { active } = partitionTasksByStatus(tasks);
  const subtasksByParent = new Map<string, GoogleTask[]>();

  for (const task of active) {
    if (!task.parent) {
      continue;
    }
    const siblings = subtasksByParent.get(task.parent) ?? [];
    siblings.push(task);
    subtasksByParent.set(task.parent, siblings);
  }

  for (const [parentId, siblings] of subtasksByParent) {
    subtasksByParent.set(parentId, sortTasksByPosition(siblings));
  }

  return sortTasksByPosition(active.filter((task) => !task.parent)).map((task) => ({
    ...task,
    subtasks: subtasksByParent.get(task.id) ?? []
  }));
}

export function buildKanbanColumns(
  tasklistIds: string[],
  tasksByListId: Record<string, GoogleTask[]>
): Record<string, KanbanBoardTask[]> {
  const columns: Record<string, KanbanBoardTask[]> = {};
  for (const tasklistId of tasklistIds) {
    columns[tasklistId] = buildKanbanColumnTasks(tasksByListId[tasklistId] ?? []);
  }
  return columns;
}

type TaskPlacement = {
  tasklistId: string;
  index: number;
};

function indexTasks(columns: Record<string, KanbanBoardTask[]>): Map<string, TaskPlacement> {
  const map = new Map<string, TaskPlacement>();
  for (const [tasklistId, tasks] of Object.entries(columns)) {
    tasks.forEach((task, index) => {
      map.set(task.id, { tasklistId, index });
    });
  }
  return map;
}

export function resolveMovePayloadFromColumnDiff(
  before: Record<string, KanbanBoardTask[]>,
  after: Record<string, KanbanBoardTask[]>,
  movedTaskId: string
): MoveTaskPayload | null {
  const beforeIndex = indexTasks(before);
  const afterIndex = indexTasks(after);

  const beforePlacement = beforeIndex.get(movedTaskId);
  const afterPlacement = afterIndex.get(movedTaskId);

  if (!beforePlacement || !afterPlacement) {
    return null;
  }

  if (
    beforePlacement.tasklistId === afterPlacement.tasklistId &&
    beforePlacement.index === afterPlacement.index
  ) {
    return null;
  }

  const destTasks = after[afterPlacement.tasklistId] ?? [];
  const previousTask =
    afterPlacement.index > 0 ? destTasks[afterPlacement.index - 1] : undefined;

  return {
    tasklistId: beforePlacement.tasklistId,
    taskId: movedTaskId,
    destinationTasklistId:
      beforePlacement.tasklistId === afterPlacement.tasklistId
        ? undefined
        : afterPlacement.tasklistId,
    previous: previousTask?.id
  };
}

export function isTasklistColumnId(
  columns: Record<string, KanbanBoardTask[]>,
  id: string
): boolean {
  return id in columns;
}
