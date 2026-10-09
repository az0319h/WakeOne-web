'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ViewerTransform } from '../api/viewer-transform';
import {
  computeFitContentSize,
  getViewportContentSize,
  scaleFitSize,
  viewerNeedsScroll,
  type ViewerSize
} from '../api/viewer-fit';

type AttachmentImageViewerProps = {
  blobUrl: string;
  fileName: string;
  transform: ViewerTransform;
  className?: string;
};

export function AttachmentImageViewer({
  blobUrl,
  fileName,
  transform,
  className
}: AttachmentImageViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState<ViewerSize | null>(null);
  const [containerSize, setContainerSize] = useState<ViewerSize>({
    width: 0,
    height: 0
  });

  useEffect(() => {
    setNaturalSize(null);
  }, [blobUrl]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    function updateContainerSize() {
      const el = viewportRef.current;
      if (!el) {
        return;
      }
      setContainerSize(getViewportContentSize(el));
    }

    updateContainerSize();
    const observer = new ResizeObserver(updateContainerSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fitBaseSize = useMemo(() => {
    if (!naturalSize || containerSize.width === 0) {
      return null;
    }

    return computeFitContentSize(
      containerSize,
      naturalSize,
      transform.rotation,
      1,
      1
    );
  }, [containerSize, naturalSize, transform.rotation]);

  const displaySize = fitBaseSize
    ? scaleFitSize(fitBaseSize, transform.zoom)
    : null;

  const needsScroll = viewerNeedsScroll(transform.zoom);

  return (
    <div
      ref={viewportRef}
      tabIndex={0}
      aria-label={`${fileName} 이미지 뷰어`}
      data-attachment-pan-viewport
      className={cn(
        'h-full min-h-0 w-full bg-neutral-950 p-4 md:p-6',
        needsScroll
          ? 'overflow-auto overscroll-contain'
          : 'flex items-center justify-center overflow-hidden',
        className
      )}
      style={
        needsScroll
          ? {
              touchAction: 'pan-x pan-y',
              WebkitOverflowScrolling: 'touch'
            }
          : undefined
      }
    >
      <div
        className={cn(needsScroll && 'mx-auto w-fit shrink-0')}
        style={{
          transform: `rotate(${transform.rotation}deg)`,
          transformOrigin: 'center center'
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={fileName}
          className='block max-w-none shadow-lg'
          onLoad={(event) => {
            const img = event.currentTarget;
            setNaturalSize({
              width: img.naturalWidth,
              height: img.naturalHeight
            });
          }}
          style={
            displaySize && naturalSize
              ? {
                  width: displaySize.width,
                  aspectRatio: `${naturalSize.width} / ${naturalSize.height}`,
                  height: 'auto',
                  objectFit: 'contain'
                }
              : {
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
                }
          }
        />
      </div>
    </div>
  );
}
