'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { UserProvisionSheet } from './user-provision-sheet';

export function UserProvisionTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type='button'
        onClick={() => setOpen(true)}
        data-testid='user-provision-trigger'
      >
        <Icons.add className='mr-2 h-4 w-4' />
        사용자 추가
      </Button>
      <UserProvisionSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
