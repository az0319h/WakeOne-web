'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import type { QuickRequestListRow } from '../../api/types';
import { formatUnreadBadge } from '../chat/format-unread-badge';
import { QUICK_CHAT_TEXT, quickChatHref, quickChatText } from '../chat/quick-chat-constants';
import { formatQuickAmountWon } from '../../lib/format-quick-amount';
import {
  formatQuickGoodsLabel,
  formatQuickRouteLabel,
  formatQuickVehicleSummary
} from '../../lib/quick-request-route-label';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import {
  QuickRequestRowAction,
  type QuickRequestRowActionHandlers
} from './quick-request-row-action';

export function quickRequestDetailHref(requestNo: string): string {
  return `/dashboard/quick/${encodeURIComponent(requestNo)}`;
}

type QuickUnreadChatBadgeProps = {
  requestNo: string;
  count: number;
  className?: string;
};

/**
 * plan 93 U-9 · AC-16 — 「새 대화 N」 Badge Link → 「퀵 대화」 그 건. 0이면 렌더 안 함.
 * 표·모바일 카드 둘 다 DOM에 있으므로 같은 testid가 2개 (verifier는 `.filter({ visible: true })`).
 */
export function QuickUnreadChatBadge({ requestNo, count, className }: QuickUnreadChatBadgeProps) {
  if (count <= 0) {
    return null;
  }
  return (
    <Badge asChild className={cn('h-5 gap-1 rounded-full px-1.5 text-[11px] tabular-nums', className)}>
      <Link
        href={quickChatHref(requestNo)}
        aria-label={quickChatText.newConversationsLink(requestNo, count)}
        data-testid={`quick-unread-${requestNo}`}
      >
        <Icons.chat aria-hidden />
        {quickChatText.newConversations(formatUnreadBadge(count))}
      </Link>
    </Badge>
  );
}

type QuickParticipantBadgeProps = {
  requestNo: string;
  className?: string;
};

/**
 * plan 101 U-7 — 초대된 참여자로 보는 건 「참여」 outline Badge (표 「요청 정보」 셀 · 모바일 카드 번호 옆).
 * 표·카드 둘 다 DOM에 있으므로 같은 testid가 2개 (verifier는 `.filter({ visible: true })`).
 */
export function QuickParticipantBadge({ requestNo, className }: QuickParticipantBadgeProps) {
  return (
    <Badge
      variant='outline'
      className={cn('h-5 shrink-0 px-1.5 text-[11px] font-normal', className)}
      aria-label={QUICK_CHAT_TEXT.participantBadgeLabel}
      data-testid={`quick-participant-badge-${requestNo}`}
    >
      {QUICK_CHAT_TEXT.participantBadge}
    </Badge>
  );
}

/**
 * 표 9열 (AC-34 헤더 텍스트 그대로) — 행 클릭 → 상세 (plan 94 D-7 · `QuickDashboardDataTable`) · 「상세」 링크는 유지.
 * `size`는 DataTable 셀 width — 1280(사이드바 접힘)에서 가로 스크롤 없이 들어가는 폭.
 */
export function createQuickDashboardColumns(
  handlers: QuickRequestRowActionHandlers
): ColumnDef<QuickRequestListRow>[] {
  return [
    {
      id: 'status',
      size: 116,
      header: '진행 상태',
      enableSorting: false,
      cell: ({ row }) => <QuickRequestStatusBadge status={row.original.status} />
    },
    {
      id: 'request',
      size: 156,
      header: '요청 정보',
      enableSorting: false,
      cell: ({ row }) => (
        <div className='flex flex-col gap-0.5'>
          <div className='flex min-w-0 items-center gap-1.5'>
            <span translate='no' className='font-semibold text-foreground tabular-nums'>
              {row.original.requestNo}
            </span>
            {row.original.isParticipant ? <QuickParticipantBadge requestNo={row.original.requestNo} /> : null}
          </div>
          <QuickUnreadChatBadge
            requestNo={row.original.requestNo}
            count={row.original.unreadMessageCount}
          />
          <time
            dateTime={row.original.requestedAt}
            className='text-xs whitespace-nowrap text-muted-foreground tabular-nums'
          >
            {formatAbsoluteDateTimeKo(row.original.requestedAt)}
          </time>
        </div>
      )
    },
    {
      id: 'requester',
      size: 96,
      header: '요청자',
      enableSorting: false,
      cell: ({ row }) => (
        <span className='block max-w-24 truncate'>{row.original.requester.name}</span>
      )
    },
    {
      id: 'route',
      size: 184,
      header: '이동 경로',
      enableSorting: false,
      cell: ({ row }) => (
        <div className='flex flex-col items-start gap-1'>
          <span className='line-clamp-2 break-keep whitespace-normal'>
            {formatQuickRouteLabel(row.original.route)}
          </span>
          {row.original.route.stopoverCount > 0 ? (
            <Badge variant='secondary' className='font-normal'>
              경유 {row.original.route.stopoverCount}
            </Badge>
          ) : null}
        </div>
      )
    },
    {
      id: 'goods',
      size: 136,
      header: '물품·차량',
      enableSorting: false,
      cell: ({ row }) => (
        <div className='flex flex-col gap-0.5'>
          <span>{formatQuickGoodsLabel(row.original.goodsSize)}</span>
          <span className='text-xs text-muted-foreground'>
            {formatQuickVehicleSummary(row.original)}
          </span>
        </div>
      )
    },
    {
      id: 'estimatedAmount',
      size: 96,
      header: () => <span className='block text-right'>예상금액</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <span className='block text-right tabular-nums'>
          {formatQuickAmountWon(row.original.estimatedAmount)}
        </span>
      )
    },
    {
      id: 'finalAmount',
      size: 96,
      header: () => <span className='block text-right'>최종금액</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <span className='block text-right tabular-nums'>
          {formatQuickAmountWon(row.original.finalAmount)}
        </span>
      )
    },
    {
      id: 'detail',
      size: 84,
      header: '상세 보기',
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant='outline' size='sm' className='h-9' asChild>
          <Link
            href={quickRequestDetailHref(row.original.requestNo)}
            aria-label={`${row.original.requestNo} 상세 보기`}
            data-testid={`quick-row-detail-${row.original.requestNo}`}
          >
            상세
          </Link>
        </Button>
      )
    },
    {
      id: 'actions',
      size: 136,
      header: '업무 처리',
      enableSorting: false,
      cell: ({ row }) => (
        <QuickRequestRowAction
          row={row.original}
          layout='table'
          testId={`quick-row-action-${row.original.requestNo}`}
          {...handlers}
        />
      )
    }
  ];
}
