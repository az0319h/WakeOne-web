'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { notifyError, notifySuccess } from '@/lib/notify';
import { softDeleteContractMutation } from '../../api/mutations';
import type { ContractDocument } from '../../api/types';

interface ContractRowActionProps {
  data: ContractDocument;
  onView: (contract: ContractDocument) => void;
  onEdit: (contract: ContractDocument) => void;
}

export function ContractRowAction({ data, onView, onEdit }: ContractRowActionProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isSoftDeleted = data.status === 'soft_deleted';

  const deleteMutation = useMutation({
    ...softDeleteContractMutation,
    onSuccess: () => {
      notifySuccess('계약서가 삭제 처리되었습니다.');
      setDeleteOpen(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '계약서 삭제 처리에 실패했습니다.';
      notifyError(message);
    }
  });

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(data.id)}
        loading={deleteMutation.isPending}
        title='계약서를 삭제 처리할까요?'
        description={`"${data.document_number}" 계약 문서를 목록에서 비활성 처리합니다. 이 작업은 감사 로그에 기록됩니다.`}
        confirmLabel='삭제 처리'
        cancelLabel='취소'
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>계약서 작업 메뉴 열기</span>
            <Icons.ellipsis className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>작업</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onView(data)}>
            <Icons.post className='mr-2 h-4 w-4' /> 상세 보기
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isSoftDeleted} onClick={() => onEdit(data)}>
            <Icons.edit className='mr-2 h-4 w-4' /> 수정
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isSoftDeleted} onClick={() => setDeleteOpen(true)}>
            <Icons.trash className='mr-2 h-4 w-4' /> 삭제 처리
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
