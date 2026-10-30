'use client';

import type { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export const QUICK_DASHBOARD_PAGINATION_TEXT = {
  total: (total: number) => `총 ${total}건`,
  perPage: '페이지당',
  page: (page: number, pageCount: number) => `${page} / ${pageCount} 페이지`,
  first: '첫 페이지',
  previous: '이전 페이지',
  next: '다음 페이지',
  last: '마지막 페이지'
} as const;

type QuickDashboardPaginationProps<TData> = {
  table: Table<TData>;
  /** 서버 `total` (DB 페이지네이션 · plan 97 D-3) — 「총 N건」 */
  total: number;
  pageSizeOptions: number[];
  className?: string;
};

/**
 * plan 106 D-9 · X-2 · designer §3.11 — PC 퀵 내역 한국어 페이지네이션.
 * ui `DataTablePagination`과 같은 배치·크기(`size-8` 버튼 · `h-8 w-[4.5rem]` Select)에서 글자만 바꾼다(ui 파일은 수정하지 않음).
 * 페이지 이동·페이지당 변경은 같은 `table` API(→ `useDataTable` URL `page`·`perPage`)를 쓴다.
 */
export function QuickDashboardPagination<TData>({
  table,
  total,
  pageSizeOptions,
  className
}: QuickDashboardPaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div
      data-testid='quick-dashboard-pagination'
      className={cn(
        'flex w-full flex-wrap items-center justify-between gap-2 overflow-auto p-1 sm:gap-8',
        className
      )}
    >
      <div
        data-testid='quick-dashboard-pagination-total'
        className='text-muted-foreground text-sm whitespace-nowrap tabular-nums'
      >
        {QUICK_DASHBOARD_PAGINATION_TEXT.total(total)}
      </div>
      <div className='flex items-center gap-2 sm:gap-6 lg:gap-8'>
        <div className='hidden items-center space-x-2 sm:flex'>
          <p className='text-sm font-medium whitespace-nowrap'>{QUICK_DASHBOARD_PAGINATION_TEXT.perPage}</p>
          <Select value={`${pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}>
            <SelectTrigger
              aria-label={QUICK_DASHBOARD_PAGINATION_TEXT.perPage}
              data-testid='quick-dashboard-pagination-per-page'
              className='h-8 w-[4.5rem] [&[data-size]]:h-8'
            >
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side='top'>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={`${option}`}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div
          data-testid='quick-dashboard-pagination-page'
          className='flex items-center justify-center text-sm font-medium whitespace-nowrap tabular-nums'
        >
          {QUICK_DASHBOARD_PAGINATION_TEXT.page(pageIndex + 1, pageCount)}
        </div>
        <div className='flex items-center space-x-1'>
          <Button
            type='button'
            aria-label={QUICK_DASHBOARD_PAGINATION_TEXT.first}
            variant='outline'
            size='icon'
            className='hidden size-8 lg:flex'
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <Icons.chevronsLeft aria-hidden />
          </Button>
          <Button
            type='button'
            aria-label={QUICK_DASHBOARD_PAGINATION_TEXT.previous}
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <Icons.chevronLeft aria-hidden />
          </Button>
          <Button
            type='button'
            aria-label={QUICK_DASHBOARD_PAGINATION_TEXT.next}
            variant='outline'
            size='icon'
            className='size-8'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <Icons.chevronRight aria-hidden />
          </Button>
          <Button
            type='button'
            aria-label={QUICK_DASHBOARD_PAGINATION_TEXT.last}
            variant='outline'
            size='icon'
            className='hidden size-8 lg:flex'
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
          >
            <Icons.chevronsRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
