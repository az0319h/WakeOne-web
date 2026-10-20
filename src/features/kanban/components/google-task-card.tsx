'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { KanbanItem, KanbanItemHandle } from '@/components/ui/kanban';
import { Checkbox } from '@/components/ui/checkbox';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import {
  completeGoogleTaskMutation,
  uncompleteGoogleTaskMutation
} from '@/features/google-tasks/api/mutations';
import { cn } from '@/lib/utils';
import type { KanbanBoardTask } from '../utils/board-tasks';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Icons } from '@/components/icons';
import { EditGoogleTaskDialog } from './edit-google-task-dialog';

const googleTaskCheckboxClassName =
  '!size-5 !rounded-full !border-muted-foreground/60 !bg-transparent !shadow-none dark:!bg-transparent data-[state=checked]:!border-blue-600 data-[state=checked]:!bg-transparent data-[state=checked]:!text-blue-600 dark:data-[state=checked]:!border-blue-400 dark:data-[state=checked]:!bg-transparent dark:data-[state=checked]:!text-blue-400';

interface GoogleTaskCardProps extends Omit<React.ComponentProps<typeof KanbanItem>, 'value'> {
  task: KanbanBoardTask;
  tasklistId: string;
  completed?: boolean;
}

interface GoogleTaskEditTargetProps {
  task: KanbanBoardTask;
  completed: boolean;
  onEdit: () => void;
}

function GoogleTaskEditTarget({ task, completed, onEdit }: GoogleTaskEditTargetProps) {
  const hasNotes = Boolean(task.notes?.trim());

  return (
    <button
      type='button'
      className='w-full space-y-1 text-left'
      onClick={onEdit}
      data-testid='kanban-task-edit-trigger'
    >
      <span
        className={cn(
          'line-clamp-2 block text-sm font-medium',
          completed && 'line-through'
        )}
      >
        {task.title}
      </span>
      {completed && task.completed ? (
        <span className='text-muted-foreground block text-xs'>
          완료일:{' '}
          <time className='font-mono whitespace-nowrap'>
            {formatAbsoluteDateTimeKo(task.completed)}
          </time>
        </span>
      ) : null}
      {!completed && task.due ? (
        <time className='text-muted-foreground block font-mono text-xs whitespace-nowrap'>
          {formatAbsoluteDateKo(task.due)}
        </time>
      ) : null}
      {hasNotes ? (
        <span className='text-muted-foreground line-clamp-3 block text-xs'>{task.notes}</span>
      ) : null}
    </button>
  );
}

export function GoogleTaskCard({
  task,
  tasklistId,
  completed = false,
  ...props
}: GoogleTaskCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const completeMutation = useMutation({
    ...completeGoogleTaskMutation
  });
  const uncompleteMutation = useMutation({
    ...uncompleteGoogleTaskMutation
  });

  const isCompleted = completed || task.status === 'completed';
  const hasSubtasks = task.subtasks.length > 0;
  const isPending = completeMutation.isPending || uncompleteMutation.isPending;

  const content = (
    <div className='flex items-start gap-2'>
      {isCompleted ? null : (
        <KanbanItemHandle asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-7 w-7 shrink-0'
            aria-label={`${task.title} 카드 이동`}
            onClick={(event) => event.stopPropagation()}
          >
            <Icons.gripVertical className='h-4 w-4' />
          </Button>
        </KanbanItemHandle>
      )}
      <Checkbox
        checked={isCompleted}
        className={googleTaskCheckboxClassName}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={() => {
          if (isCompleted) {
            uncompleteMutation.mutate({ taskId: task.id, tasklistId });
            return;
          }
          completeMutation.mutate({ taskId: task.id, tasklistId });
        }}
        disabled={isPending}
        aria-label={isCompleted ? `${task.title} 완료 취소` : `${task.title} 완료`}
        data-testid={
          isCompleted ? 'kanban-task-uncomplete-checkbox' : 'kanban-task-complete-checkbox'
        }
      />
      <div className='min-w-0 flex-1 space-y-1'>
        <GoogleTaskEditTarget
          task={task}
          completed={isCompleted}
          onEdit={() => setEditOpen(true)}
        />
        {!isCompleted && hasSubtasks ? (
          <Collapsible defaultOpen className='pt-1'>
            <CollapsibleTrigger className='text-muted-foreground flex items-center gap-1 text-xs hover:underline'>
              <Icons.chevronDown className='h-3 w-3' />
              하위 할 일 {task.subtasks.length}개
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-2 space-y-2'>
              {task.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className='bg-muted/30 rounded-md border px-2 py-1.5 text-sm'
                  data-testid='kanban-subtask-row'
                >
                  {subtask.title}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      {isCompleted ? (
        <div
          className='bg-muted/40 rounded-md border p-3'
          data-testid='kanban-completed-task-card'
        >
          {content}
        </div>
      ) : (
        <KanbanItem value={task.id} asChild {...props}>
          <div className='bg-card rounded-md border p-3 shadow-xs' data-testid='kanban-task-card'>
            {content}
          </div>
        </KanbanItem>
      )}
      <EditGoogleTaskDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        tasklistId={tasklistId}
      />
    </>
  );
}
