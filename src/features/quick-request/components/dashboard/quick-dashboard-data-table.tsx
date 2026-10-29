'use client';

import { type Table as TanstackTable, flexRender } from '@tanstack/react-table';

import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { DataTableScrollContainer } from '@/components/ui/table/data-table-scroll-container';
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
import type { QuickRequestListRow } from '../../api/types';
import { isInteractiveClickTarget } from '../../lib/is-interactive-click-target';

type QuickDashboardDataTableProps = {
  table: TanstackTable<QuickRequestListRow>;
  /** 행 아무 셀 클릭 / 행 포커스 후 Enter·Space → 상세 (plan 94 D-7) */
  onRowClick: (row: QuickRequestListRow) => void;
  /** plan 97 D-2 — 10 · 20 · 50 */
  pageSizeOptions?: number[];
};

/**
 * plan 94 D-7 · designer §4.3 — 퀵 대시보드 표 (`src/components/ui/table/data-table.tsx` 구조 복제 · system-email-logs 선례).
 * 행에 `tabIndex`·키보드·focus ring을 더한다. 셀 안 버튼·링크(「접수」·「상세」·「새 대화 N」)는 가드로 전파 차단.
 * `hover:bg-muted/50`은 `TableRow` 기본 스타일.
 */
export function QuickDashboardDataTable({
  table,
  onRowClick,
  pageSizeOptions
}: QuickDashboardDataTableProps) {
  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div className='flex min-w-0 flex-col space-y-4'>
      <DataTableScrollContainer>
        <Table className='w-max min-w-full'>
          <TableHeader className='bg-muted sticky top-0 z-10'>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ ...getCommonPinningStyles({ column: header.column }) }}
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
                const { requestNo } = row.original;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    data-testid={`quick-row-${requestNo}`}
                    tabIndex={0}
                    aria-label={`${requestNo} 상세 보기`}
                    className={cn(
                      'cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset'
                    )}
                    onClick={(event) => {
                      if (isInteractiveClickTarget(event.target)) return;
                      onRowClick(row.original);
                    }}
                    onKeyDown={(event) => {
                      // 셀 안 버튼에서 Enter → 그 버튼만 (행 이동 없음)
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row.original);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{ ...getCommonPinningStyles({ column: cell.column }) }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columnCount} className='h-24 text-center'>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableScrollContainer>
      <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
    </div>
  );
}
