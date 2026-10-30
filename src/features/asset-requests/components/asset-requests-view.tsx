'use client';

import { useEffect, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AssetLedgerEmpty } from '@/features/asset-ledger/components/asset-ledger-empty';
import {
  AssetLedgerPagination,
  formatRangeSummary
} from '@/features/asset-ledger/components/asset-ledger-pagination';
import { AssetLedgerQueryBoundary } from '@/features/asset-ledger/components/asset-ledger-query-boundary';
import { AssetLedgerTable } from '@/features/asset-ledger/components/asset-ledger-table';
import { AssetStatusBadge } from '@/features/asset-ledger/components/asset-status-badge';
import {
  useLedgerDialogParams,
  useLedgerRequestListParams
} from '@/features/asset-ledger/hooks/use-ledger-params';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { assetRequestListQueryOptions } from '../api/queries';
import {
  requestTypeLabel,
  type AssetRequestFilters,
  type AssetRequestListItem,
  type AssetRequestStatusFilter,
  type AssetTargetType
} from '../api/types';

const STATUS_FILTER_OPTIONS: { value: AssetRequestStatusFilter; label: string }[] = [
  { value: 'open', label: '진행 중' },
  { value: 'done', label: '끝난 요청' },
  { value: 'all', label: '전체' }
];

const EMPTY_TEXT: Record<AssetRequestStatusFilter, string> = {
  open: '진행 중인 요청이 없어요.',
  done: '끝난 요청이 없어요.',
  all: '아직 요청이 없어요.'
};

function AssigneeName({ name }: { name: string | null }) {
  if (!name) {
    return <span className='text-amber-700 dark:text-amber-400'>담당자 없음</span>;
  }
  return <span translate='no'>{name}</span>;
}

function CommentCount({ count }: { count: number }) {
  return (
    <span
      className='inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums'
      aria-label={`댓글 ${count}개`}
    >
      <Icons.chat aria-hidden className='size-3.5' />
      {count}
    </span>
  );
}

function buildColumns(targetType: AssetTargetType): ColumnDef<AssetRequestListItem, unknown>[] {
  return [
    {
      id: 'request_type',
      header: '요청 종류',
      cell: ({ row }) => (
        <span className='font-medium whitespace-nowrap'>
          {requestTypeLabel(targetType, row.original.request_type)}
        </span>
      )
    },
    {
      id: 'target',
      header: '대상',
      cell: ({ row }) => (
        <span
          className='block max-w-64 truncate'
          translate='no'
          title={row.original.target_label}
        >
          {row.original.target_label}
        </span>
      )
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => <AssetStatusBadge kind='request' status={row.original.status} />
    },
    {
      id: 'requester',
      header: '요청자',
      cell: ({ row }) => (
        <span className='whitespace-nowrap' translate='no'>
          {row.original.requester_name}
        </span>
      )
    },
    {
      id: 'assignee',
      header: '담당자',
      cell: ({ row }) => (
        <span className='whitespace-nowrap'>
          <AssigneeName name={row.original.assignee_name} />
        </span>
      )
    },
    {
      id: 'created_at',
      header: '요청 시각',
      cell: ({ row }) => (
        <span className='font-mono text-xs whitespace-nowrap tabular-nums'>
          {formatAbsoluteDateTimeKo(row.original.created_at)}
        </span>
      )
    },
    {
      id: 'comment_count',
      header: '댓글',
      cell: ({ row }) => <CommentCount count={row.original.comment_count} />
    }
  ];
}

type AssetRequestCardProps = {
  targetType: AssetTargetType;
  item: AssetRequestListItem;
  onOpen: (id: number) => void;
};

/** 휴대폰 요청 카드 (`asset-request-card-{id}`) */
function AssetRequestCard({ targetType, item, onOpen }: AssetRequestCardProps) {
  const typeLabel = requestTypeLabel(targetType, item.request_type);
  return (
    <li>
      <button
        type='button'
        data-testid={`asset-request-card-${item.id}`}
        aria-label={`${typeLabel} 요청 ${item.target_label} 자세히 보기`}
        onClick={() => onOpen(item.id)}
        className='flex w-full min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
      >
        <span className='flex w-full items-center justify-between gap-2'>
          <span className='font-medium'>{typeLabel}</span>
          <AssetStatusBadge kind='request' status={item.status} />
        </span>
        <span className='w-full truncate text-sm' translate='no'>
          {item.target_label}
        </span>
        <span className='text-xs text-muted-foreground tabular-nums'>
          <span translate='no'>{item.requester_name}</span> ·{' '}
          <span className='font-mono'>{formatAbsoluteDateTimeKo(item.created_at)}</span>
        </span>
        <span className='flex w-full items-center justify-between gap-2 text-xs'>
          <span>
            <span className='text-muted-foreground'>담당 </span>
            <AssigneeName name={item.assignee_name} />
          </span>
          <CommentCount count={item.comment_count} />
        </span>
      </button>
    </li>
  );
}

type AssetRequestsBodyProps = {
  targetType: AssetTargetType;
  filters: AssetRequestFilters;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
};

function AssetRequestsBody({ targetType, filters, onPageChange, onPerPageChange }: AssetRequestsBodyProps) {
  const { data } = useSuspenseQuery(assetRequestListQueryOptions(filters));
  const { openRequest } = useLedgerDialogParams(targetType);
  const columns = useMemo(() => buildColumns(targetType), [targetType]);
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 20;
  const pageCount = Math.max(1, Math.ceil(data.total / perPage));

  useEffect(() => {
    if (data.total > 0 && page > pageCount) onPageChange(pageCount);
  }, [data.total, page, pageCount, onPageChange]);

  if (data.total === 0) {
    const status = filters.status ?? 'open';
    return (
      <AssetLedgerEmpty
        data-testid='asset-requests-empty'
        icon='chat'
        title={filters.mine_assigned ? '내가 담당한 요청이 없어요.' : EMPTY_TEXT[status]}
      />
    );
  }

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      {/* 768~1023px에서는 표 오른쪽 열이 잘려 lg부터 표 · 그 아래는 카드 */}
      <div className='hidden min-w-0 lg:block'>
        <AssetLedgerTable
          data-testid='asset-requests-table'
          data={data.items}
          columns={columns}
          getRowId={(row) => String(row.id)}
          rowTestId={(row) => `asset-request-row-${row.id}`}
          rowLabel={(row) => `${requestTypeLabel(targetType, row.request_type)} 요청 ${row.target_label} 자세히 보기`}
          onRowClick={(row) => openRequest(row.id)}
        />
      </div>
      <ul className='flex min-w-0 flex-col gap-3 lg:hidden'>
        {data.items.map((item) => (
          <AssetRequestCard key={item.id} targetType={targetType} item={item} onOpen={openRequest} />
        ))}
      </ul>
      <AssetLedgerPagination
        summary={formatRangeSummary(data.total, Math.min(page, pageCount), perPage, '건')}
        page={page}
        pageCount={pageCount}
        perPage={perPage}
        onPageChange={onPageChange}
        onPerPageChange={onPerPageChange}
      />
    </div>
  );
}

type AssetRequestsViewProps = {
  targetType: AssetTargetType;
  isManager: boolean;
};

/**
 * 요청 화면 (`view=requests` · designer §2-10) — 필터 줄은 Suspense 밖 · 표/카드 본문만 Spinner.
 * 직원은 본인 요청만(서버) · `mine_assigned`는 권한자에게만 렌더하고, 직원 URL에 있어도 요청에 넣지 않는다(403 방지).
 */
export function AssetRequestsView({ targetType, isManager }: AssetRequestsViewProps) {
  const { status, mineAssigned, page, perPage, setStatus, setMineAssigned, setPage, setPerPage } =
    useLedgerRequestListParams();

  const filters = useMemo<AssetRequestFilters>(
    () => ({
      target_type: targetType,
      status,
      mine_assigned: isManager && mineAssigned ? true : undefined,
      page,
      perPage
    }),
    [targetType, status, isManager, mineAssigned, page, perPage]
  );

  return (
    <div className='flex min-w-0 flex-col gap-4'>
      {!isManager ? (
        <p data-testid='asset-requests-mine-note' className='text-sm text-muted-foreground'>
          내가 보낸 요청만 보여요.
        </p>
      ) : null}
      <div className='flex flex-wrap items-center gap-2'>
        <ToggleGroup
          type='single'
          variant='outline'
          aria-label='요청 상태'
          data-testid='asset-request-status-filter'
          value={status}
          onValueChange={(next) => {
            if (!next) return;
            setStatus(next as AssetRequestStatusFilter);
          }}
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              data-testid={`asset-request-status-${option.value}`}
              className='h-11 px-3 md:h-9'
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {isManager ? (
          <Toggle
            variant='outline'
            data-testid='asset-requests-mine-only'
            pressed={mineAssigned}
            onPressedChange={setMineAssigned}
            className='h-11 px-3 md:h-9'
          >
            내 담당만
          </Toggle>
        ) : null}
      </div>
      <AssetLedgerQueryBoundary
        errorMessage='요청 목록을 불러오지 못했어요.'
        resetKey={JSON.stringify(filters)}
      >
        <AssetRequestsBody
          targetType={targetType}
          filters={filters}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
        />
      </AssetLedgerQueryBoundary>
    </div>
  );
}
