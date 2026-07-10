'use client';

import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { useDataTable } from '@/hooks/use-data-table';
import { getSortingStateParser } from '@/lib/parsers';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { useMemo, useState } from 'react';
import { systemEmailLogsQueryOptions } from '../../api/queries';
import type { SystemEmailLogRun } from '../../api/types';
import { createColumns } from './columns';
import { RunDetailDialog } from './run-detail-dialog';
import { SystemEmailLogsDataTable } from './system-email-logs-data-table';

export function SystemEmailLogsTable() {
  const columns = useMemo(() => createColumns(), []);
  const columnIds = columns.map((column) => column.id).filter(Boolean) as string[];
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    sort: getSortingStateParser(columnIds).withDefault([])
  });

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.sort.length > 0 && { sort: JSON.stringify(params.sort) })
  };

  const { data } = useSuspenseQuery(systemEmailLogsQueryOptions(filters));
  const pageCount = Math.ceil(data.total / params.perPage);

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

  function handleRowClick(run: SystemEmailLogRun) {
    setSelectedRunId(run.id);
    setDetailOpen(true);
  }

  return (
    <>
      <div data-testid='system-email-logs-page'>
        <SystemEmailLogsDataTable table={table} onRowClick={handleRowClick} />
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

export function SystemEmailLogsTableSkeleton() {
  return <DataTableSkeleton columnCount={8} rowCount={10} filterCount={0} />;
}
