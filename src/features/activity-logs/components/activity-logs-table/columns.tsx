'use client';

import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ActivityLog } from '../../api/types';
import {
  ACTION_LABELS,
  formatTargetLabel,
  getResultBadgeClass,
  getResultLabel
} from '../../labels';
import { ACTION_OPTIONS } from './options';

interface CreateColumnsOptions {
  isAdmin: boolean;
}

function TimeCell({ createdAt }: { createdAt: string }) {
  return (
    <span className='font-mono text-xs whitespace-nowrap'>
      {formatAbsoluteDateTimeKo(createdAt)}
    </span>
  );
}

function EndpointCell({ path }: { path: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='block max-w-[220px] truncate font-mono text-xs'>{path}</span>
      </TooltipTrigger>
      <TooltipContent className='max-w-sm font-mono text-xs break-all'>{path}</TooltipContent>
    </Tooltip>
  );
}

function ActorCell({ log }: { log: ActivityLog }) {
  const displayName = log.actor_display_name_resolved ?? log.actor_display_name;
  const label = displayName ?? log.actor_email;

  return (
    <div className='flex flex-col'>
      <span className='text-sm font-medium'>{label}</span>
      {displayName ? (
        <span className='text-muted-foreground text-xs'>{log.actor_email}</span>
      ) : null}
    </div>
  );
}

function TargetCell({ log }: { log: ActivityLog }) {
  const targetLabel = log.target_label_resolved ?? log.target_label;

  return <span className='text-sm'>{formatTargetLabel(targetLabel)}</span>;
}

function ResultCell({ httpStatus }: { httpStatus: number }) {
  return (
    <Badge variant='outline' className={cn(getResultBadgeClass(httpStatus))}>
      {getResultLabel(httpStatus)}
    </Badge>
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
      id: 'created_at',
      accessorKey: 'created_at',
      header: ({ column }: { column: Column<ActivityLog, unknown> }) => (
        <DataTableColumnHeader column={column} title='시간' />
      ),
      cell: ({ row }) => <TimeCell createdAt={row.original.created_at} />
    },
    {
      id: 'actor',
      accessorFn: (row) =>
        row.actor_display_name_resolved ?? row.actor_display_name ?? row.actor_email,
      header: '행위자',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => <ActorCell log={row.original} />
    },
    {
      id: 'action',
      accessorKey: 'action',
      header: '활동',
      enableSorting: false,
      enableColumnFilter: isAdmin,
      meta: isAdmin
        ? {
            label: '활동 유형',
            variant: 'select' as const,
            options: ACTION_OPTIONS
          }
        : undefined,
      cell: ({ row }) => (
        <span className='text-sm'>{ACTION_LABELS[row.original.action]}</span>
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
      id: 'search',
      accessorKey: 'target_label',
      header: '대상',
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
      cell: ({ row }) => <TargetCell log={row.original} />
    },
    {
      id: 'result',
      accessorKey: 'http_status',
      header: '결과',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => <ResultCell httpStatus={row.original.http_status} />
    }
  ];

  return columns;
}
