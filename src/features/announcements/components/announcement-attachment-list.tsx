'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { formatAbsoluteDateKoOrPlaceholder } from '@/lib/format-date';
import { notifyError } from '@/lib/notify';
import { formatBytes } from '@/lib/utils';
import { deleteAnnouncementAttachmentMutation } from '../api/mutations';
import {
  canOpenAnnouncementAttachment,
  downloadAnnouncementAttachment,
  openAnnouncementAttachment
} from '../api/service';
import type { AnnouncementAttachmentSummary } from '../api/types';

interface AnnouncementAttachmentListProps {
  announcementId: number;
  attachments: AnnouncementAttachmentSummary[];
  canDelete?: boolean;
  onAttachmentsChange?: () => void;
}

function AnnouncementAttachmentRow({
  announcementId,
  attachment,
  canDelete,
  onDeleted
}: {
  announcementId: number;
  attachment: AnnouncementAttachmentSummary;
  canDelete?: boolean;
  onDeleted?: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canOpen = canOpenAnnouncementAttachment(attachment);

  const deleteMutation = useMutation({
    ...deleteAnnouncementAttachmentMutation,
    onSuccess: () => {
      setDeleteOpen(false);
      onDeleted?.();
    },
    onError: (error) => {
      notifyError(
        error instanceof Error ? error.message : '첨부파일 삭제에 실패했습니다.'
      );
    }
  });

  async function handleDownload() {
    try {
      const blob = await downloadAnnouncementAttachment(announcementId, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '첨부파일 다운로드에 실패했습니다.';
      notifyError(message);
    }
  }

  function handleOpen() {
    if (!openAnnouncementAttachment(announcementId, attachment.id)) {
      notifyError('첨부파일을 새 탭으로 열 수 없습니다.');
    }
  }

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          deleteMutation.mutate({
            announcementId,
            attachmentId: attachment.id
          })
        }
        loading={deleteMutation.isPending}
        title='첨부파일을 삭제할까요?'
        description={`"${attachment.file_name}" 파일을 영구 삭제합니다.`}
        confirmLabel='삭제'
        cancelLabel='취소'
      />
      <div className='w-full min-w-0 space-y-3 rounded-md border p-3'>
        <div className='min-w-0'>
          <div className='flex items-start gap-2'>
            <Icons.paperclip className='mt-0.5 h-4 w-4 shrink-0' />
            <div className='min-w-0 flex-1'>
              <p className='text-sm leading-snug font-medium break-all'>
                {attachment.file_name}
              </p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {formatBytes(attachment.file_size)} ·{' '}
                {formatAbsoluteDateKoOrPlaceholder(attachment.created_at)}
              </p>
            </div>
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          {canOpen ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              aria-label={`${attachment.file_name} 바로가기`}
              onClick={handleOpen}
            >
              <Icons.externalLink className='h-4 w-4' />
              바로가기
            </Button>
          ) : null}
          <Button
            type='button'
            variant='outline'
            size='sm'
            aria-label={`${attachment.file_name} 다운로드`}
            onClick={handleDownload}
          >
            <Icons.download className='h-4 w-4' />
            다운로드
          </Button>
          {canDelete ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              aria-label={`${attachment.file_name} 삭제`}
              onClick={() => setDeleteOpen(true)}
            >
              <Icons.trash className='h-4 w-4' />
              삭제
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function AnnouncementAttachmentList({
  announcementId,
  attachments,
  canDelete = false,
  onAttachmentsChange
}: AnnouncementAttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <p className='text-muted-foreground text-sm' data-testid='announcement-no-attachments'>
        첨부파일이 없습니다.
      </p>
    );
  }

  return (
    <div className='space-y-2' data-testid='announcement-attachment-list'>
      {attachments.map((attachment) => (
        <AnnouncementAttachmentRow
          key={attachment.id}
          announcementId={announcementId}
          attachment={attachment}
          canDelete={canDelete}
          onDeleted={onAttachmentsChange}
        />
      ))}
    </div>
  );
}
