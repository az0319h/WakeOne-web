'use client';

import { Button } from '@/components/ui/button';
import { openAttachmentLightbox } from '@/features/attachments/components/attachment-lightbox-provider';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { getQuickChatAttachmentDownloadUrl } from '../../api/service';
import type { QuickChatAttachmentItem } from '../../lib/quick-chat-cache';
import { formatAttachmentMeta, isPdfAttachment, toLightboxItems } from '../../lib/quick-chat-attachments';
import { quickChatText } from './quick-chat-constants';

type QuickChatFileCardProps = {
  requestNo: string;
  attachment: QuickChatAttachmentItem;
  /** 같은 메시지의 전체 첨부 — PDF 카드 클릭 시 lightbox carousel */
  allAttachments: QuickChatAttachmentItem[];
  isMine: boolean;
  /** pending·failed — 흐림 + 다운로드·열기 비활성 */
  dimmed: boolean;
};

/**
 * plan 98 D-6 · U-4 · designer §2-4 (사용자 참조 이미지) — 왼쪽 클립 타일 · 가운데 파일명 굵게(2줄 clamp) + `DOCX · 1.2 MB` ·
 * 오른쪽 다운로드 `<a href=…/download download>`(44px · Route 302 → 서명 URL). PDF는 이름이 lightbox 버튼.
 */
export function QuickChatFileCard({ requestNo, attachment, allAttachments, isMine, dimmed }: QuickChatFileCardProps) {
  const canOpen = isPdfAttachment(attachment) && !dimmed;

  function handleOpen() {
    openAttachmentLightbox({
      source: { kind: 'quick-chat', parentId: requestNo },
      parentId: requestNo,
      attachments: toLightboxItems(allAttachments),
      initialAttachmentId: attachment.id
    });
  }

  return (
    <div
      data-testid={`quick-chat-attachment-file-${attachment.id}`}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2',
        isMine ? 'bg-primary/10' : 'bg-muted',
        dimmed && 'opacity-60'
      )}
    >
      <span aria-hidden className='flex size-10 shrink-0 items-center justify-center rounded-md bg-background'>
        <Icons.paperclip className='size-5 text-muted-foreground' />
      </span>
      <div className='min-w-0 flex-1'>
        {canOpen ? (
          <button
            type='button'
            data-testid={`quick-chat-attachment-open-${attachment.id}`}
            aria-label={quickChatText.openFile(attachment.fileName)}
            className='block w-full touch-manipulation rounded-sm text-left text-sm font-medium text-foreground line-clamp-2 break-all outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50'
            onClick={handleOpen}
          >
            {attachment.fileName}
          </button>
        ) : (
          <p className='text-sm font-medium text-foreground line-clamp-2 break-all'>{attachment.fileName}</p>
        )}
        <p className='text-xs text-muted-foreground tabular-nums'>
          {formatAttachmentMeta(attachment.extension, attachment.fileSize)}
        </p>
      </div>
      <Button
        asChild
        variant='ghost'
        size='icon'
        className={cn('-mr-1 size-11 shrink-0 touch-manipulation', dimmed && 'pointer-events-none opacity-50')}
      >
        <a
          href={dimmed ? undefined : getQuickChatAttachmentDownloadUrl(requestNo, attachment.id)}
          download={attachment.fileName}
          aria-label={quickChatText.download(attachment.fileName)}
          aria-disabled={dimmed || undefined}
          tabIndex={dimmed ? -1 : undefined}
          data-testid={`quick-chat-attachment-download-${attachment.id}`}
        >
          <Icons.download aria-hidden className='size-5' />
        </a>
      </Button>
    </div>
  );
}
