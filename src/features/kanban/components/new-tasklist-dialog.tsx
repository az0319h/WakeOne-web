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
import { createGoogleTasklistMutation } from '@/features/google-tasks/api/mutations';
import { notifyError, notifySuccess } from '@/lib/notify';

const tasklistFormSchema = z.object({
  title: z.string().trim().min(1, '목록 제목을 입력해 주세요.').max(120, '120자 이하로 입력해 주세요.')
});

type TasklistFormValues = z.infer<typeof tasklistFormSchema>;

const EMPTY_DEFAULT_VALUES: TasklistFormValues = {
  title: ''
};

interface NewTasklistDialogProps {
  showTrigger?: boolean;
}

export function NewTasklistDialog({ showTrigger = true }: NewTasklistDialogProps) {
  const [open, setOpen] = useState(false);

  const createMutation = useMutation({
    ...createGoogleTasklistMutation,
    onSuccess: () => {
      notifySuccess('새 목록이 추가되었습니다.');
      form.reset(EMPTY_DEFAULT_VALUES);
      setOpen(false);
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '목록을 추가하지 못했습니다.');
    }
  });

  const form = useAppForm({
    defaultValues: EMPTY_DEFAULT_VALUES,
    validators: {
      onSubmit: tasklistFormSchema
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({ title: value.title.trim() });
    }
  });

  const { FormTextField } = useFormFields<TasklistFormValues>();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant='secondary' size='sm' data-testid='kanban-new-tasklist-trigger'>
            <Icons.add className='mr-2 h-4 w-4' />
            새 목록
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>새 목록</DialogTitle>
          <DialogDescription>Google Tasks에 새 목록을 추가합니다.</DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form.Form className='grid gap-4 py-2'>
            <FormTextField
              name='title'
              label='목록 제목'
              placeholder='예: 업무'
              required
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
              <form.SubmitButton disabled={createMutation.isPending}>저장</form.SubmitButton>
            </DialogFooter>
          </form.Form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}