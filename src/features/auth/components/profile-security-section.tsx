'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { notifyError } from '@/lib/notify';
import { signOut } from '@/features/auth/api/service';
import { ProfilePasswordSheet } from './profile-password-sheet';

export function ProfileSecuritySection() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      try {
        await signOut();
        router.push('/auth/sign-in');
        router.refresh();
      } catch {
        notifyError('로그아웃에 실패했습니다.');
      }
    });
  }

  return (
    <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
      <ProfilePasswordSheet />
      <Button
        type='button'
        variant='secondary'
        onClick={handleSignOut}
        isLoading={isPending}
      >
        <Icons.logout className='mr-2 h-4 w-4' />
        로그아웃
      </Button>
    </div>
  );
}
