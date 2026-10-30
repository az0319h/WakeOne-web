'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import {
  deleteGoogleTaskMutation,
  updateGoogleTaskMutation
} from '@/features/google-tasks/api/mutations';
import type { GoogleTask } from '@/lib/google-tasks/types';
import { notifySuccess } from '@/lib/notify';

const taskFormSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해 주세요.').max(1024, '1024자 이하로 입력해 주세요.'),
  notes: z.string().max(8192, '8192자 이하로 입력해 주세요.')
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface EditGoogleTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Pick<GoogleTask, 'id' | 'title' | 'notes'>;
  tasklistId: string;
}

export function EditGoogleTaskDialog({
  open,
  onOpenChange,
  task,
  tasklistId
}: EditGoogleTaskDialogProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const updateMutation = useMutation({
    ...updateGoogleTaskMutation,
    onSuccess: (_data, variables) => {
      notifySuccess('할 일을 수정했습니다.');
      form.reset({
        title: variables.payload.title ?? task.title,
        notes: variables.payload.notes ?? ''
      });
      onOpenChange(false);
    }
  });

  const deleteMutation = useMutation({
    ...deleteGoogleTaskMutation,
    onSuccess: () => {
      notifySuccess('할 일을 삭제했습니다.');
      setDeleteOpen(false);
      onOpenChange(false);
    }
  });

  const form = useAppForm({
    defaultValues: {
      title: task.title,
      notes: task.notes ?? ''
    } satisfies TaskFormValues,
    validators: {
      onSubmit: taskFormSchema
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        taskId: task.id,
        payload: {
          tasklistId,
          title: value.title.trim(),
          notes: value.notes.trim()
        }
      });
    }
  });

  const { FormTextField, FormTextareaField } = useFormFields<TaskFormValues>();
  const isPending = updateMutation.isPending || deleteMutation.isPending;
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened || form.state.isDirty) {
      return;
    }
    form.reset({
      title: task.title,
      notes: task.notes ?? ''
    });
  }, [open, task.title, task.notes, form]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className='flex max-h-[90dvh] flex-col sm:max-w-[425px]'
          data-testid='kanban-edit-task-dialog'
        >
          <DialogHeader className='shrink-0'>
            <DialogTitle>할 일 수정</DialogTitle>
            <DialogDescription>제목과 설명을 수정합니다.</DialogDescription>
          </DialogHeader>
          <form.AppForm>
            <form.Form className='flex min-h-0 flex-1 flex-col gap-4'>
              <ScrollArea className='-mx-1 flex min-h-0 flex-1 flex-col'>
                <div className='grid gap-4 px-1 py-2'>
                  <FormTextField
                    name='title'
                    label='제목'
                    placeholder='할 일 제목'
                    required
                    disabled={isPending}
                  />
                  <FormTextareaField
                    name='notes'
                    label='설명'
                    placeholder='설명 (선택)'
                    rows={4}
                    className='max-h-60 min-h-32 overflow-y-auto'
                    disabled={isPending}
                  />
                </div>
              </ScrollArea>
              <DialogFooter className='shrink-0'>
                <Button
                  type='button'
                  variant='destructive'
                  onClick={() => setDeleteOpen(true)}
                  disabled={isPending}
                  data-testid='kanban-delete-task-trigger'
                >
                  <Icons.trash className='mr-2 h-4 w-4' />
                  삭제
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  취소
                </Button>
                <form.SubmitButton disabled={isPending}>저장</form.SubmitButton>
              </DialogFooter>
            </form.Form>
          </form.AppForm>
        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate({ taskId: task.id, tasklistId })}
        loading={deleteMutation.isPending}
        title='할 일 삭제'
        description={`「${task.title}」 할 일을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel='삭제'
        cancelLabel='취소'
      />
    </>
  );
}
