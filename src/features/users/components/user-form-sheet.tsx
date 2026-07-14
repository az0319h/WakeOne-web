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
import { useMutation } from '@tanstack/react-query';
import { createUserMutation, updateUserMutation } from '../api/mutations';
import { SELECT_NONE_VALUE, type Affiliation } from '../constants/organization';
import type { User } from '../api/types';
import { Icons } from '@/components/icons';
import { normalizeBirthdayToDateString } from '@/lib/birthday';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  createUserSchema,
  userUpdateSchema,
  type CreateUserFormValues,
  type UserUpdateFormValues
} from '../schemas/user';
import {
  UserCreateFormFields,
  UserEditFormFields
} from './user-edit-form-fields';

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

function UserEditForm({
  user,
  onSuccess,
  onError,
  onPendingChange
}: UserEditFormProps) {
  const updateMutation = useMutation({
    ...updateUserMutation,
    onSuccess: () => {
      notifySuccess('사용자 정보가 저장되었습니다.');
      editForm.reset();
      onSuccess();
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '저장에 실패했습니다.';
      onError(message);
      notifyError(message);
    }
  });

  useEffect(() => {
    onPendingChange(updateMutation.isPending);
  }, [onPendingChange, updateMutation.isPending]);

  const editForm = useAppForm({
    defaultValues: {
      full_name: user.full_name,
      avatar_url: user.avatar_url ?? '',
      affiliation: toFormAffiliation(user.affiliation),
      rank: toFormOrgField(user.rank),
      system_role: user.system_role,
      birthday: normalizeBirthdayToDateString(user.birthday) ?? null
    } as UserUpdateFormValues,
    validators: {
      onSubmit: userUpdateSchema
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        id: user.id,
        values: {
          ...(value.full_name?.trim()
            ? { full_name: value.full_name.trim() }
            : {}),
          avatar_url: toPayloadValue(value.avatar_url),
          affiliation:
            value.affiliation && value.affiliation !== SELECT_NONE_VALUE
              ? (value.affiliation as Affiliation)
              : null,
          rank: toPayloadValue(value.rank),
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

export function UserFormSheet({
  user,
  open,
  onOpenChange
}: UserFormSheetProps) {
  const isEdit = !!user;
  const [apiError, setApiError] = useState<string | null>(null);
  const [isEditPending, setIsEditPending] = useState(false);

  const createMutation = useMutation({
    ...createUserMutation,
    onSuccess: () => {
      notifySuccess('사용자가 추가되었습니다.');
      createForm.reset();
      onOpenChange(false);
      setApiError(null);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : '사용자 추가에 실패했습니다.';
      setApiError(message);
      notifyError(message);
    }
  });

  const createForm = useAppForm({
    defaultValues: {
      email: '',
      full_name: '',
      affiliation: '',
      rank: '',
      system_role: '',
      birthday: null
    } as CreateUserFormValues,
    validators: {
      onSubmit: createUserSchema
    },
    onSubmit: async ({ value }) => {
      setApiError(null);
      await createMutation.mutateAsync({
        email: value.email.trim().toLowerCase(),
        full_name: value.full_name.trim(),
        affiliation: value.affiliation as Affiliation,
        rank: value.rank.trim(),
        system_role: value.system_role as 'admin' | 'user',
        birthday: value.birthday ?? ''
      });
    }
  });

  const isPending = createMutation.isPending || isEditPending;
  const SubmitIcon = isEdit ? Icons.edit : Icons.add;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '사용자 수정' : '사용자 추가'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? '이름·아바타 URL·소속·부서/사업장·시스템 역할·생일을 수정합니다.'
              : '이름·이메일·소속·부서/사업장·시스템 역할·생일을 입력해 계정을 직접 생성합니다.'}
          </SheetDescription>
        </SheetHeader>

        {apiError ? (
          <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600'>
            {apiError}
          </div>
        ) : null}

        <div className='min-h-0 flex-1 overflow-auto'>
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
            <createForm.AppForm>
              <createForm.Form id='user-form-sheet' className='space-y-4'>
                <UserCreateFormFields />
              </createForm.Form>
            </createForm.AppForm>
          )}
        </div>

        <SheetFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button type='submit' form='user-form-sheet' isLoading={isPending}>
            <SubmitIcon className='mr-2 h-4 w-4' />
            {isEdit ? '저장' : '사용자 추가'}
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
        <Icons.add className='mr-2 h-4 w-4' />
        사용자 추가
      </Button>
      <UserFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
