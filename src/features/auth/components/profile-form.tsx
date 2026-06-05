'use client';

import { useRouter } from 'next/navigation';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { notifyError, notifySuccess } from '@/lib/notify';
import { patchProfileMutation } from '@/features/auth/api/mutations';
import type { AuthProfile } from '@/features/auth/api/types';

const profileSchema = z.object({
  first_name: z.string().max(100),
  last_name: z.string().max(100),
  phone: z.string().max(50).optional(),
  food_restrictions: z.string().max(200).optional()
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  profile: AuthProfile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();

  const mutation = useMutation({
    ...patchProfileMutation,
    onSuccess: () => {
      notifySuccess('프로필이 저장되었습니다.');
      router.refresh();
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '프로필 저장에 실패했습니다.');
    }
  });

  const form = useAppForm({
    defaultValues: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone: profile.phone ?? '',
      food_restrictions: profile.food_restrictions ?? ''
    } as ProfileFormValues,
    validators: {
      onSubmit: profileSchema
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        first_name: value.first_name.trim(),
        last_name: value.last_name.trim(),
        phone: value.phone?.trim() ? value.phone.trim() : null,
        food_restrictions: value.food_restrictions?.trim()
          ? value.food_restrictions.trim()
          : null
      });
    }
  });

  const { FormTextField, FormTextareaField } = useFormFields<ProfileFormValues>();

  return (
    <form.AppForm>
      <form.Form className='max-w-lg space-y-4 p-0'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <FormTextField name='first_name' label='이름' placeholder='이름' />
          <FormTextField name='last_name' label='성' placeholder='성' />
        </div>
        <FormTextField name='phone' label='연락처' type='tel' placeholder='010-0000-0000' />
        <FormTextareaField
          name='food_restrictions'
          label='못 먹는 음식'
          placeholder='알레르기·식이 제한 사항을 입력해 주세요.'
          maxLength={200}
          rows={3}
        />
        <Button type='submit' isLoading={mutation.isPending}>
          저장
        </Button>
      </form.Form>
    </form.AppForm>
  );
}
