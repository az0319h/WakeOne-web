'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';
import type { AttachmentLightboxItem, LightboxSource } from '../api/types';
import type { ViewerTransform } from '../api/viewer-transform';
import type { AttachmentPdfPageInfo } from './attachment-lightbox-dialog';
import { AttachmentLightboxSlide } from './attachment-lightbox-slide';

type AttachmentLightboxCarouselProps = {
  source: LightboxSource;
  attachments: AttachmentLightboxItem[];
  initialIndex: number;
  transform: ViewerTransform;
  onActiveIndexChange: (index: number) => void;
  blobUrlByAttachmentId: Map<number, string>;
  onBlobUrlChange: (attachmentId: number, blobUrl: string | null) => void;
  onPdfPageInfoChange: (info: AttachmentPdfPageInfo) => void;
};

export function AttachmentLightboxCarousel({
  source,
  attachments,
  initialIndex,
  transform,
  onActiveIndexChange,
  blobUrlByAttachmentId,
  onBlobUrlChange,
  onPdfPageInfoChange
}: AttachmentLightboxCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const showNav = attachments.length >= 2;
  const resolvedActiveIndex = api === undefined ? initialIndex : activeIndex;

  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!api) {
      return;
    }

    function onSelect() {
      const index = api?.selectedScrollSnap() ?? 0;
      setActiveIndex(index);
      onActiveIndexChange(index);
    }

    api.scrollTo(initialIndex, true);
    onSelect();
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api, initialIndex, onActiveIndexChange]);

  const handleBlobUrlChange = useCallback(
    (attachmentId: number, blobUrl: string | null) => {
      onBlobUrlChange(attachmentId, blobUrl);
    },
    [onBlobUrlChange]
  );

  return (
    <Carousel
      setApi={setApi}
      opts={{ startIndex: initialIndex, loop: false }}
      className='flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden'
      aria-label='첨부파일 미리보기'
    >
      <div
        className={cn(
          'relative flex min-h-0 flex-1 flex-col overflow-hidden',
          '[&_[data-slot=carousel-content]]:h-full',
          '[&_[data-slot=carousel-content]>div]:h-full'
        )}
      >
        <CarouselContent className='ml-0 h-full'>
          {attachments.map((attachment, index) => (
            <CarouselItem key={attachment.id} className='h-full basis-full pl-0'>
              <div className='relative h-full min-h-0 w-full overflow-hidden'>
                <AttachmentLightboxSlide
                  source={source}
                  attachment={attachment}
                  isActive={index === resolvedActiveIndex}
                  transform={transform}
                  blobUrl={blobUrlByAttachmentId.get(attachment.id) ?? null}
                  onBlobUrlChange={handleBlobUrlChange}
                  onPdfPageInfoChange={onPdfPageInfoChange}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {showNav ? (
          <>
            <CarouselPrevious
              className={cn(
                'left-2 z-10 size-9 border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800 sm:left-4'
              )}
            />
            <CarouselNext
              className={cn(
                'right-2 z-10 size-9 border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800 sm:right-4'
              )}
            />
          </>
        ) : null}
      </div>
    </Carousel>
  );
}
