'use client';

import { type Table as TanstackTable, flexRender } from '@tanstack/react-table';
import { Fragment, useState, type ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Icons } from '@/components/icons';
import { getCommonPinningStyles } from '@/lib/data-table';
import { cn } from '@/lib/utils';
import type { ActivityLog } from '../../api/types';
import { ExpandPanel, getRowStatusHintClass, isRowExpandable } from './expand-panel';

interface ActivityLogsDataTableProps extends ComponentProps<'div'> {
  table: TanstackTable<ActivityLog>;
  actionBar?: React.ReactNode;
}

export function ActivityLogsDataTable({
  table,
  actionBar,
  children
}: ActivityLogsDataTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  function toggleRow(rowId: string) {
    setExpandedRows((current) => ({
      ...current,
      [rowId]: !current[rowId]
    }));
  }

  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div className='flex flex-1 flex-col space-y-4'>
      {children}
      <div className='relative flex flex-1'>
        <div className='absolute inset-0 flex overflow-hidden rounded-lg border'>
          <ScrollArea className='h-full w-full'>
            <Table>
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
                  table.getRowModel().rows.map((row) => {
                    const log = row.original;
                    const expandable = isRowExpandable(log);
                    const isExpanded = Boolean(expandedRows[row.id]);
                    const statusHintClass = getRowStatusHintClass(log.http_status);

                    return (
                      <Fragment key={row.id}>
                        <TableRow
                          data-state={row.getIsSelected() && 'selected'}
                          className={cn(statusHintClass)}
                        >
                          {row.getVisibleCells().map((cell) => {
                            if (cell.column.id === 'expand') {
                              return (
                                <TableCell key={cell.id} className='w-10 px-2'>
                                  {expandable ? (
                                    <Button
                                      type='button'
                                      variant='ghost'
                                      size='icon'
                                      className='size-7'
                                      aria-expanded={isExpanded}
                                      aria-label={isExpanded ? '행 접기' : '행 펼치기'}
                                      onClick={() => toggleRow(row.id)}
                                    >
                                      <Icons.chevronDown
                                        className={cn(
                                          'size-4 transition-transform',
                                          isExpanded && 'rotate-180'
                                        )}
                                      />
                                    </Button>
                                  ) : null}
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell
                                key={cell.id}
                                style={{
                                  ...getCommonPinningStyles({ column: cell.column })
                                }}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        {expandable && isExpanded ? (
                          <TableRow className={cn('hover:bg-transparent', statusHintClass)}>
                            <TableCell colSpan={columnCount} className='p-0'>
                              <div className='px-4 py-3'>
                                <ExpandPanel log={log} />
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={columnCount} className='h-24 text-center'>
                      활동 로그가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation='horizontal' />
          </ScrollArea>
        </div>
      </div>
      <div className='flex flex-col gap-2.5'>
        <DataTablePagination table={table} />
        {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 && actionBar}
      </div>
    </div>
  );
}
