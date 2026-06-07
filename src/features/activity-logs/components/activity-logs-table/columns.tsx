'use client';

import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { ActivityLog } from '../../api/types';
import { ACTION_OPTIONS } from './options';

interface CreateColumnsOptions {
  isAdmin: boolean;
}

function getMethodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200';
    case 'PUT':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200';
    case 'PATCH':
      return 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200';
    case 'DELETE':
      return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200';
    default:
      return '';
  }
}

function getStatusBadgeClass(status: number): string {
  if (status >= 500) {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300';
  }

  if (status >= 400) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300';
  }

  if (status >= 200 && status < 300) {
    return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300';
  }

  return '';
}

function RequestIdCell({ requestId }: { requestId: string }) {
  const shortId = requestId.slice(0, 8);

  function handleCopy() {
    void navigator.clipboard.writeText(requestId);
    notifySuccess('Request ID가 복사되었습니다.');
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          onClick={handleCopy}
          className='text-muted-foreground hover:text-foreground font-mono text-xs underline-offset-2 hover:underline'
        >
          {shortId}…
        </button>
      </TooltipTrigger>
      <TooltipContent>클릭하여 복사 · {requestId}</TooltipContent>
    </Tooltip>
  );
}

function TimeCell({ createdAt }: { createdAt: string }) {
  const date = new Date(createdAt);
  const relative = formatDistanceToNow(date, { addSuffix: true, locale: ko });
  const absolute = format(date, 'yyyy.MM.dd HH:mm:ss', { locale: ko });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='text-sm whitespace-nowrap'>{relative}</span>
      </TooltipTrigger>
      <TooltipContent>{absolute}</TooltipContent>
    </Tooltip>
  );
}

function EndpointCell({ path }: { path: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='block max-w-[200px] truncate font-mono text-xs'>{path}</span>
      </TooltipTrigger>
      <TooltipContent className='max-w-sm font-mono text-xs break-all'>{path}</TooltipContent>
    </Tooltip>
  );
}

function ActorCell({ log }: { log: ActivityLog }) {
  const label = log.actor_display_name ?? log.actor_email;

  return (
    <div className='flex flex-col'>
      <span className='text-sm font-medium'>{label}</span>
      {log.actor_display_name ? (
        <span className='text-muted-foreground text-xs'>{log.actor_email}</span>
      ) : null}
    </div>
  );
}

export function createColumns({ isAdmin }: CreateColumnsOptions): ColumnDef<ActivityLog>[] {
  const columns: ColumnDef<ActivityLog>[] = [
    {
      id: 'expand',
      header: () => null,
      cell: () => null,
      enableSorting: false,
      enableHiding: false,
      size: 40
    },
    {
      id: 'http_method',
      accessorKey: 'http_method',
      header: 'Method',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <Badge variant='outline' className={cn('font-mono', getMethodBadgeClass(row.original.http_method))}>
          {row.original.http_method}
        </Badge>
      )
    },
    {
      id: 'http_path',
      accessorKey: 'http_path',
      header: 'Endpoint',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => <EndpointCell path={row.original.http_path} />
    },
    {
      id: 'http_status',
      accessorKey: 'http_status',
      header: ({ column }: { column: Column<ActivityLog, unknown> }) => (
        <DataTableColumnHeader column={column} title='Status' />
      ),
      cell: ({ row }) => (
        <Badge
          variant='outline'
          className={cn('font-mono tabular-nums', getStatusBadgeClass(row.original.http_status))}
        >
          {row.original.http_status}
        </Badge>
      )
    },
    {
      id: 'created_at',
      accessorKey: 'created_at',
      header: ({ column }: { column: Column<ActivityLog, unknown> }) => (
        <DataTableColumnHeader column={column} title='Time' />
      ),
      cell: ({ row }) => <TimeCell createdAt={row.original.created_at} />
    },
    {
      id: 'request_id',
      accessorKey: 'request_id',
      header: 'Request ID',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => <RequestIdCell requestId={row.original.request_id} />
    },
    {
      id: isAdmin ? 'actor_search' : 'actor',
      accessorFn: (row) => row.actor_display_name ?? row.actor_email,
      header: 'Actor',
      enableSorting: false,
      enableColumnFilter: isAdmin,
      meta: isAdmin
        ? {
            label: '행위자',
            placeholder: '행위자 검색…',
            variant: 'text' as const,
            icon: Icons.search
          }
        : undefined,
      cell: ({ row }) => <ActorCell log={row.original} />
    },
    {
      id: 'action',
      accessorKey: 'action',
      header: ({ column }: { column: Column<ActivityLog, unknown> }) => (
        <DataTableColumnHeader column={column} title='Action' />
      ),
      enableColumnFilter: isAdmin,
      meta: isAdmin
        ? {
            label: 'Action',
            variant: 'select' as const,
            options: ACTION_OPTIONS
          }
        : undefined,
      cell: ({ row }) => (
        <Badge variant='secondary' className='font-mono text-xs'>
          {row.original.action}
        </Badge>
      )
    },
    {
      id: isAdmin ? 'search' : 'target_label',
      accessorKey: 'target_label',
      header: 'Target',
      enableSorting: false,
      enableColumnFilter: isAdmin,
      meta: isAdmin
        ? {
            label: '대상',
            placeholder: '대상 검색…',
            variant: 'text' as const,
            icon: Icons.search
          }
        : undefined,
      cell: ({ row }) => <span className='text-sm'>{row.original.target_label}</span>
    }
  ];

  return columns;
}
