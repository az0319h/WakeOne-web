'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { notifyError } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { fetchAttachmentBlob } from '../api/fetch-attachment-blob';
import {
  getAttachmentMediaType,
  type AttachmentLightboxItem,
  type LightboxSource
} from '../api/types';
import type { ViewerTransform } from '../api/viewer-transform';
import type { AttachmentPdfPageInfo } from './attachment-lightbox-dialog';
import { AttachmentImageViewer } from './attachment-image-viewer';

const AttachmentPdfViewer = dynamic(
  () =>
    import('./attachment-pdf-viewer').then((module) => module.AttachmentPdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className='flex h-full min-h-0 items-center justify-center bg-neutral-950'>
        <PageLoadingSpinner variant='compact' />
      </div>
    )
  }
);

type AttachmentLightboxSlideProps = {
  source: LightboxSource;
  attachment: AttachmentLightboxItem;
  isActive: boolean;
  transform: ViewerTransform;
  blobUrl: string | null;
  onBlobUrlChange: (attachmentId: number, blobUrl: string | null) => void;
  onPdfPageInfoChange: (info: AttachmentPdfPageInfo) => void;
};

export function AttachmentLightboxSlide({
  source,
  attachment,
  isActive,
  transform,
  blobUrl,
  onBlobUrlChange,
  onPdfPageInfoChange
}: AttachmentLightboxSlideProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const mediaType = getAttachmentMediaType(attachment);

  useEffect(() => {
    setPdfBlob(null);
    setErrorMessage(null);
    setIsLoading(false);
  }, [attachment.id]);

  useEffect(() => {
    if (mediaType !== 'pdf' || pdfBlob || !blobUrl) {
      return;
    }

    let cancelled = false;

    void fetch(blobUrl)
      .then((response) => response.blob())
      .then((blob) => {
        if (!cancelled) {
          setPdfBlob(blob);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('첨부파일을 불러올 수 없습니다.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attachment.id, blobUrl, mediaType, pdfBlob]);

  useEffect(() => {
    if (!isActive || blobUrl) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void fetchAttachmentBlob(source, attachment.id)
      .then((blob) => {
        if (cancelled) {
          return;
        }
        if (mediaType === 'pdf') {
          setPdfBlob(blob);
        }
        onBlobUrlChange(attachment.id, URL.createObjectURL(blob));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : '첨부파일을 불러올 수 없습니다.';
        setErrorMessage(message);
        notifyError('첨부파일을 불러올 수 없습니다.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    attachment.id,
    blobUrl,
    isActive,
    mediaType,
    onBlobUrlChange,
    source
  ]);

  if (!isActive) {
    return (
      <div
        className='pointer-events-none invisible absolute inset-0 h-full min-h-0 w-full'
        aria-hidden='true'
      />
    );
  }

  if (isLoading || (!blobUrl && !errorMessage)) {
    return (
      <div className='flex h-full min-h-0 items-center justify-center bg-neutral-950'>
        <PageLoadingSpinner variant='compact' />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className='flex h-full min-h-0 items-center justify-center px-6'>
        <p className='text-sm text-neutral-400'>{errorMessage}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return null;
  }

  if (mediaType === 'pdf') {
    if (!pdfBlob) {
      return (
        <div className='flex h-full min-h-0 items-center justify-center bg-neutral-950'>
          <PageLoadingSpinner variant='compact' />
        </div>
      );
    }

    return (
      <AttachmentPdfViewer
        file={pdfBlob}
        fileName={attachment.file_name}
        isActive={isActive}
        transform={transform}
        onPageInfoChange={onPdfPageInfoChange}
      />
    );
  }

  return (
    <AttachmentImageViewer
      blobUrl={blobUrl}
      fileName={attachment.file_name}
      transform={transform}
    />
  );
}
