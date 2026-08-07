'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppForm } from '@/components/ui/tanstack-form';
import { requestPasswordResetMutation } from '@/features/auth/api/forgot-password/mutations';
import { LoginDomainCombobox } from '@/features/auth/components/login-domain-combobox';
import {
  forgotPasswordEmailFormDefaultValues,
  forgotPasswordEmailFormSchema
} from '@/features/auth/schemas/forgot-password-email-form';
import { buildSignInEmail } from '@/features/auth/schemas/sign-in-form';
import { notifyError, notifySuccess } from '@/lib/notify';

function stripAtSign(value: string): string {
  return value.replace(/@/g, '');
}

function normalizeFieldErrorMessages(errors: unknown[] | undefined): string[] {
  if (!errors?.length) {
    return [];
  }

  return errors.map((error) => {
    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return String(error);
  });
}

function ForgotPasswordEmailFieldErrors({
  localErrors,
  domainErrors
}: {
  localErrors?: readonly unknown[];
  domainErrors?: readonly unknown[];
}) {
  const messages = [
    ...normalizeFieldErrorMessages(localErrors ? [...localErrors] : undefined),
    ...normalizeFieldErrorMessages(domainErrors ? [...domainErrors] : undefined)
  ].filter((message, index, all) => all.indexOf(message) === index);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className='space-y-1'>
      {messages.map((message) => (
        <p key={message} role='alert' className='text-destructive text-sm font-medium'>
          {message}
        </p>
      ))}
    </div>
  );
}

export function ForgotPasswordEmailForm() {
  const router = useRouter();

  const requestMutation = useMutation(requestPasswordResetMutation);

  const form = useAppForm({
    defaultValues: forgotPasswordEmailFormDefaultValues,
    validators: {
      onSubmit: forgotPasswordEmailFormSchema
    },
    onSubmit: async ({ value }) => {
      const email = buildSignInEmail(value.localPart, value.domain);

      try {
        const data = await requestMutation.mutateAsync({ email });
        notifySuccess(data.message);
        form.reset(forgotPasswordEmailFormDefaultValues);
        router.push(
          `/auth/forgot-password/verify?email=${encodeURIComponent(email)}`
        );
      } catch (error) {
        notifyError(error instanceof Error ? error.message : '요청에 실패했습니다.');
      }
    }
  });

  return (
    <form.AppForm>
      <form.Form className='w-full space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='localPart'>이메일</Label>
          <div className='flex w-full items-end gap-2'>
            <form.AppField
              name='localPart'
              children={(field) => (
                <div className='min-w-0 flex-1'>
                  <Input
                    id='localPart'
                    name={field.name}
                    type='text'
                    autoComplete='username'
                    spellCheck={false}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(stripAtSign(event.target.value))}
                    placeholder='아이디를 입력하세요'
                    aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                    disabled={requestMutation.isPending}
                  />
                </div>
              )}
            />
            <span
              className='text-muted-foreground pb-2 text-sm select-none'
              aria-hidden='true'
            >
              @
            </span>
            <form.AppField
              name='domain'
              children={(field) => (
                <div className='min-w-0 flex-1'>
                  <LoginDomainCombobox
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    isTouched={field.state.meta.isTouched}
                    isValid={field.state.meta.isValid}
                    disabled={requestMutation.isPending}
                  />
                </div>
              )}
            />
          </div>
          <form.Subscribe
            selector={(state) => ({
              localErrors: state.fieldMeta.localPart?.errors,
              domainErrors: state.fieldMeta.domain?.errors
            })}
            children={({ localErrors, domainErrors }) => (
              <ForgotPasswordEmailFieldErrors
                localErrors={localErrors}
                domainErrors={domainErrors}
              />
            )}
          />
        </div>
        <Button
          isLoading={requestMutation.isPending}
          className='w-full'
          type='submit'
        >
          6자리 인증번호 받기
        </Button>
        <p className='text-center text-sm'>
          <Link
            href='/auth/sign-in'
            className='text-muted-foreground hover:text-primary underline-offset-4 hover:underline'
          >
            로그인으로 돌아가기
          </Link>
        </p>
      </form.Form>
    </form.AppForm>
  );
}
