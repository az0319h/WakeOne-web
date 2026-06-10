'use client';

import { useState } from 'react';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useMutation } from '@tanstack/react-query';
import { notifyError, notifySuccess } from '@/lib/notify';
import { deleteAssetItemMutation } from '../../api/mutations';
import type { AssetItem } from '../../api/types';
import { Icons } from '@/components/icons';

interface AssetItemCellActionProps {
  data: AssetItem;
  currentUserId?: string;
  isAdmin: boolean;
  onEdit: (item: AssetItem) => void;
}

export function AssetItemCellAction({
  data,
  currentUserId,
  isAdmin,
  onEdit
}: AssetItemCellActionProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = isAdmin || currentUserId === data.created_by_id;

  const deleteMutation = useMutation({
    ...deleteAssetItemMutation,
    onSuccess: () => {
      notifySuccess('비품이 삭제되었습니다.');
      setDeleteOpen(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '비품 삭제에 실패했습니다.';
      notifyError(message);
    }
  });

  return (
    <>
      {canDelete ? (
        <AlertModal
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutate(data.id)}
          loading={deleteMutation.isPending}
          title='비품을 삭제할까요?'
          description={`"${data.asset_name}" (${data.asset_number}) 항목을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel='삭제'
          cancelLabel='취소'
        />
      ) : null}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='h-8 w-8 p-0'>
            <span className='sr-only'>Open menu</span>
            <Icons.ellipsis className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuLabel>작업</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onEdit(data)}>
            <Icons.edit className='mr-2 h-4 w-4' /> 수정
          </DropdownMenuItem>
          {canDelete ? (
            <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
              <Icons.trash className='mr-2 h-4 w-4' /> 삭제
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
