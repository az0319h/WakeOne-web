'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { forcePasswordChangeMutation } from '@/features/auth/api/mutations';
import { signOut } from '@/features/auth/api/service';
import {
  forcePasswordChangeDefaultValues,
  forcePasswordChangeSchema,
  type ForcePasswordChangeFormValues
} from '@/features/auth/schemas/force-password';
import { notifyError, notifySuccess } from '@/lib/notify';

export function ForcePasswordChangeForm() {
  const router = useRouter();

  const forceChangeMutation = useMutation({
    ...forcePasswordChangeMutation,
    onError: (error) => {
      notifyError(
        error instanceof Error
          ? error.message
          : '비밀번호 변경에 실패했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.'
      );
    }
  });

  const form = useAppForm({
    defaultValues: forcePasswordChangeDefaultValues,
    validators: {
      onSubmit: forcePasswordChangeSchema
    },
    onSubmit: async ({ value }) => {
      const data = await forceChangeMutation.mutateAsync(value);
      notifySuccess(data.message ?? '비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
      form.reset(forcePasswordChangeDefaultValues);
      await signOut();
      router.push('/auth/sign-in');
      router.refresh();
    }
  });

  const { FormTextField } = useFormFields<ForcePasswordChangeFormValues>();

  return (
    <form.AppForm>
      <form.Form className='w-full space-y-4'>
        <Alert data-testid='force-password-change-alert'>
          <Icons.alertCircle />
          <AlertDescription>
            12341234a 비밀번호는 사용할 수 없습니다. 비밀번호를 변경해 주세요
          </AlertDescription>
        </Alert>
        <FormTextField
          name='new_password'
          label='새 비밀번호'
          id='force-password-new'
          type='password'
          autoComplete='new-password'
          data-testid='force-password-new'
        />
        <FormTextField
          name='confirm_password'
          label='비밀번호 확인'
          id='force-password-confirm'
          type='password'
          autoComplete='new-password'
          data-testid='force-password-confirm'
        />
        <Button
          isLoading={forceChangeMutation.isPending}
          className='w-full'
          type='submit'
          data-testid='force-password-submit'
        >
          비밀번호 변경
        </Button>
      </form.Form>
    </form.AppForm>
  );
}
