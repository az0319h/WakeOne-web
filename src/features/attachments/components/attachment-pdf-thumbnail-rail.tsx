'use client';

import { useEffect, useRef, useState } from 'react';
import { Page } from 'react-pdf';
import { cn } from '@/lib/utils';

const RAIL_PADDING_X = 32;
const THUMBNAIL_MIN_WIDTH = 56;
const THUMBNAIL_MAX_WIDTH = 320;

type AttachmentPdfThumbnailRailProps = {
  numPages: number;
  pageNumber: number;
  onPageSelect: (page: number) => void;
  className?: string;
};

function PdfThumbnailButton({
  pageNumber,
  isActive,
  thumbnailWidth,
  onSelect
}: {
  pageNumber: number;
  isActive: boolean;
  thumbnailWidth: number;
  onSelect: () => void;
}) {
  return (
    <button
      type='button'
      role='tab'
      aria-selected={isActive}
      aria-label={`${pageNumber}페이지`}
      onClick={onSelect}
      className={cn(
        'flex w-full shrink-0 flex-col items-center gap-1.5 rounded-md p-1 transition-colors',
        isActive ? 'bg-neutral-800/80' : 'hover:bg-neutral-800/50'
      )}
    >
      <span
        className={cn(
          'inline-flex w-full justify-center overflow-hidden rounded border bg-white shadow-sm',
          isActive
            ? 'border-sky-500 ring-2 ring-sky-500/40'
            : 'border-neutral-600 opacity-90 hover:border-neutral-400'
        )}
      >
        <Page
          pageNumber={pageNumber}
          width={thumbnailWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </span>
      <span
        className={cn(
          'text-xs font-medium tabular-nums',
          isActive ? 'text-neutral-100' : 'text-neutral-400'
        )}
      >
        {pageNumber}
      </span>
    </button>
  );
}

export function AttachmentPdfThumbnailRail({
  numPages,
  pageNumber,
  onPageSelect,
  className
}: AttachmentPdfThumbnailRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [thumbnailWidth, setThumbnailWidth] = useState(128);

  useEffect(() => {
    const node = railRef.current;
    if (!node) {
      return;
    }

    function updateThumbnailWidth() {
      const el = railRef.current;
      if (!el) {
        return;
      }

      const availableWidth = el.clientWidth - RAIL_PADDING_X;
      setThumbnailWidth(
        Math.max(
          THUMBNAIL_MIN_WIDTH,
          Math.min(THUMBNAIL_MAX_WIDTH, availableWidth)
        )
      );
    }

    updateThumbnailWidth();
    const observer = new ResizeObserver(updateThumbnailWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (numPages <= 0) {
    return null;
  }

  return (
    <div
      ref={railRef}
      role='tablist'
      aria-label='PDF 페이지 목록'
      className={cn(
        'flex h-full min-h-0 w-full flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain border-neutral-800 bg-neutral-950 p-4',
        className
      )}
    >
      {Array.from({ length: numPages }, (_, index) => {
        const page = index + 1;
        return (
          <PdfThumbnailButton
            key={page}
            pageNumber={page}
            thumbnailWidth={thumbnailWidth}
            isActive={pageNumber === page}
            onSelect={() => onPageSelect(page)}
          />
        );
      })}
    </div>
  );
}
