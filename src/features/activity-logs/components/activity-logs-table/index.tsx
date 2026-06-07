'use client';

import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useNavAccess } from '@/contexts/nav-access';
import { useDataTable } from '@/hooks/use-data-table';
import { getSortingStateParser } from '@/lib/parsers';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { activityLogsQueryOptions } from '../../api/queries';
import { ActivityLogsDataTable } from './activity-logs-data-table';
import { createColumns } from './columns';

export function ActivityLogsTable() {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';

  const columns = useMemo(() => createColumns({ isAdmin }), [isAdmin]);
  const columnIds = columns.map((column) => column.id).filter(Boolean) as string[];

  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    actor_search: parseAsString,
    action: parseAsString,
    search: parseAsString,
    sort: getSortingStateParser(columnIds).withDefault([])
  });

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.sort.length > 0 && { sort: JSON.stringify(params.sort) }),
    ...(isAdmin && params.actor_search && { actor_search: params.actor_search }),
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

  return (
    <ActivityLogsDataTable table={table}>
      <DataTableToolbar table={table} />
    </ActivityLogsDataTable>
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
