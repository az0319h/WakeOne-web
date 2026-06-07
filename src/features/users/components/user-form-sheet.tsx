'use client';

import { useEffect, useState } from 'react';
import { useAppForm } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Icons } from '@/components/icons';
import { useMutation } from '@tanstack/react-query';
import { inviteUserMutation, updateUserMutation } from '../api/mutations';
import { SELECT_NONE_VALUE, type Affiliation } from '../constants/organization';
import type { User } from '../api/types';
import { Input } from '@/components/ui/input';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  inviteUserSchema,
  userUpdateSchema,
  type InviteUserFormValues,
  type UserUpdateFormValues
} from '../schemas/user';
import { UserEditFormFields } from './user-edit-form-fields';

interface UserFormSheetProps {
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toFormAffiliation(
  value: Affiliation | null | undefined
): Affiliation | typeof SELECT_NONE_VALUE {
  return value ?? SELECT_NONE_VALUE;
}

function toFormOrgField(value: string | null | undefined): string {
  return value ?? SELECT_NONE_VALUE;
}

function toPayloadValue(value: string | undefined) {
  if (!value || value === SELECT_NONE_VALUE) return null;
  return value.trim() ? value.trim() : null;
}

interface UserEditFormProps {
  user: User;
  onSuccess: () => void;
  onError: (message: string) => void;
  onPendingChange: (pending: boolean) => void;
}

function UserEditForm({ user, onSuccess, onError, onPendingChange }: UserEditFormProps) {
  const updateMutation = useMutation({
    ...updateUserMutation,
    onSuccess: () => {
      notifySuccess('사용자 정보가 저장되었습니다.');
      onSuccess();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.';
      onError(message);
      notifyError(message);
    }
  });

  useEffect(() => {
    onPendingChange(updateMutation.isPending);
  }, [onPendingChange, updateMutation.isPending]);

  const editForm = useAppForm({
    defaultValues: {
      avatar_url: user.avatar_url ?? '',
      affiliation: toFormAffiliation(user.affiliation),
      department: toFormOrgField(user.department),
      rank: toFormOrgField(user.rank),
      job_title: toFormOrgField(user.job_title),
      system_role: user.system_role,
      birthday: user.birthday ?? null
    } as UserUpdateFormValues,
    validators: {
      onSubmit: userUpdateSchema
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        id: user.id,
        values: {
          avatar_url: toPayloadValue(value.avatar_url),
          affiliation:
            value.affiliation && value.affiliation !== SELECT_NONE_VALUE
              ? (value.affiliation as Affiliation)
              : null,
          department: toPayloadValue(value.department),
          rank: toPayloadValue(value.rank),
          job_title: toPayloadValue(value.job_title),
          system_role: value.system_role,
          birthday: value.birthday ?? null
        }
      });
    }
  });

  return (
    <editForm.AppForm>
      <editForm.Form id='user-form-sheet' className='space-y-4'>
        <UserEditFormFields />
      </editForm.Form>
    </editForm.AppForm>
  );
}

export function UserFormSheet({ user, open, onOpenChange }: UserFormSheetProps) {
  const isEdit = !!user;
  const [apiError, setApiError] = useState<string | null>(null);
  const [isEditPending, setIsEditPending] = useState(false);

  const inviteMutation = useMutation({
    ...inviteUserMutation,
    onSuccess: (data) => {
      notifySuccess(data.message ?? '초대 메일을 발송했습니다. 임시 비밀번호가 포함되어 있습니다.');
      onOpenChange(false);
      inviteForm.reset();
      setApiError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '초대에 실패했습니다.';
      setApiError(message);
      notifyError(message);
    }
  });

  const inviteForm = useAppForm({
    defaultValues: {
      email: ''
    } as InviteUserFormValues,
    validators: {
      onSubmit: inviteUserSchema
    },
    onSubmit: async ({ value }) => {
      setApiError(null);
      await inviteMutation.mutateAsync({ email: value.email.trim().toLowerCase() });
    }
  });

  const isPending = inviteMutation.isPending || isEditPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '사용자 수정' : '사용자 초대'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? '아바타 URL·소속·부서·직급·직책·시스템 역할·생일을 수정합니다.'
              : '이메일만 입력하면 임시 비밀번호가 포함된 초대 메일이 발송됩니다. 수신자는 로그인 페이지에서 바로 로그인할 수 있습니다.'}
          </SheetDescription>
        </SheetHeader>

        {apiError ? (
          <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600'>
            {apiError}
          </div>
        ) : null}

        <div className='flex-1 overflow-auto'>
          {isEdit && user ? (
            <UserEditForm
              key={user.id}
              user={user}
              onSuccess={() => {
                onOpenChange(false);
                setApiError(null);
              }}
              onError={(message) => setApiError(message)}
              onPendingChange={setIsEditPending}
            />
          ) : (
            <inviteForm.AppForm>
              <inviteForm.Form id='user-form-sheet' className='space-y-4'>
                <inviteForm.AppField
                  name='email'
                  children={(field) => (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>
                          이메일 <span className='text-destructive'>*</span>
                        </field.FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type='email'
                          autoComplete='email'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder='user@example.com'
                          aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                        />
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  )}
                />
              </inviteForm.Form>
            </inviteForm.AppForm>
          )}
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type='submit' form='user-form-sheet' isLoading={isPending}>
            <Icons.check className='mr-2 h-4 w-4' />
            {isEdit ? '저장' : '초대 보내기'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function UserFormSheetTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> 사용자 초대
      </Button>
      <UserFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
