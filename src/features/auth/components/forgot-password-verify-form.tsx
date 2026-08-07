'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot
} from '@/components/ui/input-otp';
import { useAppForm } from '@/components/ui/tanstack-form';
import { verifyPasswordResetMutation } from '@/features/auth/api/forgot-password/mutations';
import {
  forgotPasswordVerifyFormDefaultValues,
  forgotPasswordVerifyFormSchema
} from '@/features/auth/schemas/forgot-password-verify-form';
import { notifyError, notifySuccess } from '@/lib/notify';

interface ForgotPasswordVerifyFormProps {
  email: string;
}

export function ForgotPasswordVerifyForm({ email }: ForgotPasswordVerifyFormProps) {
  const router = useRouter();

  const verifyMutation = useMutation(verifyPasswordResetMutation);

  const form = useAppForm({
    defaultValues: forgotPasswordVerifyFormDefaultValues,
    validators: {
      onSubmit: forgotPasswordVerifyFormSchema
    },
    onSubmit: async ({ value }) => {
      try {
        const data = await verifyMutation.mutateAsync({
          email,
          token: value.token
        });
        notifySuccess(data.message);
        form.reset(forgotPasswordVerifyFormDefaultValues);
        router.push('/auth/sign-in');
      } catch (error) {
        notifyError(error instanceof Error ? error.message : '인증에 실패했습니다.');
      }
    }
  });

  return (
    <form.AppForm>
      <form.Form className='w-full space-y-4'>
        <form.AppField
          name='token'
          children={(field) => (
            <field.FieldSet>
              <field.Field>
                <field.FieldLabel htmlFor='forgot-password-otp-input'>
                  인증번호
                </field.FieldLabel>
                <InputOTP
                  id='forgot-password-otp-input'
                  data-testid='forgot-password-otp-input'
                  maxLength={6}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  disabled={verifyMutation.isPending}
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </field.Field>
              <field.FieldError />
            </field.FieldSet>
          )}
        />
        <Button isLoading={verifyMutation.isPending} className='w-full' type='submit'>
          인증하기
        </Button>
      </form.Form>
    </form.AppForm>
  );
}
