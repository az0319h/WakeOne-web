'use client';

import { Suspense, useMemo, useState } from 'react';
import { useDataTable } from '@/hooks/use-data-table';
import { getSortingStateParser } from '@/lib/parsers';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { systemEmailLogsQueryOptions } from '../../api/queries';
import type { SystemEmailLogRun } from '../../api/types';
import { createColumns } from './columns';
import { RunDetailDialog } from './run-detail-dialog';
import { SystemEmailLogsDataTable } from './system-email-logs-data-table';

interface SystemEmailLogsTableBodyProps {
  columns: ReturnType<typeof createColumns>;
  filters: {
    page: number;
    limit: number;
    search?: string;
    sort?: string;
  };
  onRowClick: (run: SystemEmailLogRun) => void;
}

function SystemEmailLogsTableBody({
  columns,
  filters,
  onRowClick
}: SystemEmailLogsTableBodyProps) {
  const { data } = useSuspenseQuery(systemEmailLogsQueryOptions(filters));
  const pageCount = Math.ceil(data.total / filters.limit);

  const { table } = useDataTable({
    data: data.items,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      sorting: [{ id: 'created_at', desc: true }]
    }
  });

  return <SystemEmailLogsDataTable table={table} onRowClick={onRowClick} />;
}

export function SystemEmailLogsTable() {
  const columns = useMemo(() => createColumns(), []);
  const columnIds = columns.map((column) => column.id).filter(Boolean) as string[];
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    search: parseAsString,
    sort: getSortingStateParser(columnIds).withDefault([])
  });

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.search && { search: params.search }),
    ...(params.sort.length > 0 && { sort: JSON.stringify(params.sort) })
  };

  const querySignature = JSON.stringify(filters);

  const { table: shellTable } = useDataTable({
    data: [] as SystemEmailLogRun[],
    columns,
    pageCount: 1,
    shallow: true,
    debounceMs: 500,
    initialState: {
      sorting: [{ id: 'created_at', desc: true }]
    }
  });

  function handleRowClick(run: SystemEmailLogRun) {
    setSelectedRunId(run.id);
    setDetailOpen(true);
  }

  return (
    <>
      <div data-testid='system-email-logs-page' className='flex min-w-0 flex-1 flex-col'>
        <DataTableToolbar table={shellTable} />
        <Suspense key={querySignature} fallback={<PageLoadingSpinner variant='fill' />}>
          <SystemEmailLogsTableBody
            columns={columns}
            filters={filters}
            onRowClick={handleRowClick}
          />
        </Suspense>
      </div>
      <RunDetailDialog
        runId={selectedRunId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedRunId(null);
          }
        }}
      />
    </>
  );
}
