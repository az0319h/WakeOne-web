'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'motion/react';
import { walletSyncsInfiniteQueryOptions, type WalletSyncsListFilters } from '../api/queries';
import type { WalletSyncItemStatus, WalletSyncLogEntry } from '../api/types';
import { formatSignedWalletAmount, formatWalletAmount } from '../utils/format';

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

function RemainingDelta({
  remaining,
  previousRemaining
}: {
  remaining: number;
  previousRemaining: number | null;
}) {
  if (previousRemaining == null) {
    return <span className='text-muted-foreground text-xs'>최초 동기화</span>;
  }

  const delta = remaining - previousRemaining;

  if (delta === 0) {
    return <span className='text-muted-foreground text-xs'>잔여 변동 없음</span>;
  }

  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
      )}
    >
      잔여 {formatSignedWalletAmount(delta)}
    </span>
  );
}

export function WalletSyncLog({ filters = {} }: WalletSyncLogProps) {
  const shouldReduceMotion = useReducedMotion();
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    walletSyncsInfiniteQueryOptions(filters)
  );

  const entries = useMemo(() => flattenSyncs(data.pages), [data.pages]);

  useEffect(() => {
    const root = scrollRootRef.current;
    const node = loadMoreRef.current;
    if (!root || !node || !hasNextPage) return;

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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <Card className='flex max-h-[70vh] flex-1 flex-col overflow-hidden md:max-h-[680px]'>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div className='space-y-1'>
          <CardTitle className='text-base font-medium'>한도 업데이트 내역</CardTitle>
          <p className='text-muted-foreground text-sm'>
            KB카드에서 확인한 월 한도가 WakeOne에 반영된 기록입니다.
          </p>
        </div>
        <Badge variant='outline' className='shrink-0 font-normal'>
          KB카드 연동
        </Badge>
      </CardHeader>
      <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        {entries.length === 0 ? (
          <div className='text-muted-foreground flex flex-1 items-center justify-center py-10 text-sm'>
            한도 업데이트 내역이 없습니다.
          </div>
        ) : (
          <div ref={scrollRootRef} className='min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2'>
            <ol className='relative space-y-6 before:absolute before:top-1 before:bottom-1 before:left-[15px] before:w-px before:bg-border'>
              {entries.map((entry) => (
                <motion.li
                  key={entry.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className='relative flex gap-3'
                >
                  <div className='bg-background border-primary/40 text-primary z-10 flex size-8 shrink-0 items-center justify-center rounded-full border'>
                    <Icons.wallet className='size-4' />
                  </div>
                  <div className='min-w-0 flex-1 space-y-1.5 pt-0.5'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p className='text-sm font-medium'>KB카드 한도 동기화</p>
                      <Badge variant={SYNC_STATUS_VARIANTS[entry.status]}>
                        {SYNC_STATUS_LABELS[entry.status]}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground font-mono text-xs whitespace-nowrap'>
                      {formatAbsoluteDateTimeKo(entry.synced_at)}
                    </p>
                    <div className='flex flex-wrap items-center gap-x-4 gap-y-1'>
                      <span className='text-muted-foreground text-xs tabular-nums'>
                        한도 {formatWalletAmount(entry.monthly_limit)}
                      </span>
                      <span className='text-xs font-medium tabular-nums'>
                        잔여 {formatWalletAmount(entry.monthly_remaining)}
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
              {isFetchingNextPage ? <PageLoadingSpinner variant='compact' /> : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
