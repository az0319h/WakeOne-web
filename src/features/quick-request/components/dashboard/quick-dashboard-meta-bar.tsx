'use client';

import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { quickRequestKeys, quickRequestSummaryQueryOptions } from '../../api/queries';

/**
 * 조회 기간 · 갱신 시각 · 새로고침 — Suspense 밖.
 * plan 92 U-1 — 왼쪽 발송 상태 배지를 없애고 한 줄로 정리(모바일 왼쪽 · sm↑ 오른쪽 정렬). 대체 요소 없음.
 */
export function QuickDashboardMetaBar() {
  const queryClient = useQueryClient();
  const { data: summary, dataUpdatedAt } = useQuery(quickRequestSummaryQueryOptions());
  const fetchingCount = useIsFetching({ queryKey: quickRequestKeys.all });
  const isFetching = fetchingCount > 0;

  function handleRefresh() {
    void queryClient.refetchQueries({ queryKey: quickRequestKeys.lists(), type: 'active' });
    void queryClient.refetchQueries({ queryKey: quickRequestKeys.summary(), type: 'active' });
  }

  return (
    <div
      data-testid='quick-dashboard-meta-bar'
      className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground sm:justify-end'
    >
      {summary ? (
        <span className='tabular-nums'>
          {formatAbsoluteDateKo(summary.range.fromDate)} ~ {formatAbsoluteDateKo(summary.range.toDate)}
        </span>
      ) : null}
      <span aria-live='polite' data-testid='quick-dashboard-updated-at' className='tabular-nums'>
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
  );
}
