'use client';

import { Suspense, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/components/ui/tanstack-form';
import { notifyError, notifySuccess } from '@/lib/notify';
import { signInWithEmail } from '@/features/auth/api/service';
import { sanitizeRedirectTo } from '@/lib/auth/safe-redirect';

const formSchema = z.object({
  email: z.string().email({ message: '올바른 이메일 주소를 입력해 주세요.' }),
  password: z.string().min(1, { message: '비밀번호를 입력해 주세요.' })
});

function UserAuthFormFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const redirectTo = sanitizeRedirectTo(
    searchParams.get('redirectTo'),
    '/dashboard/overview'
  );

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: ''
    },
    validators: {
      onSubmit: formSchema
    },
    onSubmit: async ({ value }) => {
      startTransition(async () => {
        const result = await signInWithEmail({
          email: value.email,
          password: value.password
        });

        if (!result.ok) {
          notifyError(result.message);
          return;
        }

        notifySuccess('로그인되었습니다.');
        form.reset();
        router.push(redirectTo);
        router.refresh();
      });
    }
  });

  return (
    <form.AppForm>
      <form.Form className='w-full space-y-2'>
        <form.AppField
          name='email'
          children={(field) => (
            <field.FieldSet>
              <field.Field>
                <field.FieldLabel htmlFor={field.name}>이메일</field.FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type='email'
                  autoComplete='email'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder='이메일을 입력하세요'
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                />
              </field.Field>
              <field.FieldError />
            </field.FieldSet>
          )}
        />
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
                  onChange={(e) => field.handleChange(e.target.value)}
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
