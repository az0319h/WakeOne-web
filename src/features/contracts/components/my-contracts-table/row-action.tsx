'use client';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import type { ContractDocument } from '../../api/types';

interface MyContractRowActionProps {
  data: ContractDocument;
  onView: (contract: ContractDocument) => void;
}

export function MyContractRowAction({ data, onView }: MyContractRowActionProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className='h-8 px-2'
      onClick={() => onView(data)}
    >
      <Icons.post className='mr-2 h-4 w-4' />
      상세 보기
    </Button>
  );
}
