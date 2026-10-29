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
import { equipmentListQueryOptions } from '../api/queries';
import {
  EQUIPMENT_DEFAULT_STATUSES,
  EQUIPMENT_KINDS,
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_STATUSES,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentFilters,
  type EquipmentKind,
  type EquipmentStatus
} from '../api/types';
import { EquipmentCard } from './equipment-card';
import { buildEquipmentColumns } from './equipment-columns';

const LIST_CONFIG = {
  tabKey: 'kind',
  tabValues: EQUIPMENT_KINDS,
  statuses: EQUIPMENT_STATUSES,
  defaultStatuses: EQUIPMENT_DEFAULT_STATUSES
} as const;

const TAB_ITEMS = [
  { value: 'all', label: '전체' },
  ...EQUIPMENT_KINDS.map((kind) => ({ value: kind, label: EQUIPMENT_KIND_LABELS[kind] }))
];

const STATUS_OPTIONS = EQUIPMENT_STATUSES.map((status) => ({
  value: status,
  label: EQUIPMENT_STATUS_LABELS[status]
}));

type EquipmentListBodyProps = {
  filters: EquipmentFilters;
  isManager: boolean;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onShowAllScope: () => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
};

/** 목록 본문 — md↑ 표 / md 미만 카드 (CSS 전환 · AC-15 표는 DOM에 남고 숨김) */
function EquipmentListBody({
  filters,
  isManager,
  hasActiveFilters,
  onResetFilters,
  onShowAllScope,
  onPageChange,
  onPerPageChange
}: EquipmentListBodyProps) {
  const { data } = useSuspenseQuery(equipmentListQueryOptions(filters));
  const { openRow } = useLedgerDialogParams('equipment');
  const columns = useMemo(() => buildEquipmentColumns({ isManager }), [isManager]);
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 20;
  const pageCount = Math.max(1, Math.ceil(data.total / perPage));
  const hiddenText = data.hidden_count > 0 ? `폐기 ${data.hidden_count}대 숨김` : null;

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
        title='조건에 맞는 비품이 없어요.'
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

  const summary = [formatRangeSummary(data.total, Math.min(page, pageCount), perPage, '대'), hiddenText]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <div className='hidden min-w-0 md:block'>
        <AssetLedgerTable
          data-testid='equipment-table'
          data={data.items}
          columns={columns}
          getRowId={(row) => String(row.id)}
          rowTestId={(row) => `equipment-row-${row.id}`}
          rowLabel={(row) =>
            `${[row.asset_no, row.model_serial].filter(Boolean).join(' ')} 자세히 보기`
          }
          onRowClick={(row) => openRow(row.id)}
        />
      </div>
      <ul data-testid='asset-list-cards' className='flex min-w-0 flex-col gap-3 md:hidden'>
        {data.items.map((item) => (
          <EquipmentCard key={item.id} item={item} onOpen={openRow} />
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

type EquipmentListViewProps = {
  isManager: boolean;
};

/** 비품 목록 화면 — 탭·필터 줄은 Suspense **밖**, 표/카드 본문만 Spinner(plan 40) */
export function EquipmentListView({ isManager }: EquipmentListViewProps) {
  const params = useLedgerListParams<EquipmentKind, EquipmentStatus>(LIST_CONFIG);
  const { state } = params;

  const filters = useMemo<EquipmentFilters>(
    () => ({
      kind: state.tab,
      scope: state.scope,
      status: state.statusMode === 'default' ? undefined : state.statuses,
      q: state.q ?? undefined,
      page: state.page,
      perPage: state.perPage
    }),
    [state]
  );

  const { data: cached } = useQuery({
    ...equipmentListQueryOptions(filters),
    enabled: false,
    placeholderData: keepPreviousData
  });

  const { setScope, setPage } = params;
  const showAllScope = useCallback(() => setScope('all'), [setScope]);

  return (
    <AssetLedgerUnderlineTabs
      items={TAB_ITEMS}
      value={state.tab}
      onValueChange={params.setTab}
      counts={cached?.counts}
      listTestId='equipment-kind-tabs'
      tabTestIdPrefix='equipment-kind-tab'
      ariaLabel='비품 품목'
    >
      <AssetLedgerFilterBar
        targetType='equipment'
        searchPlaceholder='자산번호·모델·시리얼 검색'
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
        sheetFiltersActive={state.statusMode !== 'default'}
      />
      <AssetLedgerQueryBoundary
        errorMessage='비품 목록을 불러오지 못했어요.'
        resetKey={JSON.stringify(filters)}
      >
        <EquipmentListBody
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
