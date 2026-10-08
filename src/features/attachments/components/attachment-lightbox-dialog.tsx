'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle
} from '@/components/ui/dialog';
import { fetchAttachmentBlob } from '../api/fetch-attachment-blob';
import {
  getAttachmentMediaType,
  type AttachmentLightboxItem,
  type LightboxSource
} from '../api/types';
import { cn } from '@/lib/utils';
import { notifyError } from '@/lib/notify';
import {
  DEFAULT_VIEWER_TRANSFORM,
  type ViewerTransform
} from '../api/viewer-transform';
import { AttachmentLightboxCarousel } from './attachment-lightbox-carousel';
import { AttachmentViewerToolbar } from './attachment-viewer-toolbar';

export type AttachmentLightboxDialogState = {
  source: LightboxSource;
  attachments: AttachmentLightboxItem[];
  initialIndex: number;
};

export type AttachmentPdfPageInfo = {
  pageNumber: number;
  numPages: number;
};

type AttachmentLightboxDialogProps = {
  state: AttachmentLightboxDialogState | null;
  onOpenChange: (open: boolean) => void;
};

function revokeBlobUrls(urls: Iterable<string>) {
  for (const url of urls) {
    URL.revokeObjectURL(url);
  }
}

function formatLightboxStatus({
  fileIndex,
  fileCount,
  mediaType,
  pageNumber,
  numPages
}: {
  fileIndex: number;
  fileCount: number;
  mediaType: 'pdf' | 'image';
  pageNumber: number;
  numPages: number;
}): string {
  const parts: string[] = [];

  if (fileCount >= 2) {
    parts.push(`파일 ${fileIndex + 1} / ${fileCount}`);
  }

  if (mediaType === 'pdf' && numPages > 0) {
    parts.push(`페이지 ${pageNumber} / ${numPages}`);
  }

  return parts.join(' · ');
}

export function AttachmentLightboxDialog({
  state,
  onOpenChange
}: AttachmentLightboxDialogProps) {
  const open = state !== null;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfPageInfo, setPdfPageInfo] = useState<AttachmentPdfPageInfo>({
    pageNumber: 1,
    numPages: 0
  });
  const [blobUrlByAttachmentId, setBlobUrlByAttachmentId] = useState<
    Map<number, string>
  >(() => new Map());
  const [viewerTransform, setViewerTransform] = useState<ViewerTransform>(
    DEFAULT_VIEWER_TRANSFORM
  );

  const attachments = state?.attachments ?? [];
  const activeAttachment = attachments[activeIndex] ?? attachments[0] ?? null;
  const activeMediaType = activeAttachment
    ? getAttachmentMediaType(activeAttachment)
    : 'image';

  useEffect(() => {
    if (!state) {
      return;
    }
    setActiveIndex(state.initialIndex);
  }, [state]);

  useEffect(() => {
    setPdfPageInfo({ pageNumber: 1, numPages: 0 });
    setViewerTransform(DEFAULT_VIEWER_TRANSFORM);
  }, [activeAttachment?.id]);

  useEffect(() => {
    if (open) {
      return;
    }

    setBlobUrlByAttachmentId((current) => {
      revokeBlobUrls(current.values());
      return new Map();
    });
  }, [open]);

  const handleBlobUrlChange = useCallback(
    (attachmentId: number, blobUrl: string | null) => {
      setBlobUrlByAttachmentId((current) => {
        const next = new Map(current);
        const existing = next.get(attachmentId);
        if (existing) {
          URL.revokeObjectURL(existing);
        }
        if (blobUrl) {
          next.set(attachmentId, blobUrl);
        } else {
          next.delete(attachmentId);
        }
        return next;
      });
    },
    []
  );

  const handlePdfPageInfoChange = useCallback((info: AttachmentPdfPageInfo) => {
    setPdfPageInfo(info);
  }, []);

  async function handleDownload() {
    if (!state || !activeAttachment || isDownloading) {
      return;
    }

    setIsDownloading(true);
    try {
      const blob = await fetchAttachmentBlob(state.source, activeAttachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = activeAttachment.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '첨부파일 다운로드에 실패했습니다.';
      notifyError(message);
    } finally {
      setIsDownloading(false);
    }
  }

  const statusLabel = formatLightboxStatus({
    fileIndex: activeIndex,
    fileCount: attachments.length,
    mediaType: activeMediaType,
    pageNumber: pdfPageInfo.pageNumber,
    numPages: pdfPageInfo.numPages
  });

  const dialogKey = useMemo(() => {
    if (!state) {
      return 'closed';
    }
    return `${state.source.kind}-${state.source.parentId}-${state.attachments.map((item) => item.id).join(',')}`;
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className='z-[100] bg-black/90' />
        <DialogPrimitive.Content
          data-slot='dialog-content'
          className={cn(
            'fixed inset-0 z-[100] flex h-dvh max-w-none flex-col',
            'border-0 bg-neutral-950 p-0 text-neutral-100 shadow-none sm:rounded-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        >
          <header className='flex shrink-0 items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-4 py-3'>
            <DialogTitle className='min-w-0 flex-1 truncate text-left text-sm font-medium text-neutral-100'>
              {activeAttachment?.file_name ?? '첨부파일'}
            </DialogTitle>
            <DialogDescription className='sr-only'>
              {activeAttachment?.file_name ?? '첨부파일'} 미리보기
            </DialogDescription>
            <DialogPrimitive.Close asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-neutral-100 hover:bg-neutral-800 hover:text-neutral-100'
                aria-label='닫기'
              >
                <Icons.close className='h-4 w-4' />
              </Button>
            </DialogPrimitive.Close>
          </header>

          <div className='flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-950'>
            {state ? (
              <AttachmentLightboxCarousel
                key={dialogKey}
                source={state.source}
                attachments={state.attachments}
                initialIndex={state.initialIndex}
                transform={viewerTransform}
                onActiveIndexChange={setActiveIndex}
                blobUrlByAttachmentId={blobUrlByAttachmentId}
                onBlobUrlChange={handleBlobUrlChange}
                onPdfPageInfoChange={handlePdfPageInfoChange}
              />
            ) : null}
          </div>

          <footer className='grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-neutral-800 bg-neutral-950 px-4 py-3'>
            <Button
              type='button'
              variant='outline'
              size='icon'
              isLoading={isDownloading}
              className='size-8 border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800 hover:text-neutral-100'
              aria-label='다운로드'
              onClick={() => void handleDownload()}
            >
              <Icons.download className='h-4 w-4' />
            </Button>
            {statusLabel ? (
              <p className='text-center text-xs text-neutral-400'>{statusLabel}</p>
            ) : (
              <span aria-hidden='true' />
            )}
            <AttachmentViewerToolbar
              transform={viewerTransform}
              onTransformChange={setViewerTransform}
              showRotate
              className='justify-self-end'
            />
          </footer>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
