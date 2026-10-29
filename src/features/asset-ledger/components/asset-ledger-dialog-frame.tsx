'use client';

import { useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle
} from '@/components/ui/dialog';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { cn } from '@/lib/utils';

type AssetLedgerDialogFrameProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  'data-testid': string;
  children: React.ReactNode;
};

/**
 * plan 103 · designer §2-5 — 가운데 Dialog 골격.
 * 휴대폰(<md) = 화면 전체 높이(h-dvh) · md↑ = 가운데 최대 720px · max-h 90dvh.
 * 화면 3개(행 · 요청 폼 · 요청 1건)는 **같은 Content 안에서 URL로 전환**한다(닫았다 열지 않음).
 * quick-request-address-picker-dialog 골격(DialogPrimitive.Content 직접) · 기준점만 `md:`.
 */
export function AssetLedgerDialogFrame({
  open,
  onOpenChange,
  children,
  ...rest
}: AssetLedgerDialogFrameProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-testid={rest['data-testid']}
          className={cn(
            'fixed inset-0 z-50 flex h-dvh w-full max-w-none flex-col gap-0 rounded-none border-0 bg-background p-0 shadow-lg outline-none',
            'md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[min(90dvh,56rem)] md:w-[min(45rem,calc(100vw-4rem))]',
            'md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'motion-reduce:animate-none'
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

type SlotProps = { className?: string; children: React.ReactNode };

/** 머리 — 오른쪽 닫기 X 포함 */
export function LedgerDialogHeader({ className, children }: SlotProps) {
  return (
    <header
      className={cn(
        'flex shrink-0 items-start gap-3 border-b px-4 py-3 md:px-6 md:py-5',
        className
      )}
    >
      <div className='flex min-w-0 flex-1 items-start gap-3'>{children}</div>
      <DialogClose asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='-mt-1 -mr-2 size-11 shrink-0 md:size-9'
          aria-label='닫기'
        >
          <Icons.close className='size-5' aria-hidden />
        </Button>
      </DialogClose>
    </header>
  );
}

/** 본문 — 이 영역만 스크롤 */
export function LedgerDialogBody({ className, children }: SlotProps) {
  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-5',
        className
      )}
    >
      {children}
    </div>
  );
}

/** 하단 고정 — 휴대폰 safe-area */
export function LedgerDialogFooter({ className, children }: SlotProps) {
  return (
    <div
      className={cn(
        'shrink-0 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:py-4',
        className
      )}
    >
      {children}
    </div>
  );
}

type LedgerDialogTitleProps = {
  className?: string;
  children: React.ReactNode;
};

/** 화면 제목 — 화면이 바뀌면 이 제목으로 포커스를 옮긴다(rAF 1회 · designer §2-5) */
export function LedgerDialogTitle({ className, children }: LedgerDialogTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <DialogTitle
      ref={ref}
      tabIndex={-1}
      className={cn('text-base font-semibold outline-none md:text-lg', className)}
    >
      {children}
    </DialogTitle>
  );
}

type LedgerDialogLoadingProps = { title: string };

/** 단건 로딩 — 임시 제목 + compact 스피너 */
export function LedgerDialogLoading({ title }: LedgerDialogLoadingProps) {
  return (
    <>
      <LedgerDialogHeader>
        <div className='min-w-0 flex-1 space-y-1'>
          <DialogTitle className='text-base font-semibold md:text-lg'>{title}</DialogTitle>
          <DialogDescription className='sr-only'>불러오는 중이에요.</DialogDescription>
        </div>
      </LedgerDialogHeader>
      <LedgerDialogBody>
        <PageLoadingSpinner variant='compact' />
      </LedgerDialogBody>
    </>
  );
}

type LedgerDialogErrorProps = {
  title: string;
  message: string;
  onClose: () => void;
  /** 5xx 등 다시 시도할 수 있으면 */
  onRetry?: () => void;
};

/** 단건 404/오류 상자 (`asset-dialog-not-found`) */
export function LedgerDialogError({ title, message, onClose, onRetry }: LedgerDialogErrorProps) {
  return (
    <>
      <LedgerDialogHeader>
        <div className='min-w-0 flex-1 space-y-1'>
          <DialogTitle className='text-base font-semibold md:text-lg'>{title}</DialogTitle>
          <DialogDescription className='sr-only'>{message}</DialogDescription>
        </div>
      </LedgerDialogHeader>
      <LedgerDialogBody>
        <div
          data-testid='asset-dialog-not-found'
          className='flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center'
        >
          <Icons.help aria-hidden className='size-8 text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>{message}</p>
        </div>
      </LedgerDialogBody>
      <LedgerDialogFooter className='flex justify-end gap-2'>
        {onRetry ? (
          <Button type='button' variant='outline' className='h-11 md:h-9' onClick={onRetry}>
            다시 시도
          </Button>
        ) : null}
        <Button type='button' className='h-11 md:h-9' onClick={onClose}>
          닫기
        </Button>
      </LedgerDialogFooter>
    </>
  );
}
