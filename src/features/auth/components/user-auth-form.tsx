'use client';

import { Suspense, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppForm } from '@/components/ui/tanstack-form';
import { notifyError, notifySuccess } from '@/lib/notify';
import { signInWithEmail } from '@/features/auth/api/service';
import { LoginDomainCombobox } from '@/features/auth/components/login-domain-combobox';
import {
  buildSignInEmail,
  signInFormDefaultValues,
  signInFormSchema
} from '@/features/auth/schemas/sign-in-form';
import { sanitizeRedirectTo } from '@/lib/auth/safe-redirect';

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

function SignInEmailFieldErrors({
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

function UserAuthFormFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const redirectTo = sanitizeRedirectTo(
    searchParams.get('redirectTo'),
    '/dashboard/overview'
  );

  const form = useAppForm({
    defaultValues: signInFormDefaultValues,
    validators: {
      onSubmit: signInFormSchema
    },
    onSubmit: async ({ value }) => {
      startTransition(async () => {
        const email = buildSignInEmail(value.localPart, value.domain);
        const result = await signInWithEmail({
          email,
          password: value.password
        });

        if (!result.ok) {
          notifyError(result.message);
          return;
        }

        notifySuccess('로그인되었습니다.');
        form.reset(signInFormDefaultValues);
        router.push(redirectTo);
        router.refresh();
      });
    }
  });

  return (
    <form.AppForm>
      <form.Form className='w-full space-y-2'>
        <div className='space-y-2'>
          <Label htmlFor='localPart'>아이디</Label>
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
                    disabled={isPending}
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
              <SignInEmailFieldErrors localErrors={localErrors} domainErrors={domainErrors} />
            )}
          />
        </div>
        <form.AppField
          name='password'
          children={(field) => (
            <field.FieldSet>
              <field.Field>
                <field.FieldLabel htmlFor={field.name}>비밀번호</field.FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type='password'
                  autoComplete='current-password'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder='비밀번호를 입력하세요'
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                />
              </field.Field>
              <field.FieldError />
            </field.FieldSet>
          )}
        />
        <Button isLoading={isPending} className='mt-2 ml-auto w-full' type='submit'>
          로그인
        </Button>
      </form.Form>
    </form.AppForm>
  );
}

export default function UserAuthForm() {
  return (
    <Suspense fallback={<div className='text-muted-foreground text-sm'>로딩 중…</div>}>
      <UserAuthFormFields />
    </Suspense>
  );
}
