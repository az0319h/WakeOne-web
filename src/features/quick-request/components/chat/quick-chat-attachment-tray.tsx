'use client';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { formatAttachmentMeta } from '../../lib/quick-chat-attachments';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import type { QuickChatUploadItem, UseAttachmentUploadResult } from './use-attachment-upload';

type QuickChatAttachmentTrayProps = {
  attachments: UseAttachmentUploadResult;
};

/**
 * plan 98 U-1 · designer §2-1·§3-1 — 입력창 위 첨부 대기 줄. 가로 스크롤 칩(이미지 48px 썸네일 / 파일 타일+이름+용량) ·
 * 하단 `Progress h-1`(uploaded면 미렌더) · ✕ · 실패 ↻ · 개수 `n/30`(aria-live) · 전송 비활성 이유 문구(disabled 무설명 금지).
 */
export function QuickChatAttachmentTray({ attachments }: QuickChatAttachmentTrayProps) {
  const { items, remove, retry, isUploading, hasFailed, max } = attachments;
  if (items.length === 0) {
    return null;
  }
  const reason = hasFailed ? QUICK_CHAT_TEXT.fixFailed : isUploading ? QUICK_CHAT_TEXT.waitUpload : null;

  return (
    <div data-testid='quick-chat-attachment-tray' className='flex flex-col gap-1 pb-2'>
      <ul
        aria-label={QUICK_CHAT_TEXT.attachmentTray}
        className='flex gap-2 overflow-x-auto overscroll-x-contain pt-1 pb-1 [scrollbar-width:thin]'
      >
        {items.map((item) => (
          <AttachmentChip key={item.localId} item={item} onRemove={remove} onRetry={retry} />
        ))}
      </ul>
      <div className='flex items-center justify-between gap-2'>
        <p
          data-testid='quick-chat-attachment-reason'
          className={cn('min-w-0 truncate text-xs', hasFailed ? 'text-destructive' : 'text-muted-foreground')}
        >
          {reason}
        </p>
        <p
          aria-live='polite'
          data-testid='quick-chat-attachment-count'
          className='shrink-0 text-xs text-muted-foreground tabular-nums'
        >
          {quickChatText.attachCount(items.length, max)}
        </p>
      </div>
    </div>
  );
}

type AttachmentChipProps = {
  item: QuickChatUploadItem;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
};

function AttachmentChip({ item, onRemove, onRetry }: AttachmentChipProps) {
  const isImage = item.kind === 'image' && item.previewUrl;
  const failed = item.state === 'failed';

  return (
    <li
      data-testid={`quick-chat-attachment-chip-${item.localId}`}
      data-state={item.state}
      className={cn(
        'relative flex shrink-0 items-center gap-2 rounded-lg bg-muted',
        isImage ? 'size-14 p-1' : 'w-44 p-2 pb-3',
        failed && 'border border-destructive'
      )}
    >
      {isImage ? (
        <img
          src={item.previewUrl}
          alt={item.fileName}
          width={48}
          height={48}
          decoding='async'
          className={cn('size-12 rounded-md object-cover', item.state !== 'uploaded' && 'opacity-60')}
        />
      ) : (
        <>
          <span
            aria-hidden
            className='flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground'
          >
            {item.kind === 'image' ? <Icons.media className='size-4' /> : <Icons.paperclip className='size-4' />}
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block truncate text-xs font-medium text-foreground'>{item.fileName}</span>
            <span className={cn('block truncate text-[11px]', failed ? 'text-destructive' : 'text-muted-foreground')}>
              {failed ? QUICK_CHAT_TEXT.uploadFailed : formatAttachmentMeta(item.extension, item.fileSize)}
            </span>
          </span>
        </>
      )}
      {item.state === 'uploading' ? (
        <Progress
          value={item.progress}
          aria-label={quickChatText.uploadProgress(item.fileName)}
          className='absolute inset-x-1.5 bottom-1 h-1 motion-reduce:transition-none [&>[data-slot=progress-indicator]]:motion-reduce:transition-none'
        />
      ) : null}
      <span className='absolute -top-1.5 -right-1.5 flex items-center gap-0.5'>
        {failed ? (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-7 touch-manipulation rounded-full border bg-background shadow-sm'
            aria-label={quickChatText.retryAttachment(item.fileName)}
            data-testid={`quick-chat-attachment-retry-${item.localId}`}
            onClick={() => onRetry(item.localId)}
          >
            <Icons.refresh aria-hidden className='size-3.5' />
          </Button>
        ) : null}
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-7 touch-manipulation rounded-full border bg-background shadow-sm'
          aria-label={quickChatText.removeAttachment(item.fileName)}
          data-testid={`quick-chat-attachment-remove-${item.localId}`}
          onClick={() => onRemove(item.localId)}
        >
          <Icons.close aria-hidden className='size-3.5' />
        </Button>
      </span>
    </li>
  );
}
