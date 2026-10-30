'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import type { QuickRequestListRow } from '../../api/types';
import { formatQuickAmountWon } from '../../lib/format-quick-amount';
import {
  formatQuickGoodsLabel,
  formatQuickVehicleSummary
} from '../../lib/quick-request-route-label';
import { formatUnreadBadge } from '../chat/format-unread-badge';
import { quickChatHref, quickChatText } from '../chat/quick-chat-constants';
import { QuickRequestRouteDot } from '../quick-request-summary-content';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { QuickParticipantBadge, quickRequestDetailHref } from './quick-dashboard-columns';
import {
  QuickRequestRowAction,
  resolveQuickRowAction,
  type QuickRequestRowActionHandlers
} from './quick-request-row-action';

/** 경로 줄 안 점 — 글자와 같은 줄에서 말줄임되도록 inline */
const INLINE_DOT_CLASS_NAME = 'inline-block align-middle';

type QuickCardUnreadChatLinkProps = {
  requestNo: string;
  count: number;
};

/**
 * 「새 대화 N」 44px 버튼 → 「퀵 대화」 그 건 (plan 106 D-8 · 93 AC-16 · testid `quick-unread-{no}` 유지).
 * 카드 덮는 링크보다 위(`relative z-10`)라 누르면 대화로 간다.
 */
function QuickCardUnreadChatLink({ requestNo, count }: QuickCardUnreadChatLinkProps) {
  return (
    <Button
      variant='outline'
      asChild
      className='relative z-10 ml-auto h-11 min-w-11 shrink-0 touch-manipulation gap-1 rounded-full px-3 tabular-nums'
    >
      <Link
        href={quickChatHref(requestNo)}
        aria-label={quickChatText.newConversationsLink(requestNo, count)}
        data-testid={`quick-unread-${requestNo}`}
      >
        <Icons.chat aria-hidden />
        {quickChatText.newConversations(formatUnreadBadge(count))}
      </Link>
    </Button>
  );
}

type QuickCardAmountLineProps = {
  row: QuickRequestListRow;
};

/** 예상·최종 중 값이 있는 것만 (둘 다 없으면 줄 자체를 그리지 않는다 · D-8) */
function QuickCardAmountLine({ row }: QuickCardAmountLineProps) {
  const parts: Array<{ key: string; label: string; amount: number }> = [];
  if (row.estimatedAmount != null) parts.push({ key: 'estimated', label: '예상', amount: row.estimatedAmount });
  if (row.finalAmount != null) parts.push({ key: 'final', label: '최종', amount: row.finalAmount });
  if (parts.length === 0) return null;

  return (
    <p
      data-testid={`quick-card-amount-${row.requestNo}`}
      className='flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm tabular-nums'
    >
      {parts.map((part, index) => (
        <Fragment key={part.key}>
          {index > 0 ? (
            <span aria-hidden className='text-muted-foreground'>
              ·
            </span>
          ) : null}
          <span className='flex items-baseline gap-1'>
            <span className='text-muted-foreground'>{part.label}</span>
            <span>{formatQuickAmountWon(part.amount)}</span>
          </span>
        </Fragment>
      ))}
    </p>
  );
}

type QuickRequestMobileCardProps = QuickRequestRowActionHandlers & {
  row: QuickRequestListRow;
};

/**
 * lg 미만 퀵 내역 카드 (plan 106 D-8 · U-5 · designer §3.9 K4) — testid `quick-card-*`.
 * - 카드 전체를 덮는 빈 링크(`quick-card-link-{no}` · 「{no} 상세 보기」)가 상세 이동·키보드 포커스를 맡는다
 *   (`::after` stretched link는 링크 박스가 글자 크기라 44px 스캔에서 떨어짐). 「상세 보기」 버튼은 없앴다.
 * - 1줄 번호·참여 / 상태 · 2줄 출발 → 도착(경유 N) · 3줄 요청 시각(전체 시각)·요청자·물품·차량(최대 2줄)
 *   · 금액(값 있을 때만) · 업무 버튼 + 「새 대화 N」(있을 때만). 버튼은 `relative z-10`으로 링크 위.
 */
export function QuickRequestMobileCard({ row, ...handlers }: QuickRequestMobileCardProps) {
  const action = resolveQuickRowAction(row);
  const hasUnread = row.unreadMessageCount > 0;

  return (
    <li
      data-testid={`quick-card-${row.requestNo}`}
      className='relative flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-3 text-card-foreground ring-ring/50 transition-colors hover:bg-accent/40 has-[a[data-card-link]:focus-visible]:ring-[3px]'
    >
      <Link
        href={quickRequestDetailHref(row.requestNo)}
        aria-label={`${row.requestNo} 상세 보기`}
        data-card-link=''
        data-testid={`quick-card-link-${row.requestNo}`}
        className='absolute inset-0 touch-manipulation rounded-xl outline-none'
      />
      <div className='flex min-w-0 items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-1.5'>
          <span translate='no' className='truncate text-base font-semibold tabular-nums'>
            {row.requestNo}
          </span>
          {row.isParticipant ? <QuickParticipantBadge requestNo={row.requestNo} /> : null}
        </div>
        <QuickRequestStatusBadge status={row.status} />
      </div>
      <p className='min-w-0 truncate text-sm'>
        <QuickRequestRouteDot kind='origin' className={INLINE_DOT_CLASS_NAME} /> {row.route.from}{' '}
        <span aria-hidden>→</span>{' '}
        <QuickRequestRouteDot kind='destination' className={INLINE_DOT_CLASS_NAME} /> {row.route.to}
        {row.route.stopoverCount > 0 ? (
          <span className='text-muted-foreground'> · 경유 {row.route.stopoverCount}</span>
        ) : null}
      </p>
      <p className='line-clamp-2 min-w-0 text-xs break-keep text-muted-foreground'>
        <time dateTime={row.requestedAt} className='tabular-nums'>
          {formatAbsoluteDateTimeKo(row.requestedAt)}
        </time>
        {' · '}
        {row.requester.name}
        {' · '}
        {formatQuickGoodsLabel(row.goodsSize)}
        {' · '}
        {formatQuickVehicleSummary(row)}
      </p>
      <QuickCardAmountLine row={row} />
      {action !== null || hasUnread ? (
        <div className='mt-0.5 flex min-w-0 items-center gap-2'>
          {action !== null ? (
            // 「최종금액 대기」 글자는 링크를 가리지 않는다(누르면 상세) · 버튼만 링크 위
            <div className={cn('min-w-0 flex-1', action !== 'awaitingFinal' && 'relative z-10')}>
              <QuickRequestRowAction
                row={row}
                layout='card'
                testId={`quick-card-action-${row.requestNo}`}
                {...handlers}
              />
            </div>
          ) : null}
          {hasUnread ? (
            <QuickCardUnreadChatLink requestNo={row.requestNo} count={row.unreadMessageCount} />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
