'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Icons } from '@/components/icons';
import { notifyError, notifySuccess } from '@/lib/notify';
import { changePassword } from '@/features/auth/api/profile.client';
import { signOut } from '@/features/auth/api/service';
import {
  changePasswordSchema,
  type ChangePasswordFormValues
} from '@/features/auth/schemas/password';

interface ProfilePasswordSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ProfilePasswordSheet({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: ProfilePasswordSheetProps = {}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const isControlled = controlledOpen !== undefined;
  const [isPending, setIsPending] = useState(false);

  const form = useAppForm({
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: ''
    } as ChangePasswordFormValues,
    validators: {
      onSubmit: changePasswordSchema
    },
    onSubmit: async ({ value }) => {
      setIsPending(true);
      try {
        await changePassword(value);
        notifySuccess('비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
        setOpen(false);
        form.reset();
        await signOut();
        router.push('/auth/sign-in');
        router.refresh();
      } catch (error) {
        notifyError(
          error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.'
        );
      } finally {
        setIsPending(false);
      }
    }
  });

  const { FormTextField } = useFormFields<ChangePasswordFormValues>();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!isControlled ? (
        <SheetTrigger asChild>
          <Button variant='outline' type='button'>
            <Icons.lock className='mr-2 h-4 w-4' />
            비밀번호 변경
          </Button>
        </SheetTrigger>
      ) : null}
      <SheetContent className='flex min-h-0 flex-col'>
        <SheetHeader>
          <SheetTitle>비밀번호 변경</SheetTitle>
          <SheetDescription>
            변경 후 모든 기기에서 로그아웃됩니다. 변경한 비밀번호로 다시 로그인해 주세요.
          </SheetDescription>
        </SheetHeader>
        <form.AppForm>
          <form.Form
            id='profile-password-form'
            className='flex h-full min-h-0 flex-col'
          >
            <div className='min-h-0 flex-1 space-y-4 overflow-auto py-4 pr-1'>
              <FormTextField
                name='current_password'
                label='현재 비밀번호'
                id='profile-password-current'
                type='password'
                autoComplete='current-password'
              />
              <FormTextField
                name='new_password'
                label='새 비밀번호'
                id='profile-password-new'
                type='password'
                autoComplete='new-password'
              />
              <FormTextField
                name='confirm_password'
                label='비밀번호 확인'
                id='profile-password-confirm'
                type='password'
                autoComplete='new-password'
              />
            </div>
          </form.Form>
        </form.AppForm>
        <SheetFooter>
          <Button type='submit' form='profile-password-form' isLoading={isPending}>
            <Icons.check className='mr-2 h-4 w-4' />
            변경 저장
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
