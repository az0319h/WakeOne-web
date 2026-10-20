'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent
} from '@dnd-kit/core';
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Kanban, KanbanBoard as KanbanBoardPrimitive, KanbanOverlay } from '@/components/ui/kanban';
import {
  googleTasklistsQueryOptions,
  googleTasksQueryOptions
} from '@/features/google-tasks/api/queries';
import { moveGoogleTaskMutation } from '@/features/google-tasks/api/mutations';
import { createRestrictToContainer } from '../utils/restrict-to-container';
import {
  buildKanbanColumns,
  partitionTasksByStatus,
  isTasklistColumnId,
  resolveMovePayloadFromColumnDiff,
  type KanbanBoardTask
} from '../utils/board-tasks';
import { reorderColumnsForCardMove, resolveColumnByPoint } from '../utils/card-drop';
import {
  findTaskListPlacement,
  measureLiveColumns,
  resolveLiveInsertIndexFromPointer,
  type CardLiveDrag
} from '../utils/card-live-shift';
import { GoogleTasksColumn } from './google-tasks-column';
import { GoogleTaskCard } from './google-task-card';
import { NewTasklistDialog } from './new-tasklist-dialog';
import {
  loadTasklistOrderFromStorage,
  mergeTasklistOrder,
  saveTasklistOrderToStorage
} from '../utils/tasklist-order';

function withColumnKeyOrder(
  order: readonly string[],
  next: Record<string, KanbanBoardTask[]>
): Record<string, KanbanBoardTask[]> {
  const ordered: Record<string, KanbanBoardTask[]> = {};
  for (const id of order) {
    if (Object.prototype.hasOwnProperty.call(next, id)) {
      ordered[id] = next[id] ?? [];
    }
  }
  for (const id of Object.keys(next)) {
    if (!Object.prototype.hasOwnProperty.call(ordered, id)) {
      ordered[id] = next[id] ?? [];
    }
  }
  return ordered;
}

export function GoogleTasksKanbanBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragSnapshotRef = useRef<Record<string, KanbanBoardTask[]> | null>(null);
  const columnDragRef = useRef(false);
  const cardDragRef = useRef<CardLiveDrag | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const { data: tasklistsResponse } = useSuspenseQuery(googleTasklistsQueryOptions());
  const tasklists = tasklistsResponse.tasklists;
  const apiOrder = useMemo(() => tasklists.map((list) => list.id), [tasklists]);
  const apiOrderKey = apiOrder.join('|');

  const [displayOrder, setDisplayOrder] = useState<string[]>(() =>
    mergeTasklistOrder(loadTasklistOrderFromStorage(), apiOrder)
  );
  const displayOrderRef = useRef(displayOrder);
  displayOrderRef.current = displayOrder;

  useEffect(() => {
    setDisplayOrder(mergeTasklistOrder(loadTasklistOrderFromStorage(), apiOrder));
  }, [apiOrderKey, apiOrder]);

  const orderedTasklists = useMemo(() => {
    const byId = new Map(tasklists.map((list) => [list.id, list]));
    return displayOrder.map((id) => byId.get(id)).filter((list) => list !== undefined);
  }, [tasklists, displayOrder]);

  const tasksQueries = useSuspenseQueries({
    queries: tasklists.map((tasklist) => googleTasksQueryOptions(tasklist.id, true))
  });

  const tasksDataKey = tasklists
    .map((tasklist, index) => {
      const tasks = tasksQueries[index]?.data?.tasks ?? [];
      return `${tasklist.id}:${tasks
        .map(
          (task) =>
            `${task.id}:${task.status}:${task.position ?? ''}:${task.parent ?? ''}:${task.title}:${task.notes ?? ''}`
        )
        .join(';')}`;
    })
    .join('|');

  const tasksByListId = useMemo(() => {
    const map: Record<string, import('@/lib/google-tasks/types').GoogleTask[]> = {};
    tasklists.forEach((tasklist, index) => {
      map[tasklist.id] = tasksQueries[index]?.data.tasks ?? [];
    });
    return map;
  }, [tasklists, tasksDataKey, tasksQueries]);

  const completedByListId = useMemo(() => {
    const map: Record<string, import('@/lib/google-tasks/types').GoogleTask[]> = {};
    for (const [listId, tasks] of Object.entries(tasksByListId)) {
      map[listId] = partitionTasksByStatus(tasks).completed;
    }
    return map;
  }, [tasksByListId]);

  const serverColumns = useMemo(
    () => buildKanbanColumns(displayOrder, tasksByListId),
    [displayOrder, tasksByListId]
  );

  const [dragPreviewColumns, setDragPreviewColumns] =
    useState<Record<string, KanbanBoardTask[]> | null>(null);
  const columns = dragPreviewColumns ?? serverColumns;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  useEffect(() => {
    setDragPreviewColumns(null);
    cardDragRef.current = null;
  }, [tasksDataKey, apiOrderKey]);

  const moveMutation = useMutation({
    ...moveGoogleTaskMutation
  });

  useEffect(() => {
    if (moveMutation.status === 'error') {
      setDragPreviewColumns(null);
    }
  }, [moveMutation.status, moveMutation.submittedAt]);

  const handleColumnsChange = useCallback((next: Record<string, KanbanBoardTask[]>) => {
    if (!columnDragRef.current) {
      return;
    }

    const keys = Object.keys(next);
    columnsRef.current = withColumnKeyOrder(keys, next);
    if (keys.join('|') !== displayOrderRef.current.join('|')) {
      saveTasklistOrderToStorage(keys);
      setDisplayOrder(keys);
      setDragPreviewColumns(null);
    }
  }, []);

  const restrictToBoard = useCallback(
    createRestrictToContainer(() => containerRef.current),
    []
  );

  const tasklistById = useMemo(() => {
    const map = new Map(tasklists.map((list) => [list.id, list]));
    return map;
  }, [tasklists]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const columnsNow = columnsRef.current;
    dragSnapshotRef.current = columnsNow;
    const activeId = String(event.active.id);
    const isColumn = isTasklistColumnId(columnsNow, activeId);
    columnDragRef.current = isColumn;
    if (isColumn) {
      cardDragRef.current = null;
      setDragPreviewColumns(null);
      return;
    }

    const placement = findTaskListPlacement(columnsNow, activeId);
    if (!placement) {
      return;
    }

    const card = document.querySelector<HTMLElement>(
      `[data-kanban-task-id="${CSS.escape(activeId)}"]`
    );
    const nextDrag: CardLiveDrag = {
      activeId,
      sourceListId: placement.listId,
      fromIndex: placement.index,
      destListId: placement.listId,
      toIndex: placement.index,
      height: card?.getBoundingClientRect().height ?? 56
    };
    cardDragRef.current = nextDrag;
    setDragPreviewColumns(null);
  }, []);

  const updateTaskDragPreview = useCallback(
    (event: { active: DragMoveEvent['active'] }) => {
      const snapshot = dragSnapshotRef.current;
      const current = cardDragRef.current;
      if (!snapshot || !current) {
        return;
      }

      const translated = event.active.rect.current.translated;
      if (!translated) {
        return;
      }

      const pointerX = translated.left + translated.width / 2;
      const pointerY = translated.top + translated.height / 2;
      const destListId =
        resolveColumnByPoint(measureLiveColumns(), { x: pointerX, y: pointerY }) ??
        current.destListId;
      const columnsForMeasure = columnsRef.current;
      const toIndex = resolveLiveInsertIndexFromPointer(
        columnsForMeasure,
        current.activeId,
        destListId,
        pointerY
      );

      if (current.destListId === destListId && current.toIndex === toIndex) {
        return;
      }

      const preview = reorderColumnsForCardMove(
        snapshot,
        current.activeId,
        destListId,
        toIndex
      );
      if (!preview) {
        return;
      }

      cardDragRef.current = { ...current, destListId, toIndex };
      const ordered = withColumnKeyOrder(displayOrderRef.current, preview);
      columnsRef.current = ordered;
      setDragPreviewColumns(ordered);
    },
    []
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (columnDragRef.current) {
        return;
      }
      updateTaskDragPreview(event);
    },
    [updateTaskDragPreview]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (columnDragRef.current || !cardDragRef.current) {
        return;
      }
      if (event.activatorEvent.cancelable) {
        event.activatorEvent.preventDefault();
      }
      updateTaskDragPreview(event);
    },
    [updateTaskDragPreview]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const before = dragSnapshotRef.current;
      const wasColumnDrag = columnDragRef.current;
      const liveDrag = cardDragRef.current;

      if (!wasColumnDrag && liveDrag && event.activatorEvent.cancelable) {
        event.activatorEvent.preventDefault();
      }

      dragSnapshotRef.current = null;
      cardDragRef.current = null;
      queueMicrotask(() => {
        columnDragRef.current = false;
      });

      if (!before || wasColumnDrag || !liveDrag) {
        setDragPreviewColumns(null);
        return;
      }

      const after = withColumnKeyOrder(displayOrderRef.current, columnsRef.current);
      const payload = resolveMovePayloadFromColumnDiff(before, after, liveDrag.activeId);
      if (!payload) {
        setDragPreviewColumns(null);
        return;
      }

      const ordered = withColumnKeyOrder(displayOrderRef.current, after);
      columnsRef.current = ordered;
      setDragPreviewColumns(ordered);
      moveMutation.mutate(payload);
    },
    [moveMutation]
  );

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    dragSnapshotRef.current = null;
    columnDragRef.current = false;
    cardDragRef.current = null;
    setDragPreviewColumns(null);
  }, []);

  if (tasklists.length === 0) {
    return (
      <div
        className='flex flex-1 flex-col items-center justify-center gap-4 rounded-md border border-dashed p-8'
        data-testid='kanban-empty-board'
      >
        <p className='text-muted-foreground text-sm'>Google Tasks 목록이 없습니다.</p>
        <NewTasklistDialog />
      </div>
    );
  }

  return (
    <div ref={containerRef} className='flex min-h-0 flex-1 flex-col'>
      <Kanban
        value={columns}
        onValueChange={handleColumnsChange}
        getItemValue={(item) => item.id}
        modifiers={[restrictToBoard]}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className='w-full overflow-x-auto rounded-md pb-4'>
          <KanbanBoardPrimitive className='h-auto w-max min-w-full items-start !h-auto !w-max !min-w-full'>
            {orderedTasklists.map((tasklist) => (
              <GoogleTasksColumn
                key={tasklist.id}
                value={tasklist.id}
                tasklist={tasklist}
                activeTasks={columns[tasklist.id] ?? []}
                completedTasks={completedByListId[tasklist.id] ?? []}
              />
            ))}
          </KanbanBoardPrimitive>
        </div>
        <KanbanOverlay dropAnimation={null}>
          {({ value, variant }) => {
            if (variant === 'column') {
              const tasklist = tasklistById.get(String(value));
              if (!tasklist) {
                return null;
              }
              return (
                <GoogleTasksColumn
                  value={tasklist.id}
                  tasklist={tasklist}
                  activeTasks={columns[tasklist.id] ?? []}
                  completedTasks={completedByListId[tasklist.id] ?? []}
                />
              );
            }

            const task = Object.values(columns)
              .flat()
              .find((item) => item.id === value);

            if (!task) {
              return null;
            }

            const tasklistId = Object.entries(columns).find(([, tasks]) =>
              tasks.some((item) => item.id === task.id)
            )?.[0];

            if (!tasklistId) {
              return null;
            }

            return <GoogleTaskCard overlay task={task} tasklistId={tasklistId} />;
          }}
        </KanbanOverlay>
      </Kanban>
    </div>
  );
}
