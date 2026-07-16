'use client';

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { SystemEmailLogRun } from '../../api/types';
import { RunStatusBadge, TriggerSourceBadge } from './status-badges';

function TimeCell({ createdAt }: { createdAt: string }) {
  const date = new Date(createdAt);
  const executedAt = format(date, 'yyyy-MM-dd (EEE) HH:mm:ss', { locale: ko });

  return <span className='font-mono text-xs whitespace-nowrap'>{executedAt}</span>;
}

function RunKeyCell({ runKey }: { runKey: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='block max-w-[140px] truncate font-mono text-xs'>{runKey}</span>
      </TooltipTrigger>
      <TooltipContent>{runKey}</TooltipContent>
    </Tooltip>
  );
}

function CountCell({ value, highlight }: { value: number; highlight?: 'danger' | 'warning' }) {
  return (
    <span
      className={cn(
        'tabular-nums',
        highlight === 'danger' && value > 0 && 'text-destructive',
        highlight === 'warning' && value > 0 && 'text-amber-600 dark:text-amber-400'
      )}
    >
      {value}
    </span>
  );
}

export function createColumns(): ColumnDef<SystemEmailLogRun>[] {
  return [
    {
      id: 'created_at',
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title='실행 시각' />,
      cell: ({ row }) => <TimeCell createdAt={row.original.created_at} />
    },
    {
      id: 'run_key',
      accessorKey: 'run_key',
      header: ({ column }) => <DataTableColumnHeader column={column} title='run_key' />,
      cell: ({ row }) => <RunKeyCell runKey={row.original.run_key} />
    },
    {
      id: 'trigger_source',
      accessorKey: 'trigger_source',
      header: 'trigger',
      cell: ({ row }) => <TriggerSourceBadge source={row.original.trigger_source} />
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title='status' />,
      cell: ({ row }) => <RunStatusBadge status={row.original.status} />
    },
    {
      id: 'target_count',
      accessorKey: 'target_count',
      header: '대상 수',
      cell: ({ row }) => <CountCell value={row.original.target_count} />
    },
    {
      id: 'sent_count',
      accessorKey: 'sent_count',
      header: '발송 성공',
      cell: ({ row }) => <CountCell value={row.original.sent_count} />
    },
    {
      id: 'failed_count',
      accessorKey: 'failed_count',
      header: '실패',
      cell: ({ row }) => <CountCell value={row.original.failed_count} highlight='danger' />
    },
    {
      id: 'unmatched_count',
      accessorKey: 'unmatched_count',
      header: '미매칭',
      cell: ({ row }) => <CountCell value={row.original.unmatched_count} highlight='warning' />
    }
  ];
}
