'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { quickRequestSummaryQueryOptions } from '../../api/queries';
import type { QuickRequestStatus } from '../../api/types';
import {
  QUICK_REQUEST_CARD_DESCRIPTIONS,
  QUICK_REQUEST_CARD_STATUSES,
  QUICK_REQUEST_STATUS_DOT_CLASS,
  QUICK_REQUEST_STATUS_LABELS
} from '../../lib/quick-request-status';

type QuickStatusCardsProps = {
  selected: QuickRequestStatus | null;
  /** 같은 카드를 다시 누르면 null(해제) */
  onSelect: (status: QuickRequestStatus | null) => void;
};

/**
 * 상태 카드 4개 + 「취소 N」 — Suspense 밖 · non-suspense `useQuery`(designer K5).
 * 필터를 바꿔도 카드 숫자는 Spinner로 바뀌지 않는다(plan 40 filter shell).
 */
export function QuickStatusCards({ selected, onSelect }: QuickStatusCardsProps) {
  const { data: summary } = useQuery(quickRequestSummaryQueryOptions());
  const counts = summary?.counts;

  function toggle(status: QuickRequestStatus) {
    onSelect(selected === status ? null : status);
  }

  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <div className='grid grid-cols-2 gap-2 lg:grid-cols-4'>
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
              onClick={() => toggle(status)}
              className={cn(
                'h-auto min-h-20 min-w-0 flex-col items-start justify-start gap-1 px-3 py-3 text-left font-normal whitespace-normal',
                isSelected && 'border-primary bg-primary/5 ring-1 ring-primary hover:bg-primary/10'
              )}
            >
              <span className='flex min-w-0 items-center gap-2 text-sm font-medium text-foreground'>
                <span
                  aria-hidden
                  className={cn('size-2 shrink-0 rounded-full', QUICK_REQUEST_STATUS_DOT_CLASS[status])}
                />
                <span className='break-keep'>{QUICK_REQUEST_STATUS_LABELS[status]}</span>
              </span>
              <span
                aria-busy={count === undefined}
                data-testid={`quick-dashboard-card-${status}-count`}
                className='text-2xl font-semibold text-foreground tabular-nums'
              >
                {count ?? '—'}
              </span>
              <span className='line-clamp-2 text-xs text-muted-foreground'>
                {QUICK_REQUEST_CARD_DESCRIPTIONS[status]}
              </span>
            </Button>
          );
        })}
      </div>
      <div className='flex justify-end'>
        <Button
          type='button'
          variant='ghost'
          aria-pressed={selected === 'cancelled'}
          data-testid='quick-dashboard-card-cancelled'
          onClick={() => toggle('cancelled')}
          className={cn(
            'min-h-11 gap-1.5 tabular-nums lg:h-9 lg:min-h-9',
            selected === 'cancelled' && 'bg-accent text-accent-foreground ring-1 ring-primary'
          )}
        >
          {QUICK_REQUEST_STATUS_LABELS.cancelled}{' '}
          <span aria-busy={counts === undefined}>{counts?.cancelled ?? '—'}</span>
        </Button>
      </div>
    </div>
  );
}
