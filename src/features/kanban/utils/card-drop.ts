import type { KanbanBoardTask } from './board-tasks';

export type CardDropPlacement = {
  tasklistId: string;
  index: number;
};

export type CardDropPoint = {
  x: number;
  y: number;
};

export type CardDropRect = {
  id: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
};

type ColumnRect = {
  tasklistId: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const OVERLAP_DROP_THRESHOLD_PX = 12;

function getTaskPlacement(
  columns: Record<string, KanbanBoardTask[]>,
  taskId: string
): CardDropPlacement | null {
  for (const [tasklistId, tasks] of Object.entries(columns)) {
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index !== -1) {
      return { tasklistId, index };
    }
  }
  return null;
}

export function resolveCardDropFromIds(
  columns: Record<string, KanbanBoardTask[]>,
  activeId: string,
  overId: string | null
): CardDropPlacement | null {
  if (!overId || overId === activeId) {
    return null;
  }

  if (overId in columns) {
    return null;
  }

  return getTaskPlacement(columns, overId);
}

export function resolveColumnByPoint(
  columnRects: readonly ColumnRect[],
  point: CardDropPoint
): string | null {
  let closestId: string | null = null;
  let closestDx = Infinity;

  for (const column of columnRects) {
    const inX = point.x >= column.left && point.x <= column.right;
    const inY = point.y >= column.top && point.y <= column.bottom;
    if (inX && inY) {
      return column.tasklistId;
    }

    const dx =
      point.x < column.left
        ? column.left - point.x
        : point.x > column.right
          ? point.x - column.right
          : 0;

    if (dx < closestDx) {
      closestDx = dx;
      closestId = column.tasklistId;
    }
  }

  return closestId;
}

export function insertionIndexFromCenters(
  othersCentersY: readonly number[],
  activeCenterY: number
): number {
  let index = 0;
  for (const centerY of othersCentersY) {
    if (centerY < activeCenterY) {
      index += 1;
    }
  }
  return index;
}

function overlapY(
  a: { top: number; bottom: number },
  b: { top: number; bottom: number }
): number {
  return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

export function resolveGeometryPlacement(params: {
  tasklistId: string;
  tasks: readonly KanbanBoardTask[];
  activeId: string;
  point: CardDropPoint;
  dragRect: { top: number; bottom: number } | null;
  cardRects: readonly CardDropRect[];
}): CardDropPlacement {
  const { tasklistId, tasks, activeId, point, dragRect, cardRects } = params;
  const others = cardRects.filter((rect) => rect.id !== activeId);

  const containing =
    others.find(
      (rect) =>
        point.y >= rect.top &&
        point.y <= rect.bottom &&
        point.x >= rect.left &&
        point.x <= rect.right
    ) ?? others.find((rect) => point.y >= rect.top && point.y <= rect.bottom);

  if (containing) {
    const index = tasks.findIndex((task) => task.id === containing.id);
    if (index !== -1) {
      return { tasklistId, index };
    }
  }

  if (dragRect) {
    let best: { id: string; overlap: number } | null = null;
    for (const rect of others) {
      const overlap = overlapY(dragRect, rect);
      if (overlap <= 0) {
        continue;
      }
      if (!best || overlap > best.overlap) {
        best = { id: rect.id, overlap };
      }
    }
    if (best && best.overlap >= OVERLAP_DROP_THRESHOLD_PX) {
      const index = tasks.findIndex((task) => task.id === best.id);
      if (index !== -1) {
        return { tasklistId, index };
      }
    }
  }

  return {
    tasklistId,
    index: insertionIndexFromCenters(
      others.map((rect) => rect.top + rect.height / 2),
      point.y
    )
  };
}

export function resolveCardDropPlacement(params: {
  columns: Record<string, KanbanBoardTask[]>;
  activeId: string;
  overId: string | null;
  lastOverId: string | null;
  geometry: CardDropPlacement | null;
}): CardDropPlacement | null {
  const fromOver = resolveCardDropFromIds(params.columns, params.activeId, params.overId);
  if (fromOver) {
    return fromOver;
  }

  if (params.geometry) {
    return params.geometry;
  }

  const fromLastOver = resolveCardDropFromIds(
    params.columns,
    params.activeId,
    params.lastOverId
  );
  if (fromLastOver) {
    return fromLastOver;
  }

  const columnId =
    params.overId && params.overId in params.columns
      ? params.overId
      : params.lastOverId && params.lastOverId in params.columns
        ? params.lastOverId
        : null;

  if (!columnId) {
    return null;
  }

  const source = getTaskPlacement(params.columns, params.activeId);
  if (!source || source.tasklistId === columnId) {
    return null;
  }

  return {
    tasklistId: columnId,
    index: (params.columns[columnId] ?? []).length
  };
}

export function reorderColumnsForCardMove(
  columns: Record<string, KanbanBoardTask[]>,
  activeId: string,
  destTasklistId: string,
  destIndex: number
): Record<string, KanbanBoardTask[]> | null {
  if (!(destTasklistId in columns)) {
    return null;
  }

  const next: Record<string, KanbanBoardTask[]> = {};
  for (const id of Object.keys(columns)) {
    next[id] = [...(columns[id] ?? [])];
  }

  let moved: KanbanBoardTask | undefined;
  for (const id of Object.keys(next)) {
    const index = next[id].findIndex((task) => task.id === activeId);
    if (index === -1) {
      continue;
    }
    [moved] = next[id].splice(index, 1);
    break;
  }

  if (!moved) {
    return null;
  }

  const destTasks = next[destTasklistId] ?? [];
  const clamped = Math.max(0, Math.min(destIndex, destTasks.length));
  destTasks.splice(clamped, 0, moved);
  next[destTasklistId] = destTasks;
  return next;
}

export function measureCardDropGeometry(
  columns: Record<string, KanbanBoardTask[]>,
  activeId: string,
  point: CardDropPoint,
  dragRect: { top: number; bottom: number } | null
): CardDropPlacement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const columnRects: ColumnRect[] = [];
  document.querySelectorAll<HTMLElement>('[data-kanban-tasklist-id]').forEach((element) => {
    const tasklistId = element.getAttribute('data-kanban-tasklist-id');
    if (!tasklistId) {
      return;
    }
    const rect = element.getBoundingClientRect();
    columnRects.push({
      tasklistId,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom
    });
  });

  const tasklistId = resolveColumnByPoint(columnRects, point);
  if (!tasklistId || !(tasklistId in columns)) {
    return null;
  }

  const tasks = columns[tasklistId] ?? [];
  const cardRects: CardDropRect[] = [];
  for (const task of tasks) {
    const card = document.querySelector<HTMLElement>(
      `[data-kanban-task-id="${CSS.escape(task.id)}"]`
    );
    if (!card) {
      continue;
    }
    const rect = card.getBoundingClientRect();
    cardRects.push({
      id: task.id,
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      height: rect.height
    });
  }

  return resolveGeometryPlacement({
    tasklistId,
    tasks,
    activeId,
    point,
    dragRect,
    cardRects
  });
}
