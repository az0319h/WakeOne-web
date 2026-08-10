'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
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
import { deleteAnnouncementMutation } from '../api/mutations';
import type { AnnouncementListItem } from '../api/types';

interface AnnouncementRowActionProps {
  announcement: AnnouncementListItem;
  onView: (announcement: AnnouncementListItem) => void;
  onEdit: (announcementId: number) => void;
  onDeleted?: () => void;
}

export function AnnouncementRowAction({
  announcement,
  onView,
  onEdit,
  onDeleted
}: AnnouncementRowActionProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    ...deleteAnnouncementMutation,
    onSuccess: () => {
      notifySuccess('공지가 삭제되었습니다.');
      setDeleteOpen(false);
      router.refresh();
      onDeleted?.();
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '공지 삭제에 실패했습니다.');
    }
  });

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(announcement.id)}
        loading={deleteMutation.isPending}
        title='공지를 삭제할까요?'
        description={`"${announcement.title}" 공지를 영구 삭제합니다.`}
        confirmLabel='삭제'
        cancelLabel='취소'
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='h-8 w-8 shrink-0 p-0'
            data-testid={`announcement-row-action-${announcement.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <span className='sr-only'>공지 작업 메뉴 열기</span>
            <Icons.ellipsis className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' onClick={(event) => event.stopPropagation()}>
          <DropdownMenuLabel>작업</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onView(announcement)}>
            <Icons.post className='mr-2 h-4 w-4' />
            상세 보기
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(announcement.id)}>
            <Icons.edit className='mr-2 h-4 w-4' />
            수정
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteOpen(true)}>
            <Icons.trash className='mr-2 h-4 w-4' />
            삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
