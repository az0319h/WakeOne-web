'use client';

import { useEffect, useRef } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { quickRequestSummaryQueryOptions } from '../../api/queries';
import type { QuickRequestRangeFilters, QuickRequestStatus } from '../../api/types';
import {
  QUICK_REQUEST_CARD_DESCRIPTIONS,
  QUICK_REQUEST_CARD_STATUSES,
  QUICK_REQUEST_STATUS_DOT_CLASS,
  QUICK_REQUEST_STATUS_LABELS
} from '../../lib/quick-request-status';

type QuickStatusCardsProps = {
  /** 선택 기간 — 카드 숫자는 이 기간 기준 (plan 97 D-4) */
  rangeFilters: QuickRequestRangeFilters;
  selected: QuickRequestStatus | null;
  /** 같은 카드를 다시 누르면 null(해제) */
  onSelect: (status: QuickRequestStatus | null) => void;
};

/** 선택된 칩을 줄 안에서 보이게 할 때 남기는 가장자리 여백(px · 줄 `px-4`와 같음) */
const CHIP_ROW_EDGE_PX = 16;

/**
 * lg 미만 칩 / lg 이상 카드 (plan 106 D-6 · designer §3.5 K14).
 * 같은 버튼 5개(testid 그대로)를 CSS로 배치만 바꾼다 — DOM 한 벌이라 testid 중복이 없다.
 * - lg 미만: 가로 한 줄 숫자 칩(옆으로 밀기 · 설명문 숨김 · 44px). 칩 글자(`innerText`)가 「신규요청 3」이 되도록
 *   라벨·숫자를 한 묶음 span에 넣는다(flex 자식이 나뉘면 innerText에 줄바꿈이 생김). lg 이상에서는 그 span이 `contents`.
 * - lg 이상: 지금 카드 4개 + 오른쪽 아래 「취소 N」 그대로.
 * Suspense 밖 · non-suspense `useQuery`(designer K5) · `keepPreviousData` · `aria-busy` (plan 40 filter shell).
 */
export function QuickStatusCards({ rangeFilters, selected, onSelect }: QuickStatusCardsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const { data: summary, isFetching } = useQuery({
    ...quickRequestSummaryQueryOptions(rangeFilters),
    placeholderData: keepPreviousData
  });
  const counts = summary?.counts;

  // 선택이 바뀌면(칩·필터 판) 그 칩이 줄 안에 보이게 — 줄만 가로로 민다(페이지는 스크롤하지 않음)
  useEffect(() => {
    const row = rowRef.current;
    if (!row || !selected || row.scrollWidth <= row.clientWidth) return;
    const chip = row.querySelector<HTMLElement>(`[data-status-chip='${selected}']`);
    if (!chip) return;
    const rowRect = row.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    if (chipRect.left < rowRect.left + CHIP_ROW_EDGE_PX) {
      row.scrollBy({ left: chipRect.left - rowRect.left - CHIP_ROW_EDGE_PX });
    } else if (chipRect.right > rowRect.right - CHIP_ROW_EDGE_PX) {
      row.scrollBy({ left: chipRect.right - rowRect.right + CHIP_ROW_EDGE_PX });
    }
  }, [selected]);

  function toggle(status: QuickRequestStatus) {
    onSelect(selected === status ? null : status);
  }

  return (
    <div
      ref={rowRef}
      role='group'
      aria-label='진행 상태'
      aria-busy={isFetching}
      className={cn(
        // lg 미만: 가로 밀기 칩 줄 (부모 패딩 안에서 가장자리까지 · 오른쪽 끝 흐림)
        '-mx-4 flex min-w-0 snap-x scroll-px-4 gap-2 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] md:-mx-6 md:scroll-px-6 md:px-6 [&::-webkit-scrollbar]:hidden',
        // 선택 ring·focus ring이 가로 스크롤 상자에 잘리지 않게 위아래 4px 여유 (레이아웃 높이는 그대로 44)
        'max-lg:-my-1 max-lg:py-1 max-lg:[mask-image:linear-gradient(to_right,black_calc(100%_-_1.5rem),transparent)]',
        // lg 이상: 지금 카드 그리드 (가로·세로 gap 8 = 이전 grid gap-2 + 「취소」 줄 gap-2)
        'lg:mx-0 lg:grid lg:snap-none lg:grid-cols-4 lg:overflow-visible lg:px-0'
      )}
    >
      {QUICK_REQUEST_CARD_STATUSES.map((status) => {
        const isSelected = selected === status;
        const count = counts?.[status];
        return (
          <Button
            key={status}
            type='button'
            variant='outline'
            aria-pressed={isSelected}
            data-testid={`quick-dashboard-card-${status}`}
            data-status-chip={status}
            onClick={() => toggle(status)}
            className={cn(
              'h-auto min-h-20 min-w-0 flex-col items-start justify-start gap-1 px-3 py-3 text-left font-normal whitespace-normal',
              'max-lg:h-11 max-lg:min-h-0 max-lg:shrink-0 max-lg:snap-start max-lg:flex-row max-lg:items-center max-lg:justify-center max-lg:gap-1.5 max-lg:rounded-full max-lg:py-0 max-lg:whitespace-nowrap',
              isSelected && 'border-primary bg-primary/5 ring-1 ring-primary hover:bg-primary/10'
            )}
          >
            <span className='contents max-lg:inline'>
              <span className='flex min-w-0 items-center gap-2 text-sm font-medium text-foreground max-lg:inline'>
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full max-lg:mr-1.5 max-lg:inline-block max-lg:align-middle',
                    QUICK_REQUEST_STATUS_DOT_CLASS[status]
                  )}
                />
                <span className='break-keep'>{QUICK_REQUEST_STATUS_LABELS[status]}</span>
              </span>{' '}
              <span
                aria-busy={count === undefined || isFetching}
                data-testid={`quick-dashboard-card-${status}-count`}
                className='text-2xl font-semibold text-foreground tabular-nums max-lg:text-sm'
              >
                {count ?? '—'}
              </span>
            </span>
            <span className='line-clamp-2 text-xs text-muted-foreground max-lg:hidden'>
              {QUICK_REQUEST_CARD_DESCRIPTIONS[status]}
            </span>
          </Button>
        );
      })}
      <Button
        type='button'
        variant='ghost'
        aria-pressed={selected === 'cancelled'}
        data-testid='quick-dashboard-card-cancelled'
        data-status-chip='cancelled'
        onClick={() => toggle('cancelled')}
        className={cn(
          'min-h-11 gap-1.5 tabular-nums lg:col-span-4 lg:h-9 lg:min-h-9 lg:justify-self-end',
          'max-lg:h-11 max-lg:shrink-0 max-lg:snap-start max-lg:rounded-full max-lg:border max-lg:bg-background max-lg:px-3 max-lg:shadow-xs max-lg:dark:border-input max-lg:dark:bg-input/30',
          selected === 'cancelled' && 'bg-accent text-accent-foreground ring-1 ring-primary'
        )}
      >
        <span className='contents max-lg:inline'>
          <span
            aria-hidden
            className={cn(
              'hidden size-2 rounded-full max-lg:mr-1.5 max-lg:inline-block max-lg:align-middle',
              QUICK_REQUEST_STATUS_DOT_CLASS.cancelled
            )}
          />
          {QUICK_REQUEST_STATUS_LABELS.cancelled}{' '}
          <span aria-busy={counts === undefined || isFetching}>{counts?.cancelled ?? '—'}</span>
        </span>
      </Button>
    </div>
  );
}
