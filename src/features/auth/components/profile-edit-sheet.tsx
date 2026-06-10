'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
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
import { notifyError, notifySuccess } from '@/lib/notify';
import { parsePhoneDigits } from '@/lib/phone';
import { patchProfileMutation } from '@/features/auth/api/mutations';
import type { AuthProfile } from '@/features/auth/api/types';
import { profileSchema, type ProfileFormValues } from '@/features/auth/schemas/profile';
import { FormPhoneField } from './phone-field';

interface ProfileEditSheetProps {
  profile: AuthProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toFormPhone(phone: string | null): string {
  if (!phone) {
    return '';
  }

  const digits = parsePhoneDigits(phone);
  return digits || phone;
}

export function ProfileEditSheet({ profile, open, onOpenChange }: ProfileEditSheetProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const mutation = useMutation({
    ...patchProfileMutation,
    onSuccess: () => {
      notifySuccess('프로필이 저장되었습니다.');
      onOpenChange(false);
      router.refresh();
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '프로필 저장에 실패했습니다.');
    }
  });

  useEffect(() => {
    setIsPending(mutation.isPending);
  }, [mutation.isPending]);

  const form = useAppForm({
    defaultValues: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone: toFormPhone(profile.phone),
      birthday: profile.birthday ?? null,
      food_restrictions: profile.food_restrictions ?? ''
    } as ProfileFormValues,
    validators: {
      onSubmit: profileSchema
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        first_name: value.first_name.trim(),
        last_name: value.last_name.trim(),
        phone: value.phone.trim() ? value.phone.trim() : null,
        birthday: value.birthday,
        food_restrictions: value.food_restrictions?.trim()
          ? value.food_restrictions.trim()
          : null
      });
      form.reset();
    }
  });

  const { FormTextField, FormTextareaField, FormBirthdayField } =
    useFormFields<ProfileFormValues>();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex min-h-0 flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>계정 정보 수정</SheetTitle>
          <SheetDescription>
            이름·연락처·생일·못 먹는 음식을 수정할 수 있습니다. 이메일은 변경할 수 없습니다.
          </SheetDescription>
        </SheetHeader>
        <form.AppForm>
          <form.Form id='profile-edit-form' className='flex h-full min-h-0 flex-col'>
            <div className='min-h-0 flex-1 space-y-4 overflow-auto py-4 pr-1'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormTextField name='first_name' label='이름' placeholder='이름' />
                <FormTextField name='last_name' label='성' placeholder='성' />
              </div>
              <FormPhoneField name='phone' label='연락처' />
              <FormBirthdayField name='birthday' label='생일' />
              <FormTextareaField
                name='food_restrictions'
                label='못 먹는 음식'
                placeholder='알레르기·식이 제한 사항을 입력해 주세요.'
                maxLength={200}
                rows={3}
              />
            </div>
          </form.Form>
        </form.AppForm>
        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button type='submit' form='profile-edit-form' isLoading={isPending}>
            <Icons.check className='mr-2 h-4 w-4' />
            저장
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
