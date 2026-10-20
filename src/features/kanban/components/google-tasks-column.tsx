'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { KanbanColumn, KanbanColumnHandle } from '@/components/ui/kanban';
import { cn } from '@/lib/utils';
import type { GoogleTaskList } from '@/lib/google-tasks/types';
import {
  clearCompletedGoogleTasksMutation,
  deleteGoogleTasklistMutation
} from '@/features/google-tasks/api/mutations';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { KanbanBoardTask } from '../utils/board-tasks';
import { AddGoogleTaskDialog } from './add-google-task-dialog';
import { GoogleTaskCard } from './google-task-card';
import { GoogleTasksColumnEmpty } from './google-tasks-column-empty';
import { RenameTasklistDialog } from './rename-tasklist-dialog';

interface GoogleTasksColumnProps
  extends Omit<React.ComponentProps<typeof KanbanColumn>, 'children'> {
  tasklist: GoogleTaskList;
  activeTasks: KanbanBoardTask[];
  completedTasks: import('@/lib/google-tasks/types').GoogleTask[];
}

export function GoogleTasksColumn({
  tasklist,
  activeTasks,
  completedTasks,
  value,
  className,
  ...props
}: GoogleTasksColumnProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const clearMutation = useMutation({
    ...clearCompletedGoogleTasksMutation,
    onSuccess: () => {
      notifySuccess('완료된 할 일을 삭제했습니다.');
      setClearOpen(false);
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '완료 항목 삭제에 실패했습니다.');
    }
  });

  const deleteMutation = useMutation({
    ...deleteGoogleTasklistMutation,
    onSuccess: () => {
      notifySuccess('목록을 삭제했습니다.');
      setDeleteOpen(false);
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '목록 삭제에 실패했습니다.');
    }
  });

  const completedCount = completedTasks.length;
  const [completedOpen, setCompletedOpen] = useState(false);

  return (
    <>
      <KanbanColumn
        value={value}
        {...props}
        className={cn(
          'h-auto w-[320px] min-w-[320px] max-w-[320px] shrink-0 self-start !h-auto !w-[320px] !min-w-[320px] !max-w-[320px] !shrink-0',
          className
        )}
      >
        <div className='flex items-center justify-between gap-2'>
          <div className='flex min-w-0 items-center gap-2'>
            <span
              className='truncate text-sm font-semibold'
              data-testid='kanban-column-title'
            >
              {tasklist.title}
            </span>
            <Badge variant='secondary' className='pointer-events-none rounded-sm'>
              {activeTasks.length}
            </Badge>
          </div>
          <div className='flex items-center gap-1'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label={`${tasklist.title} 목록 메뉴`}
                  data-testid='kanban-column-menu-trigger'
                >
                  <Icons.ellipsis className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  onSelect={() => setRenameOpen(true)}
                  data-testid='kanban-rename-tasklist-menu-item'
                >
                  이름 바꾸기
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={completedCount === 0}
                  onSelect={() => setClearOpen(true)}
                  data-testid='kanban-clear-completed-menu-item'
                >
                  완료 항목 삭제
                </DropdownMenuItem>
                {tasklist.isDefault ? (
                  <DropdownMenuItem
                    disabled
                    data-testid='kanban-delete-tasklist-menu-item-disabled'
                  >
                    기본 목록은 삭제할 수 없음
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    variant='destructive'
                    className='text-destructive focus:text-destructive'
                    onSelect={() => setDeleteOpen(true)}
                    data-testid='kanban-delete-tasklist-menu-item'
                  >
                    목록 삭제
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <KanbanColumnHandle asChild>
              <Button
                variant='ghost'
                size='icon'
                aria-label={`${tasklist.title} 목록 순서 변경`}
                data-testid='kanban-column-drag-handle'
              >
                <Icons.gripVertical className='h-4 w-4' />
              </Button>
            </KanbanColumnHandle>
          </div>
        </div>

        <AddGoogleTaskDialog tasklistId={tasklist.id} />

        {activeTasks.length === 0 ? (
          <GoogleTasksColumnEmpty tasklistId={tasklist.id} />
        ) : (
          <div className='flex flex-col gap-2 p-0.5'>
            {activeTasks.map((task) => (
              <GoogleTaskCard key={task.id} task={task} tasklistId={tasklist.id} />
            ))}
          </div>
        )}

        <Collapsible
          open={completedOpen}
          onOpenChange={setCompletedOpen}
          className='pt-2'
        >
          <CollapsibleTrigger
            className='text-muted-foreground flex w-full items-center gap-1 text-xs hover:underline'
            data-testid='kanban-completed-section-trigger'
          >
            <Icons.chevronRight
              className={cn('h-3 w-3 transition-transform', completedOpen && 'rotate-90')}
            />
            완료됨({completedCount}개)
          </CollapsibleTrigger>
          <CollapsibleContent className='mt-2 space-y-2 data-[state=closed]:hidden'>
            {completedTasks.map((task) => (
              <GoogleTaskCard
                key={task.id}
                task={{ ...task, subtasks: [] }}
                tasklistId={tasklist.id}
                completed
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </KanbanColumn>

      <RenameTasklistDialog
        tasklistId={tasklist.id}
        title={tasklist.title}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      <AlertModal
        isOpen={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => clearMutation.mutate(tasklist.id)}
        loading={clearMutation.isPending}
        title='완료 항목 삭제'
        description={`「${tasklist.title}」 목록의 완료된 할 일을 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel='삭제'
        cancelLabel='취소'
      />

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(tasklist.id)}
        loading={deleteMutation.isPending}
        title='목록 삭제'
        description={`「${tasklist.title}」 목록과 포함된 할 일을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel='삭제'
        cancelLabel='취소'
      />
    </>
  );
}
