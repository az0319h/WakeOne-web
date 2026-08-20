'use client';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useSupportSheet } from './support-sheet-context';

export function SupportFormSheetTrigger() {
  const { setFormOpen } = useSupportSheet();

  return (
    <Button
      type='button'
      onClick={() => setFormOpen(true)}
      data-testid='support-create-button'
    >
      <Icons.add className='mr-2 h-4 w-4' />
      문의하기
    </Button>
  );
}
