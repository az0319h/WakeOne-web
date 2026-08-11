'use client';

import { Suspense, useMemo } from 'react';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { useNavAccess } from '@/contexts/nav-access';
import { useDataTable } from '@/hooks/use-data-table';
import { getSortingStateParser } from '@/lib/parsers';
import { cn } from '@/lib/utils';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { activityLogsQueryOptions } from '../../api/queries';
import type { ActivityLog } from '../../api/types';
import { LogUserCombobox } from '../log-user-combobox';
import { ActivityLogsDataTable } from './activity-logs-data-table';
import { createColumns } from './columns';

interface ActivityLogsTableBodyProps {
  columns: ReturnType<typeof createColumns>;
  filters: {
    page: number;
    limit: number;
    sort?: string;
    log_user?: string;
    action?: string;
    search?: string;
  };
}

function ActivityLogsTableBody({ columns, filters }: ActivityLogsTableBodyProps) {
  const { data } = useSuspenseQuery(activityLogsQueryOptions(filters));
  const pageCount = Math.ceil(data.total / filters.limit);

  const { table } = useDataTable({
    data: data.logs,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    initialState: {
      sorting: [{ id: 'created_at', desc: true }]
    }
  });

  return <ActivityLogsDataTable table={table} />;
}

export function ActivityLogsTable() {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';

  const columns = useMemo(() => createColumns({ isAdmin }), [isAdmin]);
  const columnIds = columns.map((column) => column.id).filter(Boolean) as string[];

  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    log_user: parseAsString.withDefault('self'),
    action: parseAsString,
    search: parseAsString,
    sort: getSortingStateParser(columnIds).withDefault([])
  });

  const logUser = isAdmin ? (params.log_user ?? 'self') : undefined;

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.sort.length > 0 && { sort: JSON.stringify(params.sort) }),
    ...(isAdmin && { log_user: logUser }),
    ...(isAdmin && params.action && { action: params.action }),
    ...(isAdmin && params.search && { search: params.search })
  };

  const querySignature = JSON.stringify(filters);

  const { table: shellTable } = useDataTable({
    data: [] as ActivityLog[],
    columns,
    pageCount: 1,
    shallow: true,
    debounceMs: 500,
    initialState: {
      sorting: [{ id: 'created_at', desc: true }]
    }
  });

  function handleLogUserChange(nextValue: string) {
    void setParams({ log_user: nextValue, page: 1 });
  }

  return (
    <div data-testid='activity-logs-page' className='flex min-w-0 flex-1 flex-col'>
      <div className='flex w-full flex-wrap items-start gap-2 p-1'>
        {isAdmin ? (
          <LogUserCombobox value={logUser ?? 'self'} onValueChange={handleLogUserChange} />
        ) : null}
        <DataTableToolbar table={shellTable} className={cn('min-w-0 flex-1 p-0')} />
      </div>
      <Suspense key={querySignature} fallback={<PageLoadingSpinner variant='fill' />}>
        <ActivityLogsTableBody columns={columns} filters={filters} />
      </Suspense>
    </div>
  );
}
