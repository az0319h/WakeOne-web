'use client';

import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { DataTableScrollContainer } from '@/components/ui/table/data-table-scroll-container';
import { cn } from '@/lib/utils';

/** 셀/카드 안 버튼·링크를 눌렀으면 행 이동을 하지 않는다 (quick 대시보드 가드와 같은 규칙) */
const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="menuitem"], [role="checkbox"], [data-no-row-click]';

function isInteractiveClickTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

type AssetLedgerTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  getRowId: (row: TData) => string;
  rowTestId: (row: TData) => string;
  rowLabel: (row: TData) => string;
  onRowClick: (row: TData) => void;
  'data-testid': string;
};

/**
 * plan 103 · designer §1 — 구독·비품·요청 표 (quick-dashboard-data-table 구조 복제).
 * 행 전체 클릭 · 포커스 후 Enter/Space · 첫 칸 왼쪽 고정(표 안 가로 스크롤 시 이름이 남게) · 정렬·선택 UI 없음.
 * 0건은 본문이 빈 상태로 먼저 끊으므로 표에는 빈 행 문구가 없다.
 */
export function AssetLedgerTable<TData>({
  data,
  columns,
  getRowId,
  rowTestId,
  rowLabel,
  onRowClick,
  ...rest
}: AssetLedgerTableProps<TData>) {
  const coreRowModel = useMemo(() => getCoreRowModel<TData>(), []);
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: coreRowModel,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true
  });

  return (
    <DataTableScrollContainer data-testid={rest['data-testid']}>
      <Table className='w-max min-w-full'>
        <TableHeader className='bg-muted'>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className='hover:bg-muted'>
              {headerGroup.headers.map((header, index) => {
                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      'h-10 px-3 text-xs font-medium text-muted-foreground',
                      index === 0 && 'sticky left-0 z-[1] bg-muted shadow-[inset_-1px_0_0_var(--border)]'
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-testid={rowTestId(row.original)}
              tabIndex={0}
              aria-label={rowLabel(row.original)}
              className={cn(
                'group/row cursor-pointer hover:bg-muted',
                'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset'
              )}
              onClick={(event) => {
                if (isInteractiveClickTarget(event.target)) return;
                onRowClick(row.original);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRowClick(row.original);
                }
              }}
            >
              {row.getVisibleCells().map((cell, index) => {
                return (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      'px-3 py-3 align-middle',
                      index === 0 &&
                        'sticky left-0 z-[1] bg-background shadow-[inset_-1px_0_0_var(--border)] group-hover/row:bg-muted'
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTableScrollContainer>
  );
}
