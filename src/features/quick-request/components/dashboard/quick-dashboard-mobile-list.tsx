'use client';

import { useMemo } from 'react';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { quickRequestListInfiniteQueryOptions } from '../../api/queries';
import type { QuickRequestListResponse, QuickRequestListRow } from '../../api/types';
import { QuickInfiniteSentinel } from '../quick-infinite-sentinel';
import { QuickDashboardEmpty } from './quick-dashboard-empty';
import { QuickRequestMobileCard } from './quick-request-mobile-card';
import type { QuickRequestRowActionHandlers } from './quick-request-row-action';
import {
  getQuickDashboardEmptyReason,
  toQuickRequestListInfiniteFilters,
  type QuickDashboardFilters
} from './use-quick-dashboard-params';

export const QUICK_DASHBOARD_MOBILE_LIST_TEXT = {
  end: '더 이상 요청이 없습니다'
} as const;

/**
 * 페이지를 평탄화하고 `id`로 중복 제거 — Realtime invalidate 뒤 새 건이 맨 위에 끼면 페이지 경계가 밀려
 * 같은 건이 두 페이지에 걸칠 수 있다 (대화 목록 `flattenConversations`와 같은 방식 · plan 106 리스크 MED).
 */
function flattenQuickRequestRows(
  pages: ReadonlyArray<QuickRequestListResponse['data']>
): QuickRequestListRow[] {
  const seen = new Set<string>();
  const result: QuickRequestListRow[] = [];
  for (const page of pages) {
    for (const row of page.rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      result.push(row);
    }
  }
  return result;
}

type QuickDashboardMobileListProps = QuickRequestRowActionHandlers & {
  filters: QuickDashboardFilters;
  canCreate: boolean;
  onResetFilters: () => void;
  onShowAllRange: () => void;
};

/**
 * plan 106 D-9 · designer §3.10 — lg 미만 퀵 내역 카드 목록 (20건씩 자동 추가 로드).
 * `useSuspenseInfiniteQuery` + 기존 `page` API · URL `page`/`perPage` 무시 · 끝까지 내리면 `QuickInfiniteSentinel`이 다음 20건
 * (로딩은 센티널 안 `PageLoadingSpinner compact`) · 끝 문구는 2페이지 이상일 때만.
 * 768~1023은 2열(`md:grid-cols-2` · AC-11). 필터를 바꾸면 상위 Suspense key가 바뀌어 첫 20장부터 다시 받는다.
 */
export function QuickDashboardMobileList({
  filters,
  canCreate,
  onResetFilters,
  onShowAllRange,
  ...handlers
}: QuickDashboardMobileListProps) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    quickRequestListInfiniteQueryOptions(toQuickRequestListInfiniteFilters(filters))
  );
  const rows = useMemo(() => flattenQuickRequestRows(data.pages), [data.pages]);

  if (rows.length === 0) {
    return (
      <QuickDashboardEmpty
        reason={getQuickDashboardEmptyReason(filters)}
        canCreate={canCreate}
        onResetFilters={onResetFilters}
        onShowAllRange={onShowAllRange}
      />
    );
  }

  return (
    <div className='flex min-w-0 flex-1 flex-col gap-3'>
      <ul data-testid='quick-dashboard-cards' className='grid min-w-0 gap-3 md:grid-cols-2'>
        {rows.map((row) => (
          <QuickRequestMobileCard key={row.id} row={row} {...handlers} />
        ))}
      </ul>
      <QuickInfiniteSentinel
        testIdPrefix='quick-dashboard-list'
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
        endMessage={QUICK_DASHBOARD_MOBILE_LIST_TEXT.end}
        showEnd={data.pages.length > 1}
      />
    </div>
  );
}
