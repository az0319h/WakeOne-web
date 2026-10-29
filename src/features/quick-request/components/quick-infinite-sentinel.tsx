'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { cn } from '@/lib/utils';

export const QUICK_INFINITE_SENTINEL_TEXT = {
  loadMore: '더 보기',
  loadingMore: '불러오는 중…'
} as const;

/** 센티널이 뷰포트 아래 이만큼 가까워지면 미리 불러온다 */
const ROOT_MARGIN = '120px';

type QuickInfiniteSentinelProps = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** 끝 문구 (예: 「더 이상 대화가 없습니다」) */
  endMessage: string;
  /** 호출부가 `pages.length > 1`일 때만 true → 한 페이지짜리 목록에는 끝 문구가 뜨지 않는다 */
  showEnd: boolean;
  /** `{prefix}-sentinel` · `{prefix}-load-more` */
  testIdPrefix: string;
  className?: string;
};

/**
 * plan 97 D-5·D-9 · designer K6 — 무한 목록 하단 센티널.
 * 「더 보기」 ghost 버튼이 센티널 본체(IntersectionObserver가 자동 호출 · 키보드/스크린리더·observer 미지원 시 수동 fallback).
 * 다음 페이지 로딩은 `PageLoadingSpinner compact` + 「불러오는 중…」. observer root는 null(조상 overflow clip 반영 · ScrollArea·TabsContent 안에서도 동작).
 */
export function QuickInfiniteSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  endMessage,
  showEnd,
  testIdPrefix,
  className
}: QuickInfiniteSentinelProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const canLoad = hasNextPage && !isFetchingNextPage;

  useEffect(() => {
    const target = buttonRef.current;
    if (!canLoad || !target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { root: null, rootMargin: ROOT_MARGIN }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoad]);

  const showEndMessage = !hasNextPage && !isFetchingNextPage && showEnd;
  const hasContent = isFetchingNextPage || hasNextPage || showEndMessage;

  return (
    <div
      data-testid={`${testIdPrefix}-sentinel`}
      data-state={isFetchingNextPage ? 'loading' : hasNextPage ? 'more' : 'end'}
      aria-live='polite'
      className={cn('flex items-center justify-center', hasContent && 'min-h-11 py-2', className)}
    >
      {isFetchingNextPage ? (
        <div className='flex min-h-11 w-full items-center justify-center gap-2'>
          <PageLoadingSpinner variant='compact' className='w-auto min-h-0' />
          <span className='text-xs text-muted-foreground'>{QUICK_INFINITE_SENTINEL_TEXT.loadingMore}</span>
        </div>
      ) : hasNextPage ? (
        <Button
          ref={buttonRef}
          type='button'
          variant='ghost'
          className='h-11 w-full'
          data-testid={`${testIdPrefix}-load-more`}
          onClick={() => onLoadMoreRef.current()}
        >
          {QUICK_INFINITE_SENTINEL_TEXT.loadMore}
        </Button>
      ) : showEndMessage ? (
        <p className='text-center text-xs text-muted-foreground'>{endMessage}</p>
      ) : null}
    </div>
  );
}
