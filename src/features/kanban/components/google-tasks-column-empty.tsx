'use client';

import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { AddGoogleTaskDialog } from './add-google-task-dialog';

interface GoogleTasksColumnEmptyProps {
  tasklistId: string;
  className?: string;
}

export function GoogleTasksColumnEmpty({
  tasklistId,
  className
}: GoogleTasksColumnEmptyProps) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex flex-col items-center justify-center gap-3 px-4 py-8 text-center',
        className
      )}
      data-testid='kanban-column-empty'
    >
      <div className='bg-muted flex h-20 w-20 items-center justify-center rounded-full'>
        <Icons.clipboardText className='h-12 w-12' aria-hidden />
      </div>
      <div className='flex flex-col gap-1'>
        <p className='text-sm font-medium'>아직 할 일이 없음</p>
        <p className='text-xs'>할 일을 추가하고 이 목록에서 관리하세요.</p>
      </div>
      <AddGoogleTaskDialog
        tasklistId={tasklistId}
        triggerLabel='할 일 추가'
        triggerTestId='kanban-column-empty-add-trigger'
        triggerClassName='w-auto justify-center'
      />
    </div>
  );
}
