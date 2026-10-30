'use client';

import { useSyncExternalStore } from 'react';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { quickRequestKeys, quickRequestSummaryQueryOptions } from '../../api/queries';
import type { QuickRequestRangeFilters } from '../../api/types';
import { quickRangeLabel } from '../../lib/quick-request-range';
import { QuickMobileInfoButton } from '../mobile/quick-mobile-info-button';

const subscribeNoop = () => () => undefined;

/** SSR·hydration 중 false — 레이아웃(사이드바 배지)이 먼저 띄운 fetch로 `useIsFetching`이 hydration 시점에 >0이 되는 불일치를 막는다 */
function useIsHydrated() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

type QuickDashboardMetaBarProps = {
  /** 선택 기간 (summary 쿼리 키 · 라벨) */
  rangeFilters: QuickRequestRangeFilters;
};

/**
 * 조회 기간 라벨 · 갱신 시각 · 새로고침 — Suspense 밖.
 * plan 97 D-7 — 왼쪽 「기간: 최근 7일」/「기간: 2026-10-01 ~ 2026-10-27」/「기간: 전체」(`quickRangeLabel`) · 오른쪽 갱신·새로고침.
 * plan 106 designer §3.4 — 휴대폰 본문 첫 줄: 갱신 시각은 sm 미만에서 숨김(메타바 1줄 유지) · 맨 오른쪽 ⓘ(lg 미만 · 44px).
 */
export function QuickDashboardMetaBar({ rangeFilters }: QuickDashboardMetaBarProps) {
  const queryClient = useQueryClient();
  const { dataUpdatedAt } = useQuery(quickRequestSummaryQueryOptions(rangeFilters));
  const fetchingCount = useIsFetching({ queryKey: quickRequestKeys.all });
  const isHydrated = useIsHydrated();
  const isFetching = isHydrated && fetchingCount > 0;

  function handleRefresh() {
    void queryClient.refetchQueries({ queryKey: quickRequestKeys.lists(), type: 'active' });
    void queryClient.refetchQueries({ queryKey: quickRequestKeys.summaries(), type: 'active' });
  }

  return (
    <div
      data-testid='quick-dashboard-meta-bar'
      className='flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground max-lg:min-h-11'
    >
      <span
        data-testid='quick-dashboard-range-label'
        aria-live='polite'
        className='mr-auto tabular-nums'
      >
        {quickRangeLabel(rangeFilters)}
      </span>
      <div className='flex min-w-0 items-center gap-1'>
        <span
          aria-live='polite'
          data-testid='quick-dashboard-updated-at'
          className='hidden tabular-nums sm:inline'
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
        <QuickMobileInfoButton />
      </div>
    </div>
  );
}
