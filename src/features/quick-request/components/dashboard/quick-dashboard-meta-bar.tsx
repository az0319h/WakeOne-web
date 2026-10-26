'use client';

import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { quickRequestKeys, quickRequestSummaryQueryOptions } from '../../api/queries';
import { QuickOpenchatStatusBadge } from './quick-openchat-status-badge';

type QuickDashboardMetaBarProps = {
  canOperate: boolean;
  /** 서버 초기값 (summary 도착 전) */
  openchatConfigured: boolean | null;
};

/** 발송 상태 · 조회 기간 · 갱신 시각 · 새로고침 — Suspense 밖 */
export function QuickDashboardMetaBar({ canOperate, openchatConfigured }: QuickDashboardMetaBarProps) {
  const queryClient = useQueryClient();
  const { data: summary, dataUpdatedAt } = useQuery(quickRequestSummaryQueryOptions());
  const fetchingCount = useIsFetching({ queryKey: quickRequestKeys.all });
  const isFetching = fetchingCount > 0;
  const configured = summary?.openchatConfigured ?? openchatConfigured;

  function handleRefresh() {
    void queryClient.refetchQueries({ queryKey: quickRequestKeys.lists(), type: 'active' });
    void queryClient.refetchQueries({ queryKey: quickRequestKeys.summary(), type: 'active' });
  }

  return (
    <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex min-h-7 items-center'>
        {canOperate && configured !== null ? (
          <QuickOpenchatStatusBadge configured={configured} />
        ) : null}
      </div>
      <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground'>
        {summary ? (
          <span className='tabular-nums'>
            {formatAbsoluteDateKo(summary.range.fromDate)} ~ {formatAbsoluteDateKo(summary.range.toDate)}
          </span>
        ) : null}
        <span
          aria-live='polite'
          data-testid='quick-dashboard-updated-at'
          className='tabular-nums'
        >
          갱신 {dataUpdatedAt > 0 ? formatAbsoluteDateTimeKo(new Date(dataUpdatedAt)) : '—'}
        </span>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-11 lg:size-9'
          aria-label='새로고침'
          data-testid='quick-dashboard-refresh'
          disabled={isFetching}
          onClick={handleRefresh}
        >
          <Icons.refresh
            aria-hidden
            className={cn('size-4', isFetching && 'animate-spin motion-reduce:animate-none')}
          />
        </Button>
      </div>
    </div>
  );
}
