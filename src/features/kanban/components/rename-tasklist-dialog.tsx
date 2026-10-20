'use client';

import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { updateGoogleTasklistMutation } from '@/features/google-tasks/api/mutations';
import { notifyError, notifySuccess } from '@/lib/notify';

const tasklistFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '목록 제목을 입력해 주세요.')
    .max(120, '120자 이하로 입력해 주세요.')
});

type TasklistFormValues = z.infer<typeof tasklistFormSchema>;

interface RenameTasklistDialogProps {
  tasklistId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameTasklistDialog({
  tasklistId,
  title,
  open,
  onOpenChange
}: RenameTasklistDialogProps) {
  const updateMutation = useMutation({
    ...updateGoogleTasklistMutation,
    onSuccess: (_data, variables) => {
      notifySuccess('목록 이름을 변경했습니다.');
      form.reset({ title: variables.payload.title });
      onOpenChange(false);
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '목록 이름을 변경하지 못했습니다.');
    }
  });

  const form = useAppForm({
    defaultValues: { title } satisfies TasklistFormValues,
    validators: {
      onSubmit: tasklistFormSchema
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        tasklistId,
        payload: { title: value.title.trim() }
      });
    }
  });

  const { FormTextField } = useFormFields<TasklistFormValues>();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]' data-testid='kanban-rename-tasklist-dialog'>
        <DialogHeader>
          <DialogTitle>이름 바꾸기</DialogTitle>
          <DialogDescription>목록 제목을 수정합니다.</DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form.Form className='grid gap-4 py-2'>
            <FormTextField
              name='title'
              label='목록 제목'
              placeholder='예: 업무'
              required
              disabled={updateMutation.isPending}
            />
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                취소
              </Button>
              <form.SubmitButton disabled={updateMutation.isPending}>저장</form.SubmitButton>
            </DialogFooter>
          </form.Form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
