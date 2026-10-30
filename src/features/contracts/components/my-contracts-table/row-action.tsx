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
      className='size-11 p-0 md:h-8 md:w-auto md:px-2'
      onClick={() => onView(data)}
    >
      <Icons.post className='h-4 w-4 md:mr-2' />
      {/* 모바일은 아이콘만(44px) — 접근 이름 「상세 보기」는 유지 */}
      <span className='sr-only md:not-sr-only'>상세 보기</span>
    </Button>
  );
}
