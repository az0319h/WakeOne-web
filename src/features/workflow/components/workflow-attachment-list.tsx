'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { notifyError } from '@/lib/notify';
import { formatBytes } from '@/lib/utils';
import { openAttachmentLightbox } from '@/features/attachments/components/attachment-lightbox-provider';
import {
  getAttachmentMediaType,
  isInlineOpenableAttachment
} from '@/features/attachments/api/types';
import { workflowAttachmentDownloadQueryOptions } from '../api/queries';
import type { WorkflowAttachment } from '../api/types';

export function WorkflowFileIcon({ fileName, mimeType }: { fileName: string; mimeType: string | null }) {
  const item = { file_name: fileName, content_type: mimeType };
  if (isInlineOpenableAttachment(item)) {
    return getAttachmentMediaType(item) === 'pdf' ? (
      <Icons.fileTypePdf aria-hidden className='size-5 shrink-0 text-muted-foreground' />
    ) : (
      <Icons.media aria-hidden className='size-5 shrink-0 text-muted-foreground' />
    );
  }
  return <Icons.page aria-hidden className='size-5 shrink-0 text-muted-foreground' />;
}

/** 상세 첨부 — 이미지·PDF는 lightbox, 그 밖은 다운로드 (designer §3.7) */
export function WorkflowAttachmentList({
  documentId,
  attachments
}: {
  documentId: string;
  attachments: WorkflowAttachment[];
}) {
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  async function download(attachment: WorkflowAttachment) {
    setDownloadingId(attachment.id);
    try {
      const result = await queryClient.fetchQuery(
        workflowAttachmentDownloadQueryOptions(documentId, attachment.id)
      );
      const anchor = document.createElement('a');
      anchor.href = result.url;
      anchor.rel = 'noopener';
      anchor.download = result.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '첨부파일을 내려받지 못했습니다.');
    } finally {
      setDownloadingId(null);
    }
  }

  function open(attachment: WorkflowAttachment) {
    const item = { file_name: attachment.file_name, content_type: attachment.mime_type };
    if (!isInlineOpenableAttachment(item)) {
      void download(attachment);
      return;
    }
    openAttachmentLightbox({
      source: { kind: 'workflow', parentId: documentId },
      parentId: documentId,
      attachments: attachments.map((entry) => ({
        id: entry.id,
        file_name: entry.file_name,
        content_type: entry.mime_type
      })),
      initialAttachmentId: attachment.id
    });
  }

  return (
    <section aria-labelledby='workflow-attachments-title' className='flex flex-col gap-2'>
      <h3 id='workflow-attachments-title' className='text-sm font-medium'>
        첨부파일 ({attachments.length})
      </h3>
      <ul className='grid gap-2 sm:grid-cols-2'>
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            data-testid={`workflow-attachment-${attachment.id}`}
            className='flex min-w-0 items-center gap-1 rounded-lg border p-1'
          >
            <Button
              type='button'
              variant='ghost'
              className='h-auto min-h-11 min-w-0 flex-1 justify-start gap-3 px-2 py-1.5 text-left font-normal whitespace-normal'
              onClick={() => open(attachment)}
            >
              <WorkflowFileIcon fileName={attachment.file_name} mimeType={attachment.mime_type} />
              <span className='flex min-w-0 flex-col'>
                <span className='line-clamp-2 text-sm break-all'>{attachment.file_name}</span>
                <span className='text-xs text-muted-foreground tabular-nums'>
                  {formatBytes(attachment.size_bytes)}
                </span>
              </span>
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label={`${attachment.file_name} 다운로드`}
              className='size-10 shrink-0 text-muted-foreground'
              isLoading={downloadingId === attachment.id}
              onClick={() => void download(attachment)}
            >
              <Icons.download aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
