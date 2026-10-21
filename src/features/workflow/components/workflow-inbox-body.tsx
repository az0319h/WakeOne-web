'use client';

import { useMemo, useState } from 'react';
import {
  usePrefetchInfiniteQuery,
  useSuspenseInfiniteQuery,
  type InfiniteData
} from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { workflowListInfiniteQueryOptions } from '../api/queries';
import type { WorkflowListPage } from '../api/service';
import type { WorkflowListRow } from '../api/types';
import {
  buildWorkflowListRequest,
  hasActiveWorkflowFilters,
  type WorkflowListFilters
} from '../lib/search-params';
import { ApproverAvatarStack } from './workflow-person';
import { WorkflowStatusBadge } from './workflow-status-badge';

function flattenRows(data: InfiniteData<WorkflowListPage> | undefined): WorkflowListRow[] {
  const seen = new Set<string>();
  const rows: WorkflowListRow[] = [];
  for (const page of data?.pages ?? []) {
    for (const row of page.rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 행
// ---------------------------------------------------------------------------
function WorkflowListRowItem({ row, onOpen }: { row: WorkflowListRow; onOpen: (id: string) => void }) {
  return (
    <li className='border-b last:border-b-0'>
      <Button
        type='button'
        variant='ghost'
        data-testid={`workflow-row-${row.code}`}
        onClick={() => onOpen(row.id)}
        className='h-auto min-h-16 w-full items-start justify-start gap-3 rounded-none px-2 py-3 text-left font-normal whitespace-normal hover:bg-muted/50 md:px-3'
      >
        <span
          aria-hidden
          className='grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xl'
        >
          {row.template.emoji}
        </span>
        <span className='flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-4'>
          <span className='flex min-w-0 flex-1 flex-col gap-1'>
            <span className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
              <span className='truncate text-sm font-medium text-foreground'>{row.writer.full_name}</span>
              <time
                dateTime={row.updated_at}
                className='text-xs whitespace-nowrap text-muted-foreground tabular-nums'
              >
                {formatAbsoluteDateTimeKo(row.updated_at)}
              </time>
              <WorkflowStatusBadge
                status={row.status}
                currentStep={row.current_step}
                totalSteps={row.total_steps}
                approvalRequired={row.my_state.approval_required}
              />
            </span>
            <span className='flex min-w-0 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-2'>
              <span className='flex shrink-0 items-baseline gap-2'>
                <span className='text-sm font-medium text-foreground'>{row.template.name}</span>
                <span className='font-mono text-xs text-muted-foreground'>{row.code}</span>
              </span>
              {row.summary ? (
                <span className='line-clamp-2 min-w-0 text-sm text-muted-foreground md:truncate'>
                  {row.summary}
                </span>
              ) : null}
            </span>
          </span>
          <span className='flex shrink-0 items-center gap-2'>
            {row.attachment_count > 0 ? (
              <Badge variant='outline' className='gap-1 font-normal text-muted-foreground'>
                <Icons.paperclip aria-hidden className='size-3.5' />
                첨부파일 {row.attachment_count}건
              </Badge>
            ) : null}
            <ApproverAvatarStack approvers={row.approvers_preview} total={row.approvers_total} />
          </span>
        </span>
      </Button>
    </li>
  );
}

function LoadMoreButton({
  hasNextPage,
  isFetchingNextPage,
  onClick
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onClick: () => void;
}) {
  if (!hasNextPage) return null;
  return (
    <div className='flex justify-center pt-2'>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        data-testid='workflow-load-more'
        className='h-9'
        isLoading={isFetchingNextPage}
        onClick={onClick}
      >
        더보기
        <Icons.chevronDown aria-hidden />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 그룹 (진행중 탭)
// ---------------------------------------------------------------------------
type GroupQuery = {
  data: InfiniteData<WorkflowListPage>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
};

function WorkflowListGroup({
  title,
  testId,
  query,
  onOpen
}: {
  title: string;
  testId: string;
  query: GroupQuery;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const rows = useMemo(() => flattenRows(query.data), [query.data]);
  const total = query.data.pages[0]?.total ?? 0;
  const contentId = `${testId}-content`;

  return (
    <section data-testid={testId} aria-label={title} className='flex flex-col'>
      <div className='flex items-center justify-between gap-2 py-2'>
        <h2 className='text-sm font-semibold'>
          {title} <span className='text-muted-foreground tabular-nums'>{total}</span>
        </h2>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          aria-expanded={open}
          aria-controls={contentId}
          className='h-9 text-muted-foreground'
          onClick={() => setOpen((current) => !current)}
        >
          {open ? '접기' : '펼치기'}
          {open ? <Icons.chevronUp aria-hidden /> : <Icons.chevronDown aria-hidden />}
        </Button>
      </div>
      {open ? (
        <div id={contentId}>
          <ul className='rounded-lg border'>
            {rows.map((row) => (
              <WorkflowListRowItem key={row.id} row={row} onOpen={onOpen} />
            ))}
          </ul>
          <LoadMoreButton
            hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          />
        </div>
      ) : null}
    </section>
  );
}

function WorkflowEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center'>
      <Icons.clipboardText aria-hidden className='size-10 text-muted-foreground' />
      <p className='text-sm font-medium'>문서가 없습니다.</p>
      {filtered ? (
        <p className='text-xs text-muted-foreground'>검색 조건을 바꾸거나 초기화해 보세요.</p>
      ) : null}
    </div>
  );
}

function InProgressGroups({
  filters,
  onOpen
}: {
  filters: WorkflowListFilters;
  onOpen: (id: string) => void;
}) {
  const approvalOptions = workflowListInfiniteQueryOptions(
    buildWorkflowListRequest(filters, 'approval_required')
  );
  const progressOptions = workflowListInfiniteQueryOptions(
    buildWorkflowListRequest(filters, 'in_progress')
  );
  // 두 그룹을 동시에 요청한다 (Suspense waterfall 방지)
  usePrefetchInfiniteQuery(approvalOptions);
  usePrefetchInfiniteQuery(progressOptions);

  const approval = useSuspenseInfiniteQuery(approvalOptions);
  const progress = useSuspenseInfiniteQuery(progressOptions);

  const approvalTotal = approval.data.pages[0]?.total ?? 0;
  const progressTotal = progress.data.pages[0]?.total ?? 0;

  if (approvalTotal === 0 && progressTotal === 0) {
    return <WorkflowEmptyState filtered={hasActiveWorkflowFilters(filters)} />;
  }

  return (
    <div className='flex flex-col gap-4'>
      {approvalTotal > 0 ? (
        <WorkflowListGroup
          title='승인 필요 문서'
          testId='workflow-group-approval-required'
          query={approval}
          onOpen={onOpen}
        />
      ) : null}
      {progressTotal > 0 ? (
        <WorkflowListGroup
          title='진행중 문서'
          testId='workflow-group-in-progress'
          query={progress}
          onOpen={onOpen}
        />
      ) : null}
    </div>
  );
}

function FlatList({ filters, onOpen }: { filters: WorkflowListFilters; onOpen: (id: string) => void }) {
  const query = useSuspenseInfiniteQuery(
    workflowListInfiniteQueryOptions(buildWorkflowListRequest(filters, null))
  );
  const rows = useMemo(() => flattenRows(query.data), [query.data]);

  if (rows.length === 0) {
    return <WorkflowEmptyState filtered={hasActiveWorkflowFilters(filters)} />;
  }

  return (
    <div className='flex flex-col'>
      <ul className='rounded-lg border'>
        {rows.map((row) => (
          <WorkflowListRowItem key={row.id} row={row} onOpen={onOpen} />
        ))}
      </ul>
      <LoadMoreButton
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        onClick={() => void query.fetchNextPage()}
      />
    </div>
  );
}

export function WorkflowInboxBody({
  filters,
  onOpen,
  className
}: {
  filters: WorkflowListFilters;
  onOpen: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      {filters.tab === 'in_progress' ? (
        <InProgressGroups filters={filters} onOpen={onOpen} />
      ) : (
        <FlatList filters={filters} onOpen={onOpen} />
      )}
    </div>
  );
}
