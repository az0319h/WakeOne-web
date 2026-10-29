'use client';

import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { QUICK_CHAT_TEXT } from './quick-chat-constants';

type QuickChatDropzoneProps = {
  /** 쓰기 권한 — false면 오버레이 없이 브라우저 기본 동작(파일 열기)만 막는다 */
  enabled: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
  className?: string;
};

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

/**
 * plan 98 U-2 · designer §2-2 — 대화 영역 전체 드롭존. `dragenter`/`dragleave` depth 카운터로 자식 경계 flicker 방지 ·
 * 드래그 중 오버레이 「파일을 여기에 놓으세요」(`role=status`) · 키보드 대안은 Composer 클립 버튼. 모바일은 drag 이벤트가 없다.
 */
export function QuickChatDropzone({ enabled, onFiles, children, className }: QuickChatDropzoneProps) {
  const depthRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  function reset() {
    depthRef.current = 0;
    setDragging(false);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (!enabled) return;
    depthRef.current += 1;
    if (depthRef.current === 1) setDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = enabled ? 'copy' : 'none';
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event) || !enabled) return;
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    reset();
    if (!enabled) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      data-testid='quick-chat-dropzone'
      data-dragging={dragging ? 'true' : 'false'}
      className={cn(className, dragging && 'select-none')}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {dragging && enabled ? (
        <div
          role='status'
          aria-live='polite'
          data-testid='quick-chat-drop-overlay'
          className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-2'
        >
          <div className='flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary px-4 text-center text-primary'>
            <Icons.upload aria-hidden className='size-8' />
            <p className='text-sm font-medium'>{QUICK_CHAT_TEXT.dropHint}</p>
            <p className='text-xs text-muted-foreground'>{QUICK_CHAT_TEXT.dropSubHint}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
