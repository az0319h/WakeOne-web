'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_VIEWER_TRANSFORM,
  VIEWER_ZOOM_MIN,
  type ViewerTransform,
  zoomIn,
  zoomOut,
  rotateClockwise
} from '../api/viewer-transform';

type AttachmentViewerToolbarProps = {
  transform: ViewerTransform;
  onTransformChange: (transform: ViewerTransform) => void;
  showRotate?: boolean;
  className?: string;
};

export function AttachmentViewerToolbar({
  transform,
  onTransformChange,
  showRotate = true,
  className
}: AttachmentViewerToolbarProps) {
  const canZoomOut = transform.zoom > VIEWER_ZOOM_MIN;
  const canReset =
    transform.zoom !== DEFAULT_VIEWER_TRANSFORM.zoom ||
    transform.rotation !== DEFAULT_VIEWER_TRANSFORM.rotation;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='size-8 border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800'
        aria-label='축소'
        disabled={!canZoomOut}
        onClick={() =>
          onTransformChange({ ...transform, zoom: zoomOut(transform.zoom) })
        }
      >
        <Icons.zoomOut className='h-4 w-4' />
      </Button>
      <span className='min-w-[3rem] text-center text-xs text-neutral-400 tabular-nums'>
        {Math.round(transform.zoom * 100)}%
      </span>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='size-8 border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800'
        aria-label='확대'
        onClick={() =>
          onTransformChange({ ...transform, zoom: zoomIn(transform.zoom) })
        }
      >
        <Icons.zoomIn className='h-4 w-4' />
      </Button>
      {showRotate ? (
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-8 border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800'
          aria-label='90도 회전'
          onClick={() =>
            onTransformChange({
              ...transform,
              rotation: rotateClockwise(transform.rotation)
            })
          }
        >
          <Icons.rotateClockwise className='h-4 w-4' />
        </Button>
      ) : null}
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='size-8 border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800 disabled:opacity-40'
        aria-label='초기화'
        disabled={!canReset}
        onClick={() => onTransformChange(DEFAULT_VIEWER_TRANSFORM)}
      >
        <Icons.restore className='h-4 w-4' />
      </Button>
    </div>
  );
}
