import { Icons, type Icon } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { QuickRequestDetail } from '../../api/types';

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
  return events.filter((event): event is HistoryEvent => event !== null);
}

type QuickRequestHistoryProps = {
  detail: QuickRequestDetail;
};

/** 처리 이력 — 일어난 이벤트만 (절대 시각) */
export function QuickRequestHistoryList({ detail }: QuickRequestHistoryProps) {
  const events = buildHistory(detail);
  return (
    <ol aria-label='처리 이력' className='flex flex-col gap-3'>
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
