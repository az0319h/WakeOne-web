'use client';

import { type Table as TanstackTable, flexRender } from '@tanstack/react-table';
import { type ComponentProps } from 'react';

import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getCommonPinningStyles } from '@/lib/data-table';
import { cn } from '@/lib/utils';
import type { SystemEmailLogRun } from '../../api/types';

interface SystemEmailLogsDataTableProps extends ComponentProps<'div'> {
  table: TanstackTable<SystemEmailLogRun>;
  onRowClick?: (run: SystemEmailLogRun) => void;
}

export function SystemEmailLogsDataTable({
  table,
  onRowClick,
  children
}: SystemEmailLogsDataTableProps) {
  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div className='flex flex-1 flex-col space-y-4'>
      {children}
      <div className='relative flex flex-1'>
        <div className='absolute inset-0 flex overflow-hidden rounded-lg border'>
          <ScrollArea className='h-full w-full'>
            <Table data-testid='system-email-logs-table'>
              <TableHeader className='bg-muted sticky top-0 z-10'>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{
                          ...getCommonPinningStyles({ column: header.column })
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      data-run-id={row.original.id}
                      data-testid='system-email-log-row'
                      className={cn(onRowClick && 'hover:bg-muted/50 cursor-pointer')}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-label={onRowClick ? `run ${row.original.run_key} 상세 보기` : undefined}
                      onClick={() => onRowClick?.(row.original)}
                      onKeyDown={(event) => {
                        if (!onRowClick) {
                          return;
                        }

                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row.original);
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            ...getCommonPinningStyles({ column: cell.column })
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columnCount} className='h-24 text-center'>
                      독촉 이메일 로그가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation='horizontal' />
          </ScrollArea>
        </div>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
