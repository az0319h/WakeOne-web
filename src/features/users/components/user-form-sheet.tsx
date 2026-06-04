'use client';

import { useState } from 'react';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
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
import type { User } from '../api/types';
import { Input } from '@/components/ui/input';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  inviteUserSchema,
  userUpdateSchema,
  type InviteUserFormValues,
  type UserUpdateFormValues
} from '../schemas/user';
import { SYSTEM_ROLE_OPTIONS } from './users-table/options';

interface UserFormSheetProps {
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserFormSheet({ user, open, onOpenChange }: UserFormSheetProps) {
  const isEdit = !!user;
  const [apiError, setApiError] = useState<string | null>(null);

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

  const updateMutation = useMutation({
    ...updateUserMutation,
    onSuccess: () => {
      notifySuccess('사용자 정보가 저장되었습니다.');
      onOpenChange(false);
      setApiError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.';
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

  const editForm = useAppForm({
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      phone: user?.phone ?? '',
      system_role: user?.system_role ?? 'user'
    } as UserUpdateFormValues,
    validators: {
      onSubmit: userUpdateSchema
    },
    onSubmit: async ({ value }) => {
      if (!user) {
        return;
      }
      setApiError(null);
      await updateMutation.mutateAsync({
        id: user.id,
        values: {
          first_name: value.first_name,
          last_name: value.last_name,
          phone: value.phone || null,
          system_role: value.system_role
        }
      });
    }
  });

  const { FormTextField, FormSelectField } = useFormFields<UserUpdateFormValues>();
  const isPending = inviteMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col'>
        <SheetHeader>
          <SheetTitle>{isEdit ? '사용자 수정' : '사용자 초대'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? '이름·연락처·시스템 역할을 수정합니다.'
              : '이메일만 입력하면 임시 비밀번호가 포함된 초대 메일이 발송됩니다. 수신자는 로그인 페이지에서 바로 로그인할 수 있습니다.'}
          </SheetDescription>
        </SheetHeader>

        {apiError ? (
          <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600'>
            {apiError}
          </div>
        ) : null}

        <div className='flex-1 overflow-auto'>
          {isEdit ? (
            <editForm.AppForm>
              <editForm.Form id='user-form-sheet' className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <FormTextField name='first_name' label='이름' placeholder='이름' />
                  <FormTextField name='last_name' label='성' placeholder='성' />
                </div>
                <FormTextField name='phone' label='연락처' type='tel' placeholder='010-0000-0000' />
                <FormSelectField
                  name='system_role'
                  label='시스템 역할'
                  options={SYSTEM_ROLE_OPTIONS}
                  placeholder='역할 선택'
                />
              </editForm.Form>
            </editForm.AppForm>
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
