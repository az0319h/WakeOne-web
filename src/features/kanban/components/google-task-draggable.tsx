'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { KanbanBoardTask } from '../utils/board-tasks';
import { GoogleTaskCard } from './google-task-card';

interface GoogleTaskDraggableProps {
  task: KanbanBoardTask;
  tasklistId: string;
}

export function GoogleTaskDraggable({ task, tasklistId }: GoogleTaskDraggableProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'task', tasklistId }
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(isDragging && 'opacity-0')}
      data-testid='kanban-task-card'
      data-kanban-task-id={task.id}
    >
      <div
        data-kanban-task-shift={task.id}
        className='bg-card rounded-md border p-3 shadow-xs'
      >
        <GoogleTaskCard
          task={task}
          tasklistId={tasklistId}
          dragHandle={{ attributes, listeners, setActivatorNodeRef }}
        />
      </div>
    </div>
  );
}
