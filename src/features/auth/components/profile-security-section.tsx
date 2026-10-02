'use client';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { signOut } from '@/features/auth/api/service';

export function ProfileSecuritySection() {
  async function handleSignOut() {
    await signOut();
    window.location.assign('/auth/sign-in');
  }

  return (
    <div className='flex flex-wrap gap-3'>
      <Button type='button' variant='outline' onClick={() => void handleSignOut()}>
        <Icons.logout className='mr-2 h-4 w-4' />
        로그아웃
      </Button>
    </div>
  );
}
