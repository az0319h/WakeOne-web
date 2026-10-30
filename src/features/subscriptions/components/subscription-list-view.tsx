'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { keepPreviousData, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AssetLedgerEmpty } from '@/features/asset-ledger/components/asset-ledger-empty';
import { AssetLedgerFilterBar } from '@/features/asset-ledger/components/asset-ledger-filter-bar';
import {
  AssetLedgerPagination,
  formatRangeSummary
} from '@/features/asset-ledger/components/asset-ledger-pagination';
import { AssetLedgerQueryBoundary } from '@/features/asset-ledger/components/asset-ledger-query-boundary';
import { AssetLedgerTable } from '@/features/asset-ledger/components/asset-ledger-table';
import { AssetLedgerUnderlineTabs } from '@/features/asset-ledger/components/asset-ledger-underline-tabs';
import {
  useLedgerDialogParams,
  useLedgerListParams
} from '@/features/asset-ledger/hooks/use-ledger-params';
import { subscriptionListQueryOptions } from '../api/queries';
import {
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_CATEGORY_LABELS,
  SUBSCRIPTION_DEFAULT_STATUSES,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_LABELS,
  type SubscriptionCategory,
  type SubscriptionFilters,
  type SubscriptionStatus
} from '../api/types';
import { SubscriptionCard } from './subscription-card';
import { SubscriptionCardFilter } from './subscription-card-filter';
import { buildSubscriptionColumns } from './subscription-columns';

const LIST_CONFIG = {
  tabKey: 'category',
  tabValues: SUBSCRIPTION_CATEGORIES,
  statuses: SUBSCRIPTION_STATUSES,
  defaultStatuses: SUBSCRIPTION_DEFAULT_STATUSES
} as const;

const TAB_ITEMS = [
  { value: 'all', label: '전체' },
  ...SUBSCRIPTION_CATEGORIES.map((category) => ({
    value: category,
    label: SUBSCRIPTION_CATEGORY_LABELS[category]
  }))
];

const STATUS_OPTIONS = SUBSCRIPTION_STATUSES.map((status) => ({
  value: status,
  label: SUBSCRIPTION_STATUS_LABELS[status]
}));

type SubscriptionListBodyProps = {
  filters: SubscriptionFilters;
  isManager: boolean;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onShowAllScope: () => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
};

/** 목록 본문 — md↑ 표 / md 미만 카드 (CSS 전환 · 페이지네이션·빈 상태는 한 벌) */
function SubscriptionListBody({
  filters,
  isManager,
  hasActiveFilters,
  onResetFilters,
  onShowAllScope,
  onPageChange,
  onPerPageChange
}: SubscriptionListBodyProps) {
  const { data } = useSuspenseQuery(subscriptionListQueryOptions(filters));
  const { openRow } = useLedgerDialogParams('subscription');
  const columns = useMemo(() => buildSubscriptionColumns({ isManager }), [isManager]);
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 20;
  const pageCount = Math.max(1, Math.ceil(data.total / perPage));
  const hiddenText = data.hidden_count > 0 ? `해지됨 ${data.hidden_count}개 숨김` : null;

  useEffect(() => {
    if (data.total > 0 && page > pageCount) onPageChange(pageCount);
  }, [data.total, page, pageCount, onPageChange]);

  if (data.team_unavailable) {
    return (
      <AssetLedgerEmpty
        data-testid='asset-team-unavailable'
        icon='teams'
        title='부서가 정해지지 않아 팀 목록을 볼 수 없어요.'
        action={
          <Button type='button' variant='outline' className='h-11 md:h-9' onClick={onShowAllScope}>
            전체 보기
          </Button>
        }
      />
    );
  }

  if (data.total === 0) {
    return (
      <AssetLedgerEmpty
        data-testid='asset-list-empty'
        icon='search'
        title='조건에 맞는 구독이 없어요.'
        description={hiddenText}
        action={
          hasActiveFilters ? (
            <Button type='button' variant='outline' className='h-11 md:h-9' onClick={onResetFilters}>
              필터 초기화
            </Button>
          ) : null
        }
      />
    );
  }

  const summary = [formatRangeSummary(data.total, Math.min(page, pageCount), perPage, '개'), hiddenText]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      {/* 768~1023px에서는 표 오른쪽 열(상태·만료·결제)이 잘려 lg부터 표 · 그 아래는 카드 */}
      <div className='hidden min-w-0 lg:block'>
        <AssetLedgerTable
          data-testid='subscription-table'
          data={data.items}
          columns={columns}
          getRowId={(row) => String(row.id)}
          rowTestId={(row) => `subscription-row-${row.id}`}
          rowLabel={(row) => `${row.name} 자세히 보기`}
          onRowClick={(row) => openRow(row.id)}
        />
      </div>
      <ul data-testid='asset-list-cards' className='flex min-w-0 flex-col gap-3 lg:hidden'>
        {data.items.map((item) => (
          <SubscriptionCard key={item.id} item={item} onOpen={openRow} />
        ))}
      </ul>
      <AssetLedgerPagination
        summary={summary}
        page={page}
        pageCount={pageCount}
        perPage={perPage}
        onPageChange={onPageChange}
        onPerPageChange={onPerPageChange}
      />
    </div>
  );
}

type SubscriptionListViewProps = {
  isManager: boolean;
};

/**
 * 구독 목록 화면 (designer §2-3) — 탭·필터 줄은 Suspense **밖**, 표/카드 본문만 Spinner(plan 40).
 * 탭 건수는 같은 목록 캐시를 읽기만 하고(조회 안 함) 직전 값을 유지한다.
 */
export function SubscriptionListView({ isManager }: SubscriptionListViewProps) {
  const params = useLedgerListParams<SubscriptionCategory, SubscriptionStatus>(LIST_CONFIG);
  const { state } = params;

  const filters = useMemo<SubscriptionFilters>(
    () => ({
      category: state.tab,
      scope: state.scope,
      status: state.statusMode === 'default' ? undefined : state.statuses,
      // 권한자 전용 — 직원 URL에 card가 있어도 요청에 넣지 않는다(403 방지 · designer §14-10)
      card: isManager && state.card ? state.card : undefined,
      q: state.q ?? undefined,
      page: state.page,
      perPage: state.perPage
    }),
    [state, isManager]
  );

  const { data: cached } = useQuery({
    ...subscriptionListQueryOptions(filters),
    enabled: false,
    placeholderData: keepPreviousData
  });

  const { setScope, setPage } = params;
  const showAllScope = useCallback(() => setScope('all'), [setScope]);
  const cardValue = isManager ? state.card : null;

  return (
    <AssetLedgerUnderlineTabs
      items={TAB_ITEMS}
      value={state.tab}
      onValueChange={params.setTab}
      counts={cached?.counts}
      listTestId='subscription-category-tabs'
      tabTestIdPrefix='subscription-category-tab'
      ariaLabel='구독 구분'
    >
      <AssetLedgerFilterBar
        targetType='subscription'
        searchPlaceholder='구독명 검색'
        query={state.q}
        onQueryChange={params.setQuery}
        scope={state.scope}
        onScopeChange={params.setScope}
        statusOptions={STATUS_OPTIONS}
        statuses={state.statuses}
        statusIsCustom={state.statusMode !== 'default'}
        onStatusesChange={params.setStatuses}
        onStatusReset={params.resetStatuses}
        hasActiveFilters={state.hasActiveFilters}
        onReset={params.resetFilters}
        sheetFiltersActive={state.statusMode !== 'default' || cardValue !== null}
        managerFilter={
          isManager ? (
            <SubscriptionCardFilter
              variant='desktop'
              value={cardValue}
              options={cached?.card_options ?? []}
              onChange={params.setCard}
            />
          ) : undefined
        }
        managerFilterMobile={
          isManager ? (
            <SubscriptionCardFilter
              variant='mobile'
              value={cardValue}
              options={cached?.card_options ?? []}
              onChange={params.setCard}
            />
          ) : undefined
        }
      />
      <AssetLedgerQueryBoundary
        errorMessage='구독 목록을 불러오지 못했어요.'
        resetKey={JSON.stringify(filters)}
      >
        <SubscriptionListBody
          filters={filters}
          isManager={isManager}
          hasActiveFilters={state.hasActiveFilters}
          onResetFilters={params.resetFilters}
          onShowAllScope={showAllScope}
          onPageChange={setPage}
          onPerPageChange={params.setPerPage}
        />
      </AssetLedgerQueryBoundary>
    </AssetLedgerUnderlineTabs>
  );
}
