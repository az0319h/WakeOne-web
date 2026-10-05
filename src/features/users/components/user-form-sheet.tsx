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
import { updateUserMutation } from '../api/mutations';
import {
  normalizeLeaderRole,
  SELECT_NONE_VALUE,
  type Affiliation
} from '../constants/organization';
import type { User } from '../api/types';
import { Icons } from '@/components/icons';
import { normalizeBirthdayToDateString } from '@/lib/birthday';
import { notifyError, notifySuccess } from '@/lib/notify';
import { PHONE_REGEX, parsePhoneDigits } from '@/lib/phone';
import {
  adminUserUpdateSchema,
  userUpdateSchema,
  type AdminUserUpdateFormValues,
  type UserUpdateFormValues
} from '../schemas/user';
import { UserAdminEditFormFields } from './user-admin-edit-form-fields';
import { UserEditOrgFormFields } from './user-org-form-fields';

interface UserFormSheetProps {
  user: User;
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

function toFormPhone(value: string | null | undefined): string {
  const digits = parsePhoneDigits(value ?? '');
  return PHONE_REGEX.test(digits) ? digits : '';
}

interface UserEditFormProps {
  user: User;
  onSuccess: () => void;
  onError: (message: string) => void;
  onPendingChange: (pending: boolean) => void;
}

function UserTargetEditForm({
  user,
  onSuccess,
  onError,
  onPendingChange
}: UserEditFormProps) {
  const editForm = useAppForm({
    defaultValues: {
      full_name: user.full_name,
      avatar_url: user.avatar_url ?? '',
      affiliation: toFormAffiliation(user.affiliation),
      rank: toFormOrgField(user.rank),
      position_level: toFormOrgField(user.position_level),
      leader_role: user.leader_role ?? SELECT_NONE_VALUE,
      system_role: user.system_role,
      birthday: normalizeBirthdayToDateString(user.birthday) ?? null,
      phone: toFormPhone(user.phone)
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
          position_level: toPayloadValue(value.position_level),
          leader_role: normalizeLeaderRole(value.leader_role),
          system_role: value.system_role,
          birthday: value.birthday ?? null,
          phone: value.phone
        }
      });
    }
  });

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

  return (
    <editForm.AppForm>
      <editForm.Form id='user-form-sheet' className='space-y-4'>
        <UserEditOrgFormFields />
      </editForm.Form>
    </editForm.AppForm>
  );
}

function AdminTargetEditForm({
  user,
  onSuccess,
  onError,
  onPendingChange
}: UserEditFormProps) {
  const editForm = useAppForm({
    defaultValues: {
      avatar_url: user.avatar_url ?? '',
      system_role: user.system_role
    } as AdminUserUpdateFormValues,
    validators: {
      onSubmit: adminUserUpdateSchema
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        id: user.id,
        values: {
          avatar_url: toPayloadValue(value.avatar_url),
          system_role: value.system_role
        }
      });
    }
  });

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

  return (
    <editForm.AppForm>
      <editForm.Form id='user-form-sheet' className='space-y-4'>
        <UserAdminEditFormFields fullName={user.full_name} />
      </editForm.Form>
    </editForm.AppForm>
  );
}

export function UserFormSheet({ user, open, onOpenChange }: UserFormSheetProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [isEditPending, setIsEditPending] = useState(false);
  const isAdminTarget = user.system_role === 'admin';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col'>
        <SheetHeader>
          <SheetTitle>사용자 수정</SheetTitle>
          <SheetDescription>
            {isAdminTarget
              ? '관리자 계정의 아바타 URL과 시스템 역할만 수정할 수 있습니다.'
              : '이름·연락처·아바타 URL·소속·부서/사업장·직급·리더·시스템 역할·생일을 수정합니다.'}
          </SheetDescription>
        </SheetHeader>

        {apiError ? (
          <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600'>
            {apiError}
          </div>
        ) : null}

        <div className='min-h-0 flex-1 overflow-auto'>
          {isAdminTarget ? (
            <AdminTargetEditForm
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
            <UserTargetEditForm
              key={user.id}
              user={user}
              onSuccess={() => {
                onOpenChange(false);
                setApiError(null);
              }}
              onError={(message) => setApiError(message)}
              onPendingChange={setIsEditPending}
            />
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
          <Button type='submit' form='user-form-sheet' isLoading={isEditPending}>
            <Icons.edit className='mr-2 h-4 w-4' />
            저장
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
