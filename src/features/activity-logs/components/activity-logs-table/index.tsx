'use client';

import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useNavAccess } from '@/contexts/nav-access';
import { useDataTable } from '@/hooks/use-data-table';
import { getSortingStateParser } from '@/lib/parsers';
import { cn } from '@/lib/utils';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { activityLogsQueryOptions } from '../../api/queries';
import { LogUserCombobox } from '../log-user-combobox';
import { ActivityLogsDataTable } from './activity-logs-data-table';
import { createColumns } from './columns';

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

  const { data } = useSuspenseQuery(activityLogsQueryOptions(filters));

  const pageCount = Math.ceil(data.total / params.perPage);

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

  function handleLogUserChange(nextValue: string) {
    void setParams({ log_user: nextValue, page: 1 });
  }

  return (
    <div data-testid='activity-logs-page' className='flex flex-1 flex-col'>
      <ActivityLogsDataTable table={table}>
        <div className='flex w-full flex-wrap items-start gap-2 p-1'>
          {isAdmin ? (
            <LogUserCombobox value={logUser ?? 'self'} onValueChange={handleLogUserChange} />
          ) : null}
          <DataTableToolbar table={table} className={cn('min-w-0 flex-1 p-0')} />
        </div>
      </ActivityLogsDataTable>
    </div>
  );
}

export function ActivityLogsTableSkeleton() {
  return (
    <div className='flex flex-1 animate-pulse flex-col gap-4'>
      <div className='bg-muted h-10 w-full rounded' />
      <div className='bg-muted h-96 w-full rounded-lg' />
      <div className='bg-muted h-10 w-full rounded' />
    </div>
  );
}
