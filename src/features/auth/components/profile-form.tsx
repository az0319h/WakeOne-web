'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as z from 'zod';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { notifyError, notifySuccess } from '@/lib/notify';
import { patchProfile } from '@/features/auth/api/profile.client';
import type { AuthProfile } from '@/features/auth/api/types';

const profileSchema = z.object({
  first_name: z.string().max(100),
  last_name: z.string().max(100),
  phone: z.string().max(50).optional()
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  profile: AuthProfile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useAppForm({
    defaultValues: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone: profile.phone ?? ''
    } as ProfileFormValues,
    validators: {
      onSubmit: profileSchema
    },
    onSubmit: async ({ value }) => {
      startTransition(async () => {
        try {
          await patchProfile({
            first_name: value.first_name.trim(),
            last_name: value.last_name.trim(),
            phone: value.phone?.trim() ? value.phone.trim() : null
          });
          notifySuccess('프로필이 저장되었습니다.');
          router.refresh();
        } catch (error) {
          notifyError(error instanceof Error ? error.message : '프로필 저장에 실패했습니다.');
        }
      });
    }
  });

  const { FormTextField } = useFormFields<ProfileFormValues>();

  return (
    <form.AppForm>
      <form.Form className='max-w-lg space-y-4 p-0'>
        <p className='text-muted-foreground text-sm'>
          로그인 이메일: <span className='text-foreground font-medium'>{profile.email}</span>
        </p>
        <div className='grid gap-4 sm:grid-cols-2'>
          <FormTextField name='first_name' label='이름' placeholder='이름' />
          <FormTextField name='last_name' label='성' placeholder='성' />
        </div>
        <FormTextField name='phone' label='연락처' type='tel' placeholder='010-0000-0000' />
        <Button type='submit' isLoading={isPending}>
          저장
        </Button>
      </form.Form>
    </form.AppForm>
  );
}
