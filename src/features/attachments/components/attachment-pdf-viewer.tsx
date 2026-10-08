'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { ViewerTransform } from '../api/viewer-transform';
import {
  computeFitContentWidth,
  getViewportContentSize,
  viewerNeedsScroll,
  type ViewerSize
} from '../api/viewer-fit';
import type { AttachmentPdfPageInfo } from './attachment-lightbox-dialog';
import { AttachmentPdfThumbnailRail } from './attachment-pdf-thumbnail-rail';

// Worker must be configured in the same module as Document/Page (react-pdf).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type AttachmentPdfViewerProps = {
  file: Blob;
  fileName: string;
  isActive: boolean;
  transform: ViewerTransform;
  onPageInfoChange?: (info: AttachmentPdfPageInfo) => void;
  className?: string;
};

function PdfMainPane({
  fileName,
  isActive,
  pageNumber,
  pageWidth,
  transform,
  viewportRef,
  onPageNaturalSizeChange
}: {
  fileName: string;
  isActive: boolean;
  pageNumber: number;
  pageWidth: number;
  transform: ViewerTransform;
  viewportRef: (node: HTMLDivElement | null) => void;
  onPageNaturalSizeChange: (size: ViewerSize) => void;
}) {
  const needsScroll = viewerNeedsScroll(transform.zoom);

  return (
    <div
      tabIndex={isActive ? 0 : -1}
      aria-label={`${fileName} PDF 뷰어`}
      className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden'
    >
      <div
        ref={viewportRef}
        className={cn(
          'min-h-0 flex-1 bg-neutral-950 p-4 md:p-6',
          needsScroll
            ? 'overflow-auto overscroll-contain'
            : 'flex items-center justify-center overflow-hidden'
        )}
      >
        <div
          className={cn(needsScroll && 'mx-auto w-fit')}
          style={{
            transform: `rotate(${transform.rotation}deg)`,
            transformOrigin: 'center center'
          }}
        >
          <Page
            pageNumber={pageNumber}
            width={pageWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className='shadow-lg [&_canvas]:!max-w-none'
            onLoadSuccess={(page) => {
              const viewport = page.getViewport({ scale: 1 });
              onPageNaturalSizeChange({
                width: viewport.width,
                height: viewport.height
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function AttachmentPdfViewer({
  file,
  fileName,
  isActive,
  transform,
  onPageInfoChange,
  className
}: AttachmentPdfViewerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageNaturalSize, setPageNaturalSize] = useState<ViewerSize | null>(null);
  const [containerSize, setContainerSize] = useState<ViewerSize>({
    width: 0,
    height: 0
  });

  const isMobile = useIsMobile();

  const bindViewportRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
  }, []);

  const pageWidth =
    pageNaturalSize && containerSize.width > 0
      ? computeFitContentWidth(
          containerSize,
          pageNaturalSize,
          transform.rotation,
          transform.zoom,
          280
        )
      : Math.max(280, containerSize.width || 640);

  const goToPreviousPage = useCallback(() => {
    setPageNumber((current) => Math.max(1, current - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber((current) => Math.min(numPages || current, current + 1));
  }, [numPages]);

  useEffect(() => {
    setPageNumber(1);
    setNumPages(0);
    setPageNaturalSize(null);
  }, [file]);

  useEffect(() => {
    setPageNaturalSize(null);
  }, [pageNumber]);

  useEffect(() => {
    onPageInfoChange?.({ pageNumber, numPages });
  }, [numPages, onPageInfoChange, pageNumber]);

  useEffect(() => {
    if (viewerNeedsScroll(transform.zoom)) {
      viewportRef.current?.scrollTo({ top: 0, left: 0 });
    }
  }, [pageNumber, transform.rotation, transform.zoom]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        goToPreviousPage();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        goToNextPage();
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [goToNextPage, goToPreviousPage, isActive]);

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
  }, [isMobile, numPages, pageNumber]);

  const mainPaneProps = {
    fileName,
    isActive,
    pageNumber,
    pageWidth,
    transform,
    viewportRef: bindViewportRef,
    onPageNaturalSizeChange: setPageNaturalSize
  };

  return (
    <div className={cn('h-full min-h-0 w-full overflow-hidden', className)}>
      <Document
        file={file}
        suspense={false}
        className='flex h-full min-h-0 w-full flex-col overflow-hidden'
        loading={<PageLoadingSpinner variant='compact' />}
        onLoadSuccess={(pdf) => {
          setNumPages(pdf.numPages);
          setPageNumber((current) => Math.min(current, pdf.numPages));
        }}
        error={
          <p className='flex h-full min-h-[50vh] items-center justify-center text-sm text-neutral-400'>
            PDF를 표시할 수 없습니다.
          </p>
        }
      >
        {numPages > 0 ? isMobile ? (
          <PdfMainPane {...mainPaneProps} />
        ) : (
          <ResizablePanelGroup
            direction='horizontal'
            className='h-full min-h-0 w-full'
          >
            <ResizablePanel
              defaultSize={22}
              minSize={14}
              maxSize={42}
              className='min-h-0 overflow-hidden'
            >
              <div className='flex h-full min-h-0 flex-col overflow-hidden'>
                <AttachmentPdfThumbnailRail
                  numPages={numPages}
                  pageNumber={pageNumber}
                  onPageSelect={setPageNumber}
                  className='border-r'
                />
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className='bg-neutral-800 after:bg-neutral-700 hover:after:bg-neutral-600'
            />
            <ResizablePanel
              defaultSize={78}
              minSize={50}
              className='min-h-0 overflow-hidden'
            >
              <div className='h-full min-h-0 overflow-hidden'>
                <PdfMainPane {...mainPaneProps} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className='flex h-full min-h-[50vh] items-center justify-center bg-neutral-950'>
            <PageLoadingSpinner variant='compact' />
          </div>
        )}
      </Document>
    </div>
  );
}
