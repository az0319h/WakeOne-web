'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSuspenseQuery } from '@tanstack/react-query';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { useDataTable } from '@/hooks/use-data-table';
import { quickRequestListQueryOptions } from '../../api/queries';
import type { QuickRequestListRow } from '../../api/types';
import { QUICK_REQUEST_LIST_DEFAULT_LIMIT } from '../../schemas/quick-request-workflow';
import { createQuickDashboardColumns, quickRequestDetailHref } from './quick-dashboard-columns';
import { QuickDashboardDataTable } from './quick-dashboard-data-table';
import { QuickDashboardEmpty } from './quick-dashboard-empty';
import { QuickRequestMobileCard } from './quick-request-mobile-card';
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

/** 목록 본문 — lg↑ 표 / lg↓ 카드 (CSS 전환 · designer K2) · 페이지네이션은 공용 · 행/카드 클릭 → 상세 (plan 94 D-7) */
export function QuickDashboardBody({
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
      <div data-testid='quick-dashboard-table' className='hidden min-w-0 lg:block'>
        <QuickDashboardDataTable
          table={table}
          onRowClick={openDetail}
          pageSizeOptions={QUICK_DASHBOARD_PAGE_SIZE_OPTIONS}
        />
      </div>
      <div className='flex min-w-0 flex-col gap-3 lg:hidden'>
        <ul data-testid='quick-dashboard-cards' className='flex min-w-0 flex-col gap-3'>
          {data.rows.map((row) => (
            <QuickRequestMobileCard
              key={row.id}
              row={row}
              onOpen={openDetail}
              onDispatch={onDispatch}
              onSetFinal={onSetFinal}
              onApprove={onApprove}
            />
          ))}
        </ul>
        <DataTablePagination table={table} pageSizeOptions={QUICK_DASHBOARD_PAGE_SIZE_OPTIONS} />
      </div>
    </div>
  );
}
