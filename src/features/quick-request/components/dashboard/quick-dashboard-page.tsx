'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useQueryStates, parseAsInteger } from 'nuqs';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Icons } from '@/components/icons';
import type { QuickRequestListRow } from '../../api/types';
import { QuickApproveAlert, type QuickApproveTarget } from '../dialogs/quick-approve-alert';
import { QuickDispatchDialog } from '../dialogs/quick-dispatch-dialog';
import {
  QuickFinalAmountDialog,
  type QuickFinalAmountTarget
} from '../dialogs/quick-final-amount-dialog';
import { QuickRequestQueryBoundary } from '../quick-request-query-boundary';
import { QuickRequestRealtime } from '../quick-request-realtime';
import { QuickDashboardBody } from './quick-dashboard-body';
import { QuickDashboardMetaBar } from './quick-dashboard-meta-bar';
import { QuickDashboardToolbar } from './quick-dashboard-toolbar';
import { QuickStatusCards } from './quick-status-cards';
import { toQuickDashboardRangeFilters, useQuickDashboardParams } from './use-quick-dashboard-params';

const subscribeNoop = () => () => undefined;

/** SSR·hydration 중 false → 목록은 hydration 뒤 클라이언트에서 조회한다 (workflow 선례) */
function useIsHydrated() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

type QuickDashboardPageProps = {
  canCreate: boolean;
  /** plan 94 D-3 — `quick-requests:all`(viewer-all) 또는 `quick-user:{uid}` (서버 page가 권한 판정) */
  realtimeTopic: string;
};

/**
 * 퀵 대시보드 client 셸 — 메타바·카드·툴바(Suspense 밖) + 목록 본문 + Dialog 1벌.
 * plan 97 — `suspenseKey`에 기간(range/from/to)이 들어가 기간 변경 시 본문만 `PageLoadingSpinner fill` 재진입.
 * plan 106 designer §3.3 — lg 미만은 메타바 → 칩 줄 → [검색][필터] → 카드 사이를 `gap-3`(12px)로 줄여 첫 카드를 위로 올린다.
 */
export function QuickDashboardPage({ canCreate, realtimeTopic }: QuickDashboardPageProps) {
  const { filters, setStatus, setSearch, setRange, resetFilters } = useQuickDashboardParams();
  const [, setPageParams] = useQueryStates({ page: parseAsInteger }, { shallow: true });
  const isHydrated = useIsHydrated();
  const suspenseKey = JSON.stringify(filters);
  const rangeFilters = toQuickDashboardRangeFilters(filters);

  const [dispatchRequestNo, setDispatchRequestNo] = useState<string | null>(null);
  const [finalTarget, setFinalTarget] = useState<QuickFinalAmountTarget | null>(null);
  const [approveTarget, setApproveTarget] = useState<QuickApproveTarget | null>(null);

  const handleDispatch = useCallback((row: QuickRequestListRow) => {
    setDispatchRequestNo(row.requestNo);
  }, []);
  const handleSetFinal = useCallback((row: QuickRequestListRow) => {
    setFinalTarget({ requestNo: row.requestNo, estimatedAmount: row.estimatedAmount });
  }, []);
  const handleApprove = useCallback((row: QuickRequestListRow) => {
    setApproveTarget({ requestNo: row.requestNo, finalAmount: row.finalAmount });
  }, []);
  const handlePageOverflow = useCallback(
    (lastPage: number) => void setPageParams({ page: lastPage }),
    [setPageParams]
  );
  /** 기간 0건 빈 상태 「전체 기간 보기」 (mobile-ux 2차 A#6) */
  const handleShowAllRange = useCallback(
    () => setRange({ range: 'all', from: null, to: null }),
    [setRange]
  );

  return (
    <>
      <QuickRequestRealtime topic={realtimeTopic} />
      <div data-testid='quick-dashboard' className='flex min-w-0 flex-1 flex-col gap-3 lg:gap-4'>
        <QuickDashboardMetaBar rangeFilters={rangeFilters} />
        <QuickStatusCards rangeFilters={rangeFilters} selected={filters.status} onSelect={setStatus} />
        <QuickDashboardToolbar
          filters={filters}
          onRangeChange={setRange}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onReset={resetFilters}
        />
        <div className='flex min-w-0 flex-1 flex-col'>
          {isHydrated ? (
            <QuickRequestQueryBoundary
              key={suspenseKey}
              errorMessage='퀵 요청 목록을 불러오지 못했습니다.'
              loadingFallback={<PageLoadingSpinner variant='fill' />}
            >
              <QuickDashboardBody
                filters={filters}
                canCreate={canCreate}
                onResetFilters={resetFilters}
                onShowAllRange={handleShowAllRange}
                onPageOverflow={handlePageOverflow}
                onDispatch={handleDispatch}
                onSetFinal={handleSetFinal}
                onApprove={handleApprove}
              />
            </QuickRequestQueryBoundary>
          ) : (
            <PageLoadingSpinner variant='fill' />
          )}
        </div>
        <p
          data-testid='quick-dashboard-footnote'
          className='flex items-start gap-2 text-sm text-muted-foreground'
        >
          <Icons.info aria-hidden className='mt-0.5 size-4 shrink-0' />
          운송 완료 후 실제 금액을 확인하고 승인해주세요.
        </p>
      </div>

      <QuickDispatchDialog
        requestNo={dispatchRequestNo}
        onOpenChange={(open) => {
          if (!open) setDispatchRequestNo(null);
        }}
      />
      <QuickFinalAmountDialog
        target={finalTarget}
        onOpenChange={(open) => {
          if (!open) setFinalTarget(null);
        }}
      />
      <QuickApproveAlert
        target={approveTarget}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
      />
    </>
  );
}
