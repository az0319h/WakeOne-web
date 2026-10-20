export type CardLiveDrag = {
  activeId: string;
  sourceListId: string;
  fromIndex: number;
  destListId: string;
  toIndex: number;
  height: number;
};

export function findTaskListPlacement(
  columns: Record<string, { id: string }[]>,
  taskId: string
): { listId: string; index: number } | null {
  for (const [listId, tasks] of Object.entries(columns)) {
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index !== -1) {
      return { listId, index };
    }
  }
  return null;
}

export function resolveToIndexFromPointer(
  destCardMidYs: readonly number[],
  pointerY: number
): number {
  let index = 0;
  for (const midY of destCardMidYs) {
    if (midY < pointerY) {
      index += 1;
    }
  }
  return index;
}

/** 삽입 인덱스 — 매 move마다 DOM rect를 새로 읽는다. */
export function resolveLiveInsertIndexFromPointer(
  columns: Record<string, { id: string }[]>,
  activeId: string,
  destListId: string,
  pointerY: number
): number {
  if (typeof document === 'undefined') {
    return 0;
  }

  const tasks = columns[destListId] ?? [];
  const midYs: number[] = [];
  for (const task of tasks) {
    if (task.id === activeId) {
      continue;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-kanban-task-shift="${CSS.escape(task.id)}"]`
    );
    if (!el) {
      continue;
    }
    const rect = el.getBoundingClientRect();
    midYs.push(rect.top + rect.height / 2);
  }

  return resolveToIndexFromPointer(midYs, pointerY);
}

export type MeasuredLiveColumn = {
  tasklistId: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function measureLiveColumns(): MeasuredLiveColumn[] {
  if (typeof document === 'undefined') {
    return [];
  }

  const columns: MeasuredLiveColumn[] = [];
  document.querySelectorAll<HTMLElement>('[data-kanban-tasklist-id]').forEach((element) => {
    const tasklistId = element.getAttribute('data-kanban-tasklist-id');
    if (!tasklistId) {
      return;
    }
    const rect = element.getBoundingClientRect();
    columns.push({
      tasklistId,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom
    });
  });
  return columns;
}
