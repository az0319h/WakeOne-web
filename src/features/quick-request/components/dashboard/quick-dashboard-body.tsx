'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useDataTable } from '@/hooks/use-data-table';
import { quickRequestListQueryOptions } from '../../api/queries';
import type { QuickRequestListRow } from '../../api/types';
import { QUICK_REQUEST_LIST_DEFAULT_LIMIT } from '../../schemas/quick-request-workflow';
import { QUICK_CHAT_MOBILE_MEDIA_QUERY } from '../chat/quick-chat-constants';
import { useMatchMedia } from '../chat/use-match-media';
import { createQuickDashboardColumns, quickRequestDetailHref } from './quick-dashboard-columns';
import { QuickDashboardDataTable } from './quick-dashboard-data-table';
import { QuickDashboardEmpty } from './quick-dashboard-empty';
import { QuickDashboardMobileList } from './quick-dashboard-mobile-list';
import type { QuickRequestRowActionHandlers } from './quick-request-row-action';
import {
  getQuickDashboardEmptyReason,
  QUICK_DASHBOARD_PAGE_SIZE_OPTIONS,
  toQuickRequestListFilters,
  type QuickDashboardFilters
} from './use-quick-dashboard-params';

type QuickDashboardBodyProps = QuickRequestRowActionHandlers & {
  filters: QuickDashboardFilters;
  canCreate: boolean;
  onResetFilters: () => void;
  onShowAllRange: () => void;
  onPageOverflow: (lastPage: number) => void;
};

/**
 * 목록 본문 — hydration 뒤에만 그려지므로(`QuickDashboardPage` `useIsHydrated`) `useMatchMedia`로 **한 벌만** 렌더한다
 * (plan 106 designer K2 ② · testid 중복 없음).
 * - lg 이상: 표 + 퀵 한국어 페이지네이션(URL `page`·`perPage` · plan 97 D-2)
 * - lg 미만: 카드 무한 목록(20건씩 · URL `page`/`perPage` 무시 · plan 106 D-9)
 */
export function QuickDashboardBody({ onPageOverflow, ...props }: QuickDashboardBodyProps) {
  const isMobile = useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY);

  if (isMobile) {
    return <QuickDashboardMobileList {...props} />;
  }
  return <QuickDashboardDesktopBody {...props} onPageOverflow={onPageOverflow} />;
}

/** lg 이상 표 — 행 클릭 → 상세 (plan 94 D-7) · 페이지 범위 밖이면 마지막 페이지로 */
function QuickDashboardDesktopBody({
  filters,
  canCreate,
  onResetFilters,
  onShowAllRange,
  onPageOverflow,
  onDispatch,
  onSetFinal,
  onApprove
}: QuickDashboardBodyProps) {
  const router = useRouter();
  const { data } = useSuspenseQuery(quickRequestListQueryOptions(toQuickRequestListFilters(filters)));
  const pageCount = Math.max(1, Math.ceil(data.total / filters.perPage) || 1);

  const openDetail = useCallback(
    (row: QuickRequestListRow) => {
      router.push(quickRequestDetailHref(row.requestNo));
    },
    [router]
  );

  const columns = useMemo(
    () => createQuickDashboardColumns({ onDispatch, onSetFinal, onApprove }),
    [onApprove, onDispatch, onSetFinal]
  );

  const { table } = useDataTable({
    data: data.rows,
    columns,
    pageCount,
    shallow: true,
    getRowId: (row) => row.id,
    initialState: {
      pagination: { pageIndex: 0, pageSize: QUICK_REQUEST_LIST_DEFAULT_LIMIT },
      columnPinning: { right: ['actions'] }
    }
  });

  useEffect(() => {
    if (data.total > 0 && filters.page > pageCount) {
      onPageOverflow(pageCount);
    }
  }, [data.total, filters.page, onPageOverflow, pageCount]);

  if (data.total === 0) {
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
      <div data-testid='quick-dashboard-table' className='min-w-0'>
        <QuickDashboardDataTable
          table={table}
          onRowClick={openDetail}
          pageSizeOptions={QUICK_DASHBOARD_PAGE_SIZE_OPTIONS}
          total={data.total}
        />
      </div>
    </div>
  );
}
