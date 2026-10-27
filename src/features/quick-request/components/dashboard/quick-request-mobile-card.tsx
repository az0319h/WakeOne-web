'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import type { QuickRequestListRow } from '../../api/types';
import { formatQuickAmountWon } from '../../lib/format-quick-amount';
import {
  formatQuickGoodsLabel,
  formatQuickVehicleSummary
} from '../../lib/quick-request-route-label';
import { QuickRequestRouteDot } from '../quick-request-summary-content';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { QuickUnreadChatBadge, quickRequestDetailHref } from './quick-dashboard-columns';
import {
  QuickRequestRowAction,
  resolveQuickRowAction,
  type QuickRequestRowActionHandlers
} from './quick-request-row-action';

type QuickRequestMobileCardProps = QuickRequestRowActionHandlers & {
  row: QuickRequestListRow;
};

/** lg 미만 카드 — 표와 같은 데이터 · testid `quick-card-*` (카드 전체는 링크가 아님) */
export function QuickRequestMobileCard({ row, ...handlers }: QuickRequestMobileCardProps) {
  const hasAction = resolveQuickRowAction(row) !== null;

  return (
    <li
      data-testid={`quick-card-${row.requestNo}`}
      className='flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground'
    >
      <div className='flex min-w-0 items-start justify-between gap-2'>
        <QuickRequestStatusBadge status={row.status} />
        <div className='flex min-w-0 items-center gap-2'>
          <QuickUnreadChatBadge
            requestNo={row.requestNo}
            count={row.unreadMessageCount}
            className='min-h-7 px-2'
          />
          <span translate='no' className='text-base font-semibold tabular-nums'>
            {row.requestNo}
          </span>
        </div>
      </div>
      <p className='flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground'>
        <time dateTime={row.requestedAt} className='tabular-nums'>
          {formatAbsoluteDateTimeKo(row.requestedAt)}
        </time>
        <span aria-hidden>·</span>
        <span className='max-w-32 truncate'>{row.requester.name}</span>
      </p>
      <p className='flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm break-words'>
        <QuickRequestRouteDot kind='origin' />
        <span>{row.route.from}</span>
        <span aria-hidden>→</span>
        <QuickRequestRouteDot kind='destination' />
        <span>{row.route.to}</span>
        {row.route.stopoverCount > 0 ? (
          <span className='text-muted-foreground'>· 경유 {row.route.stopoverCount}</span>
        ) : null}
      </p>
      <p className='text-sm text-muted-foreground'>
        {formatQuickGoodsLabel(row.goodsSize)} · {formatQuickVehicleSummary(row)}
      </p>
      <dl className='grid grid-cols-2 gap-2 text-sm'>
        <div className='flex min-w-0 items-baseline gap-2'>
          <dt className='text-muted-foreground'>예상</dt>
          <dd className='tabular-nums'>{formatQuickAmountWon(row.estimatedAmount)}</dd>
        </div>
        <div className='flex min-w-0 items-baseline gap-2'>
          <dt className='text-muted-foreground'>최종</dt>
          <dd className='tabular-nums'>{formatQuickAmountWon(row.finalAmount)}</dd>
        </div>
      </dl>
      <div className={cn('grid gap-2', hasAction ? 'grid-cols-2' : 'grid-cols-1')}>
        <Button variant='outline' className='h-11' asChild>
          <Link
            href={quickRequestDetailHref(row.requestNo)}
            aria-label={`${row.requestNo} 상세 보기`}
            data-testid={`quick-card-detail-${row.requestNo}`}
          >
            상세 보기
          </Link>
        </Button>
        {hasAction ? (
          <QuickRequestRowAction
            row={row}
            layout='card'
            testId={`quick-card-action-${row.requestNo}`}
            {...handlers}
          />
        ) : null}
      </div>
    </li>
  );
}
