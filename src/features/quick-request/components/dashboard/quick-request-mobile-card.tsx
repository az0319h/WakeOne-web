'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import type { QuickRequestListRow } from '../../api/types';
import { formatQuickAmountWon } from '../../lib/format-quick-amount';
import { isInteractiveClickTarget } from '../../lib/is-interactive-click-target';
import {
  formatQuickGoodsLabel,
  formatQuickVehicleSummary
} from '../../lib/quick-request-route-label';
import { QuickRequestRouteDot } from '../quick-request-summary-content';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import {
  QuickParticipantBadge,
  QuickUnreadChatBadge,
  quickRequestDetailHref
} from './quick-dashboard-columns';
import {
  QuickRequestRowAction,
  resolveQuickRowAction,
  type QuickRequestRowActionHandlers
} from './quick-request-row-action';

type QuickRequestMobileCardProps = QuickRequestRowActionHandlers & {
  row: QuickRequestListRow;
  /** 카드 본문 탭 / 포커스 후 Enter·Space → 상세 (plan 94 D-7) */
  onOpen: (row: QuickRequestListRow) => void;
};

/**
 * lg 미만 카드 — 표와 같은 데이터 · testid `quick-card-*`.
 * 카드 전체 탭 → 상세 (plan 94 D-7). 안의 「새 대화 N」 Link·「상세 보기」 Link·업무 버튼은 가드로 전파 차단.
 * `role`은 주지 않는다(ul>li 시맨틱 유지) — 접근성 1차 경로는 「상세 보기」 Link, `tabIndex=0`은 보조.
 */
export function QuickRequestMobileCard({ row, onOpen, ...handlers }: QuickRequestMobileCardProps) {
  const hasAction = resolveQuickRowAction(row) !== null;

  return (
    <li
      data-testid={`quick-card-${row.requestNo}`}
      tabIndex={0}
      className='flex min-w-0 cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
      onClick={(event) => {
        if (isInteractiveClickTarget(event.target)) return;
        onOpen(row);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(row);
        }
      }}
    >
      <div className='flex min-w-0 items-start justify-between gap-2'>
        <QuickRequestStatusBadge status={row.status} />
        <div className='flex min-w-0 items-center gap-2'>
          <QuickUnreadChatBadge
            requestNo={row.requestNo}
            count={row.unreadMessageCount}
            className='min-h-7 px-2'
          />
          {row.isParticipant ? <QuickParticipantBadge requestNo={row.requestNo} /> : null}
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
