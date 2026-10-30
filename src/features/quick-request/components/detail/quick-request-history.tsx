'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons, type Icon } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { QuickRequestDetail } from '../../api/types';
import { QuickDetailSection } from './quick-detail-section';

type HistoryEvent = {
  key: string;
  label: string;
  actor: string | null;
  at: string;
  icon: Icon;
  note?: string | null;
};

function buildHistory(detail: QuickRequestDetail): HistoryEvent[] {
  const { history } = detail;
  const events: (HistoryEvent | null)[] = [
    {
      key: 'created',
      label: '등록',
      actor: detail.requester.name,
      at: detail.requestedAt,
      icon: Icons.send
    },
    history.acceptedAt
      ? {
          key: 'accepted',
          label: '접수',
          actor: history.acceptedBy?.name ?? null,
          at: history.acceptedAt,
          icon: Icons.check
        }
      : null,
    history.dispatchedAt
      ? {
          key: 'dispatched',
          label: '배차 완료',
          actor: history.dispatchedBy?.name ?? null,
          at: history.dispatchedAt,
          icon: Icons.circleCheck
        }
      : null,
    history.finalAmountSetAt
      ? {
          key: 'final-amount',
          label: '최종금액 입력',
          actor: history.finalAmountSetBy?.name ?? null,
          at: history.finalAmountSetAt,
          icon: Icons.currencyWon
        }
      : null,
    history.approvedAt
      ? {
          key: 'approved',
          label: '승인',
          actor: history.approvedBy?.name ?? null,
          at: history.approvedAt,
          icon: Icons.check
        }
      : null,
    history.cancelledAt
      ? {
          key: 'cancelled',
          label: '취소',
          actor: history.cancelledBy?.name ?? null,
          at: history.cancelledAt,
          icon: Icons.circleX,
          note: history.cancelReason
        }
      : null
  ];
  // plan 94 U-5 — 최신이 위 (DOM 역순 · CSS 역순 금지: 낭독 순서 = 시각 순서). 「등록」이 맨 아래, 취소 건은 「취소」가 맨 위.
  return events.filter((event): event is HistoryEvent => event !== null).reverse();
}

type HistoryEventListProps = {
  events: HistoryEvent[];
  id?: string;
};

function HistoryEventList({ events, id }: HistoryEventListProps) {
  return (
    <ol id={id} aria-label='처리 이력' className='flex flex-col gap-3'>
      {events.map((event) => {
        const Icon = event.icon;
        return (
          <li
            key={event.key}
            data-testid={`quick-detail-history-${event.key}`}
            className='flex min-w-0 items-start gap-3'
          >
            <span className='flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'>
              <Icon aria-hidden className='size-3.5' />
            </span>
            <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
              <p className='flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm'>
                <span className='font-medium text-foreground'>{event.label}</span>
                {event.actor ? (
                  <span className='max-w-40 truncate text-muted-foreground'>{event.actor}</span>
                ) : null}
              </p>
              <time dateTime={event.at} className='text-xs text-muted-foreground tabular-nums'>
                {formatAbsoluteDateTimeKo(event.at)}
              </time>
              {event.note ? (
                <p className='text-xs break-words whitespace-pre-wrap text-muted-foreground'>
                  사유: {event.note}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type QuickRequestHistoryProps = {
  detail: QuickRequestDetail;
  /** 앞에서부터(최신부터) 몇 건만 보일지 — 휴대폰 접힘 상태 1건 (plan 106 D-15 ⑦) */
  limit?: number;
  id?: string;
};

/** 처리 이력 — 일어난 이벤트만 (절대 시각 · 최신 위 · plan 94 U-5) */
export function QuickRequestHistoryList({ detail, limit, id }: QuickRequestHistoryProps) {
  const events = buildHistory(detail);
  return <HistoryEventList events={limit === undefined ? events : events.slice(0, limit)} id={id} />;
}

type QuickRequestHistorySectionProps = {
  detail: QuickRequestDetail;
};

/**
 * plan 106 D-15 ⑦ · designer §6.6 — 휴대폰 「처리 이력」 접기 섹션 (AC-47).
 * 접힘 = 최신 1줄 + 「전체 보기」(`aria-expanded` · `aria-controls`) → 펼치면 94 순서(최신 위) 전체.
 * 이벤트가 「등록」 1건뿐이면 그리지 않는다(K10 — 스테퍼 1단계가 같은 시각을 보여 줌 · AC-46).
 * PC는 이 섹션을 쓰지 않는다(처음부터 전체 · `QuickRequestHistoryList`).
 */
export function QuickRequestHistorySection({ detail }: QuickRequestHistorySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const events = buildHistory(detail);

  if (events.length <= 1) {
    return null;
  }

  const ToggleIcon = expanded ? Icons.chevronUp : Icons.chevronDown;

  return (
    <QuickDetailSection
      title='처리 이력'
      data-testid='quick-detail-section-history'
      density='compact'
      action={
        <Button
          type='button'
          variant='ghost'
          className='-my-2.5 -mr-2 h-11 shrink-0 touch-manipulation px-3'
          aria-expanded={expanded}
          aria-controls={listId}
          data-testid='quick-detail-history-toggle'
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '접기' : '전체 보기'}
          <ToggleIcon aria-hidden />
        </Button>
      }
    >
      <HistoryEventList events={expanded ? events : events.slice(0, 1)} id={listId} />
    </QuickDetailSection>
  );
}
