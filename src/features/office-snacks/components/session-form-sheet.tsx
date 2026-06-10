'use client';

import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Icons } from '@/components/icons';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  createOfficeSnackSessionMutation,
  updateOfficeSnackSessionMutation
} from '../api/mutations';
import type { OfficeSnackSession } from '../api/types';
import {
  officeSnackSessionSchema,
  type OfficeSnackSessionFormValues
} from '../schemas/office-snack';

interface SessionFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: OfficeSnackSession | null;
}

function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoFromInput(value: string): string {
  return new Date(value).toISOString();
}

const EMPTY_SESSION_FORM_VALUES: OfficeSnackSessionFormValues = {
  title: '',
  description: '',
  registration_start_at: '',
  registration_end_at: '',
  voting_start_at: '',
  voting_end_at: ''
};

export function SessionFormSheet({ open, onOpenChange, session }: SessionFormSheetProps) {
  const isEdit = !!session;
  const [apiError, setApiError] = useState<string | null>(null);

  const createMutation = useMutation({
    ...createOfficeSnackSessionMutation,
    onSuccess: () => {
      notifySuccess('회차를 생성했습니다.');
      onOpenChange(false);
      setApiError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '회차 생성에 실패했습니다.';
      setApiError(message);
      notifyError(message);
    }
  });

  const updateMutation = useMutation({
    ...updateOfficeSnackSessionMutation,
    onSuccess: () => {
      notifySuccess('회차를 수정했습니다.');
      onOpenChange(false);
      setApiError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '회차 수정에 실패했습니다.';
      setApiError(message);
      notifyError(message);
    }
  });

  const defaultValues = useMemo<OfficeSnackSessionFormValues>(
    () => ({
      title: session?.title ?? '',
      description: session?.description ?? '',
      registration_start_at: session ? toLocalDateTimeInput(session.registration_start_at) : '',
      registration_end_at: session ? toLocalDateTimeInput(session.registration_end_at) : '',
      voting_start_at: session ? toLocalDateTimeInput(session.voting_start_at) : '',
      voting_end_at: session ? toLocalDateTimeInput(session.voting_end_at) : ''
    }),
    [session]
  );

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: officeSnackSessionSchema
    },
    onSubmit: async ({ value }) => {
      setApiError(null);
      const payload = {
        title: value.title.trim(),
        description: value.description?.trim() ? value.description.trim() : null,
        registration_start_at: toIsoFromInput(value.registration_start_at),
        registration_end_at: toIsoFromInput(value.registration_end_at),
        voting_start_at: toIsoFromInput(value.voting_start_at),
        voting_end_at: toIsoFromInput(value.voting_end_at)
      };

      if (isEdit && session) {
        await updateMutation.mutateAsync({ sessionId: session.id, payload });
        form.reset();
        return;
      }

      await createMutation.mutateAsync(payload);
      form.reset(EMPTY_SESSION_FORM_VALUES);
    }
  });

  const { FormTextField, FormTextareaField } = useFormFields<OfficeSnackSessionFormValues>();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const SubmitIcon = isEdit ? Icons.edit : Icons.add;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setApiError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className='flex min-h-0 flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '회차 수정' : '회차 생성'}</SheetTitle>
          <SheetDescription>
            등록/투표 시작·종료 시각을 입력해 회차 일정을 설정합니다.
          </SheetDescription>
        </SheetHeader>

        {apiError ? (
          <div className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {apiError}
          </div>
        ) : null}

        <form.AppForm>
          <form.Form id='office-snack-session-form' className='flex h-full min-h-0 flex-col'>
            <div className='min-h-0 flex-1 space-y-4 overflow-auto py-2 pr-1'>
              <FormTextField name='title' label='회차 이름' required placeholder='예: 2026년 6월 간식 투표' />
              <FormTextareaField
                name='description'
                label='설명'
                placeholder='운영 메모를 입력해 주세요.'
                rows={3}
                maxLength={500}
              />
              <div className='grid gap-4 md:grid-cols-2'>
                <form.AppField
                  name='registration_start_at'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          등록 시작 <span className='text-destructive'>*</span>
                        </field.FieldLabel>
                        <Input
                          id={field.name}
                          type='datetime-local'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
                <form.AppField
                  name='registration_end_at'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          등록 종료 <span className='text-destructive'>*</span>
                        </field.FieldLabel>
                        <Input
                          id={field.name}
                          type='datetime-local'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
                <form.AppField
                  name='voting_start_at'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          투표 시작 <span className='text-destructive'>*</span>
                        </field.FieldLabel>
                        <Input
                          id={field.name}
                          type='datetime-local'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
                <form.AppField
                  name='voting_end_at'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          투표 종료 <span className='text-destructive'>*</span>
                        </field.FieldLabel>
                        <Input
                          id={field.name}
                          type='datetime-local'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
              </div>
            </div>
          </form.Form>
        </form.AppForm>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type='submit' form='office-snack-session-form' isLoading={isPending}>
            <SubmitIcon className='mr-2 h-4 w-4' />
            {isEdit ? '저장' : '생성'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
