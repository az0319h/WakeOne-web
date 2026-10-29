'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ASSET_PER_PAGE_OPTIONS } from '../api/types';

type AssetLedgerPaginationProps = {
  /** 「24개 중 1–20 · 해지됨 3개 숨김」 */
  summary: string;
  page: number;
  pageCount: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
};

/**
 * plan 103 · designer §2-9 · C-13 — 한국어 요약 + 10/20/50 + 이전·다음 + 「1 / 3」.
 * 표·카드 공용 한 벌만 둔다(testid 중복 방지).
 */
export function AssetLedgerPagination({
  summary,
  page,
  pageCount,
  perPage,
  onPageChange,
  onPerPageChange
}: AssetLedgerPaginationProps) {
  const safePageCount = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), safePageCount);

  return (
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <p
        data-testid='asset-list-summary'
        aria-live='polite'
        className='text-sm text-muted-foreground tabular-nums'
      >
        {summary}
      </p>
      <div className='flex items-center gap-2'>
        <Select value={String(perPage)} onValueChange={(value) => onPerPageChange(Number(value))}>
          <SelectTrigger
            data-testid='asset-page-size'
            aria-label='한 페이지에 보일 수'
            className='h-11 w-20 tabular-nums md:h-8'
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSET_PER_PAGE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type='button'
          variant='outline'
          size='icon'
          aria-label='이전 페이지'
          data-testid='asset-page-prev'
          className='size-11 md:size-8'
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <Icons.chevronLeft aria-hidden />
        </Button>
        <span className='min-w-12 text-center text-sm tabular-nums'>
          {current} / {safePageCount}
        </span>
        <Button
          type='button'
          variant='outline'
          size='icon'
          aria-label='다음 페이지'
          data-testid='asset-page-next'
          className='size-11 md:size-8'
          disabled={current >= safePageCount}
          onClick={() => onPageChange(current + 1)}
        >
          <Icons.chevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** 「{total}{unit} 중 {from}–{to}」 */
export function formatRangeSummary(total: number, page: number, perPage: number, unit: string): string {
  if (total <= 0) return `${total}${unit}`;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  return `${total}${unit} 중 ${from}–${to}`;
}
