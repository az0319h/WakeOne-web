'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/components/ui/tanstack-form';
import { notifyError, notifySuccess } from '@/lib/notify';
import { createClient } from '@/lib/supabase/client';
import { setPasswordSchema } from '../schemas/set-password';

async function establishInviteSession() {
  const supabase = createClient();

  if (typeof window === 'undefined') {
    return { ok: true as const };
  }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      return { ok: false as const, message: error.message };
    }

    window.history.replaceState(null, '', window.location.pathname);
    return { ok: true as const };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      message: '초대 링크가 만료되었거나 유효하지 않습니다. 관리자에게 다시 초대를 요청해 주세요.'
    };
  }

  return { ok: true as const };
}

export default function SetPasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await establishInviteSession();
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setSessionError(result.message);
        return;
      }
      setSessionReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const form = useAppForm({
    defaultValues: {
      password: '',
      confirmPassword: ''
    },
    validators: {
      onSubmit: setPasswordSchema
    },
    onSubmit: async ({ value }) => {
      startTransition(async () => {
        const supabase = createClient();
        const { error: updateError } = await supabase.auth.updateUser({
          password: value.password
        });

        if (updateError) {
          notifyError(updateError.message);
          return;
        }

        const { error: rpcError } = await supabase.rpc('mark_password_set');
        if (rpcError) {
          notifyError('비밀번호는 저장되었으나 프로필 갱신에 실패했습니다. 다시 시도해 주세요.');
          return;
        }

        notifySuccess('비밀번호가 설정되었습니다.');
        router.push('/dashboard/overview');
        router.refresh();
      });
    }
  });

  if (sessionError) {
    return (
      <p className='text-destructive text-center text-sm' role='alert'>
        {sessionError}
      </p>
    );
  }

  if (!sessionReady) {
    return <p className='text-muted-foreground text-center text-sm'>초대 정보를 확인하는 중…</p>;
  }

  return (
    <form.AppForm>
      <form.Form className='w-full space-y-2'>
        <form.AppField
          name='password'
          children={(field) => (
            <field.FieldSet>
              <field.Field>
                <field.FieldLabel htmlFor={field.name}>새 비밀번호</field.FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type='password'
                  autoComplete='new-password'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder='8자 이상 입력'
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                />
              </field.Field>
              <field.FieldError />
            </field.FieldSet>
          )}
        />
        <form.AppField
          name='confirmPassword'
          validators={{
            onBlur: z.string().min(1, '비밀번호 확인을 입력해 주세요.')
          }}
          children={(field) => (
            <field.FieldSet>
              <field.Field>
                <field.FieldLabel htmlFor={field.name}>비밀번호 확인</field.FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type='password'
                  autoComplete='new-password'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder='비밀번호를 다시 입력하세요'
                  aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                />
              </field.Field>
              <field.FieldError />
            </field.FieldSet>
          )}
        />
        <Button isLoading={isPending} className='mt-2 ml-auto w-full' type='submit'>
          비밀번호 설정
        </Button>
      </form.Form>
    </form.AppForm>
  );
}
