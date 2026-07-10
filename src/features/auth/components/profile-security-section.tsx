'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { signOut } from '@/features/auth/api/service';
import { ProfilePasswordSheet } from './profile-password-sheet';

export function ProfileSecuritySection() {
  const [passwordOpen, setPasswordOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    window.location.assign('/auth/sign-in');
  }

  return (
    <div className='flex flex-wrap gap-3'>
      <Button
        type='button'
        variant='outline'
        onClick={() => setPasswordOpen(true)}
      >
        <Icons.lock className='mr-2 h-4 w-4' />
        비밀번호 변경
      </Button>
      <Button type='button' variant='outline' onClick={() => void handleSignOut()}>
        <Icons.logout className='mr-2 h-4 w-4' />
        로그아웃
      </Button>
      <ProfilePasswordSheet open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
