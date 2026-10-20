'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { createGoogleTaskMutation } from '@/features/google-tasks/api/mutations';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

const taskFormSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해 주세요.').max(1024, '1024자 이하로 입력해 주세요.'),
  notes: z.string().max(8192, '8192자 이하로 입력해 주세요.')
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

const EMPTY_DEFAULT_VALUES: TaskFormValues = {
  title: '',
  notes: ''
};

interface AddGoogleTaskDialogProps {
  tasklistId: string;
  parentTaskId?: string;
  triggerLabel?: string;
  triggerTestId?: string;
  triggerClassName?: string;
}

export function AddGoogleTaskDialog({
  tasklistId,
  parentTaskId,
  triggerLabel = '할 일',
  triggerTestId,
  triggerClassName
}: AddGoogleTaskDialogProps) {
  const [open, setOpen] = useState(false);

  const createMutation = useMutation({
    ...createGoogleTaskMutation,
    onSuccess: () => {
      notifySuccess(parentTaskId ? '하위 할 일이 추가되었습니다.' : '할 일이 추가되었습니다.');
      form.reset(EMPTY_DEFAULT_VALUES);
      setOpen(false);
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '할 일을 추가하지 못했습니다.');
    }
  });

  const form = useAppForm({
    defaultValues: EMPTY_DEFAULT_VALUES,
    validators: {
      onSubmit: taskFormSchema
    },
    onSubmit: async ({ value }) => {
      const notes = value.notes.trim();
      await createMutation.mutateAsync({
        tasklistId,
        payload: {
          title: value.title.trim(),
          notes: notes.length > 0 ? notes : undefined,
          parent: parentTaskId
        }
      });
    }
  });

  const { FormTextField, FormTextareaField } = useFormFields<TaskFormValues>();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className={cn('w-full justify-start', triggerClassName)}
          data-testid={
            triggerTestId ??
            (parentTaskId ? 'kanban-add-subtask-trigger' : 'kanban-add-task-trigger')
          }
        >
          <Icons.add className='mr-2 h-4 w-4' />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{parentTaskId ? '하위 할 일 추가' : '할 일 추가'}</DialogTitle>
          <DialogDescription>Google Tasks에 할 일을 추가합니다.</DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form.Form className='grid gap-4 py-2'>
            <FormTextField
              name='title'
              label='제목'
              placeholder='할 일 제목'
              required
              disabled={createMutation.isPending}
            />
            <FormTextareaField
              name='notes'
              label='설명'
              placeholder='설명 (선택)'
              rows={4}
              disabled={createMutation.isPending}
            />
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
              >
                취소
              </Button>
              <form.SubmitButton disabled={createMutation.isPending}>추가</form.SubmitButton>
            </DialogFooter>
          </form.Form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
