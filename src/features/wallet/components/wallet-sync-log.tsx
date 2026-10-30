'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'motion/react';
import { walletSyncsInfiniteQueryOptions, type WalletSyncsListFilters } from '../api/queries';
import type { WalletSyncItemStatus, WalletSyncLogEntry } from '../api/types';
import { formatWalletAmount } from '../utils/format';

interface WalletSyncLogProps {
  filters?: WalletSyncsListFilters;
}

const SYNC_STATUS_LABELS: Record<WalletSyncItemStatus, string> = {
  matched: '동기화',
  unmatched: '매칭 실패'
};

const SYNC_STATUS_VARIANTS: Record<WalletSyncItemStatus, 'default' | 'secondary'> = {
  matched: 'default',
  unmatched: 'secondary'
};

function flattenSyncs(pages: { syncs: WalletSyncLogEntry[] }[] | undefined): WalletSyncLogEntry[] {
  if (!pages) return [];
  const seen = new Set<number>();
  const result: WalletSyncLogEntry[] = [];

  for (const page of pages) {
    for (const entry of page.syncs) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        result.push(entry);
      }
    }
  }

  return result;
}

/** 모바일(<md): 카드 안 이중 스크롤 대신 N개씩 '더 보기' */
const MOBILE_PAGE_SIZE = 5;
const MOBILE_QUERY = '(max-width: 767px)';

function RemainingDelta({
  remaining,
  previousRemaining
}: {
  remaining: number;
  previousRemaining: number | null;
}) {
  if (previousRemaining == null) {
    return <span className='text-muted-foreground text-xs'>최초 반영</span>;
  }

  const delta = remaining - previousRemaining;

  if (delta === 0) {
    return <span className='text-muted-foreground text-xs'>잔액 변동 없음</span>;
  }

  const label = delta < 0 ? '사용 금액' : '환급 금액';

  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
      )}
    >
      {label} {formatWalletAmount(Math.abs(delta))}
    </span>
  );
}

export function WalletSyncLog({ filters = {} }: WalletSyncLogProps) {
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    walletSyncsInfiniteQueryOptions(filters)
  );

  const entries = useMemo(() => flattenSyncs(data.pages), [data.pages]);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const canShowMoreOnMobile = mobileVisibleCount < entries.length || hasNextPage;

  function handleMobileShowMore() {
    const nextCount = mobileVisibleCount + MOBILE_PAGE_SIZE;
    setMobileVisibleCount(nextCount);
    if (nextCount > entries.length && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }

  useEffect(() => {
    const root = scrollRootRef.current;
    const node = loadMoreRef.current;
    if (!root || !node || !hasNextPage) return;
    // 모바일은 내부 스크롤이 없어 observer가 즉시 교차 → 자동 로드 대신 '더 보기' 버튼 사용
    if (isMobile || window.matchMedia(MOBILE_QUERY).matches) return;

    const observer = new IntersectionObserver(
      (observed) => {
        if (observed[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: '160px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isMobile]);

  return (
    <Card className='flex flex-1 flex-col overflow-hidden md:max-h-[680px]'>
      {/* 모바일: 배지를 설명 아래로 · md 이상: 제목 옆 */}
      <CardHeader className='flex flex-col items-start gap-2 md:flex-row md:justify-between md:gap-4'>
        <div className='space-y-1'>
          <CardTitle className='text-base font-medium'>식대 잔액 업데이트 내역</CardTitle>
          <p className='text-muted-foreground text-sm'>
            식대 체크카드 잔액이 WakeOne에 반영된 기록입니다.
          </p>
        </div>
        <Badge variant='outline' className='shrink-0 font-normal'>
          KB국민 식대 체크카드
        </Badge>
      </CardHeader>
      <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        {entries.length === 0 ? (
          <div className='text-muted-foreground flex flex-1 items-center justify-center py-10 text-sm'>
            식대 잔액 업데이트 내역이 없습니다.
          </div>
        ) : (
          <div
            ref={scrollRootRef}
            className='min-h-0 flex-1 pr-2 md:overflow-y-auto md:overscroll-contain'
          >
            <ol className='relative space-y-6 before:absolute before:top-1 before:bottom-1 before:left-[15px] before:w-px before:bg-border'>
              {entries.map((entry, index) => (
                <motion.li
                  key={entry.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={cn(
                    'relative flex gap-3',
                    index >= mobileVisibleCount && 'max-md:hidden'
                  )}
                >
                  <div className='bg-background border-primary/40 text-primary z-10 flex size-8 shrink-0 items-center justify-center rounded-full border'>
                    <Icons.wallet className='size-4' />
                  </div>
                  <div className='min-w-0 flex-1 space-y-1.5 pt-0.5'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='text-sm font-medium'>식대 잔액 업데이트</p>
                      <Badge variant={SYNC_STATUS_VARIANTS[entry.status]}>
                        {SYNC_STATUS_LABELS[entry.status]}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground font-mono text-xs whitespace-nowrap'>
                      {formatAbsoluteDateTimeKo(entry.synced_at)}
                    </p>
                    <div className='flex flex-wrap items-center gap-x-4 gap-y-1'>
                      <span className='text-muted-foreground text-xs tabular-nums'>
                        이번 달 지급액 {formatWalletAmount(entry.monthly_limit)}
                      </span>
                      <span className='text-xs font-medium tabular-nums'>
                        남은 식대 {formatWalletAmount(entry.monthly_remaining)}
                      </span>
                      <RemainingDelta
                        remaining={entry.monthly_remaining}
                        previousRemaining={entry.previous_remaining}
                      />
                    </div>
                  </div>
                </motion.li>
              ))}
            </ol>
            <div ref={loadMoreRef} className='flex justify-center py-4'>
              {isFetchingNextPage ? (
                <PageLoadingSpinner variant='compact' />
              ) : canShowMoreOnMobile ? (
                <Button
                  type='button'
                  variant='outline'
                  className='h-11 w-full md:hidden'
                  onClick={handleMobileShowMore}
                >
                  더 보기
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
