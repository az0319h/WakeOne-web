'use client';

import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { openAttachmentLightbox } from '@/features/attachments/components/attachment-lightbox-provider';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { quickRequestAttachmentUrlQueryOptions, quickRequestKeys } from '../../api/queries';
import type { QuickChatAttachmentItem } from '../../lib/quick-chat-cache';
import { QUICK_CHAT_IMAGE_GRID_MAX, toLightboxItems } from '../../lib/quick-chat-attachments';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';

type QuickChatImageGridProps = {
  requestNo: string;
  messageId: number | string;
  images: QuickChatAttachmentItem[];
  /** 같은 메시지의 전체 첨부 — lightbox carousel(이미지·PDF) */
  allAttachments: QuickChatAttachmentItem[];
  /** pending(전송 중)·failed — 흐림 + lightbox 비활성(서명 URL은 연결된 행만 발급) */
  dimmed: boolean;
};

/**
 * plan 98 U-3 · designer §2-3 — 1장 `w-64 aspect-[4/3] object-contain`(고정 박스 · CLS 0) · 2~4장 2열 격자 ·
 * 5장↑ 앞 4장 + 4번째 타일 「+N」 오버레이. 클릭 → 72 lightbox(같은 메시지 이미지·PDF carousel).
 */
export function QuickChatImageGrid({ requestNo, messageId, images, allAttachments, dimmed }: QuickChatImageGridProps) {
  if (images.length === 0) return null;
  const visible = images.slice(0, QUICK_CHAT_IMAGE_GRID_MAX);
  const hidden = images.length - visible.length;

  function open(attachmentId: number) {
    if (dimmed) return;
    openAttachmentLightbox({
      source: { kind: 'quick-chat', parentId: requestNo },
      parentId: requestNo,
      attachments: toLightboxItems(allAttachments),
      initialAttachmentId: attachmentId
    });
  }

  if (visible.length === 1) {
    const image = visible[0]!;
    return (
      <ImageTile
        requestNo={requestNo}
        image={image}
        dimmed={dimmed}
        onOpen={open}
        className='block aspect-[4/3] w-64 max-w-full'
        fit='contain'
      />
    );
  }

  return (
    <div className='grid w-72 max-w-full grid-cols-2 gap-1'>
      {visible.map((image, index) => {
        const isLast = index === visible.length - 1;
        const more = isLast && hidden > 0 ? hidden : 0;
        return (
          <ImageTile
            key={image.id}
            requestNo={requestNo}
            image={image}
            dimmed={dimmed}
            onOpen={open}
            className='aspect-square'
            fit='cover'
            more={more}
            moreTestId={more > 0 ? `quick-chat-attachment-more-${String(messageId)}` : undefined}
          />
        );
      })}
    </div>
  );
}

type ImageTileProps = {
  requestNo: string;
  image: QuickChatAttachmentItem;
  dimmed: boolean;
  onOpen: (attachmentId: number) => void;
  className: string;
  fit: 'contain' | 'cover';
  more?: number;
  moreTestId?: string;
};

/**
 * 타일 — `previewUrl`(optimistic ObjectURL)이 있으면 그대로, 없으면 서명 URL `useQuery`(staleTime 50s).
 * 로딩 `bg-muted` + spinner · 실패 `alertCircle`(클릭 refetch) · `<img onError>`(만료 403) → invalidate 1회.
 */
function ImageTile({ requestNo, image, dimmed, onOpen, className, fit, more = 0, moreTestId }: ImageTileProps) {
  const queryClient = useQueryClient();
  const retriedRef = useRef(false);
  const needsSignedUrl = !image.previewUrl && !dimmed;
  const urlQuery = useQuery({
    ...quickRequestAttachmentUrlQueryOptions(requestNo, image.id),
    enabled: needsSignedUrl
  });
  const src = image.previewUrl ?? urlQuery.data?.url;
  const isError = needsSignedUrl && urlQuery.isError;
  const isLoading = needsSignedUrl && !src && !isError;

  function handleImageError() {
    if (retriedRef.current || image.previewUrl) return;
    retriedRef.current = true;
    void queryClient.invalidateQueries({ queryKey: quickRequestKeys.attachmentUrl(requestNo, image.id) });
  }

  function handleClick() {
    if (isError) {
      retriedRef.current = false;
      void urlQuery.refetch();
      return;
    }
    onOpen(image.id);
  }

  return (
    <button
      type='button'
      data-testid={`quick-chat-attachment-image-${image.id}`}
      aria-label={more > 0 ? quickChatText.moreImages(more) : isError ? QUICK_CHAT_TEXT.imageLoadFailed : quickChatText.viewImage(image.fileName)}
      disabled={dimmed}
      onClick={handleClick}
      className={cn(
        'relative overflow-hidden rounded-md bg-muted touch-manipulation outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        dimmed && 'opacity-60',
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={image.fileName}
          loading='lazy'
          decoding='async'
          onError={handleImageError}
          className={cn('size-full', fit === 'contain' ? 'object-contain' : 'object-cover')}
        />
      ) : null}
      {isLoading ? (
        <span className='absolute inset-0 flex items-center justify-center'>
          <Icons.spinner aria-hidden className='size-5 animate-spin text-muted-foreground motion-reduce:animate-none' />
        </span>
      ) : null}
      {isError ? (
        <span className='absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center text-[11px] text-muted-foreground'>
          <Icons.alertCircle aria-hidden className='size-5' />
          {QUICK_CHAT_TEXT.imageLoadFailed}
        </span>
      ) : null}
      {more > 0 ? (
        <span
          data-testid={moreTestId}
          className='absolute inset-0 flex items-center justify-center bg-background/70 text-lg font-semibold text-foreground'
        >
          +{more}
        </span>
      ) : null}
    </button>
  );
}
