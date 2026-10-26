import { Badge } from '@/components/ui/badge';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import type {
  QuickRequestDestinationSchedule,
  QuickRequestDetail,
  QuickRequestLocation,
  QuickRequestOriginSchedule
} from '../../api/types';
import { QuickRequestRouteDot, type QuickRequestRouteKind } from '../quick-request-summary-content';
import { QuickRequestPhoneLink } from './quick-request-phone-link';

function formatSchedule(schedule: QuickRequestOriginSchedule | QuickRequestDestinationSchedule): string {
  if (schedule.mode === 'immediate') return '즉시 요청';
  if (schedule.mode === 'asap') return '최대한 빠르게';
  return formatAbsoluteDateTimeKo(schedule.datetimeIso);
}

type RouteStop = {
  kind: QuickRequestRouteKind;
  label: string;
  location: QuickRequestLocation;
  schedule?: string;
  scheduleLabel?: string;
  notes?: string[];
  memo?: string | null;
  memoLabel?: string;
};

function buildStops(detail: QuickRequestDetail): RouteStop[] {
  return [
    {
      kind: 'origin',
      label: '출발지',
      location: detail.origin,
      scheduleLabel: '픽업',
      schedule: formatSchedule(detail.origin.schedule),
      notes: detail.origin.notes,
      memo: detail.origin.memo,
      memoLabel: '픽업 메모'
    },
    ...detail.stopovers.map((stop, index) => ({
      kind: 'stopover' as const,
      label: `경유지 ${index + 1}`,
      location: stop
    })),
    {
      kind: 'destination',
      label: '도착지',
      location: detail.destination,
      scheduleLabel: '도착',
      schedule: formatSchedule(detail.destination.schedule),
      notes: detail.destination.notes,
      memo: detail.destination.memo,
      memoLabel: '추가 메모'
    }
  ];
}

type QuickRequestRouteViewProps = {
  detail: QuickRequestDetail;
};

/** 출발 · 경유 · 도착 블록 (주소 · 담당 · 연락처 · 일정 · 특이사항 · 메모) */
export function QuickRequestRouteView({ detail }: QuickRequestRouteViewProps) {
  const stops = buildStops(detail);
  return (
    <ol aria-label='이동 경로' className='flex min-w-0 flex-col'>
      {stops.map((stop, index) => {
        const isLast = index === stops.length - 1;
        return (
          <li key={`${stop.kind}-${index}`} className='relative flex min-w-0 gap-3'>
            <div className='flex flex-col items-center pt-1.5'>
              <QuickRequestRouteDot kind={stop.kind} />
              {!isLast ? <span aria-hidden className='mt-1 w-px flex-1 bg-border' /> : null}
            </div>
            <div className={cn('flex min-w-0 flex-1 flex-col gap-1', !isLast && 'pb-5')}>
              <p className='text-xs font-medium text-muted-foreground'>{stop.label}</p>
              <p className='text-sm font-medium break-words text-foreground'>
                {stop.location.roadAddress || '—'}
              </p>
              {stop.location.detailAddress ? (
                <p className='text-sm break-words text-foreground'>{stop.location.detailAddress}</p>
              ) : null}
              <p className='flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground'>
                <span className='max-w-40 truncate'>{stop.location.contactName || '—'}</span>
                <span aria-hidden>·</span>
                <QuickRequestPhoneLink phone={stop.location.contactPhone} />
              </p>
              {stop.schedule ? (
                <p className='text-sm text-muted-foreground'>
                  {stop.scheduleLabel} <span className='text-foreground tabular-nums'>{stop.schedule}</span>
                </p>
              ) : null}
              {stop.notes && stop.notes.length > 0 ? (
                <ul aria-label={`${stop.label} 특이사항`} className='flex flex-wrap gap-1.5 pt-1'>
                  {stop.notes.map((note) => (
                    <li key={note}>
                      <Badge variant='secondary' className='font-normal whitespace-normal break-keep'>
                        {note}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
              {stop.memo ? (
                <p className='text-sm break-words whitespace-pre-wrap text-foreground'>
                  <span className='text-muted-foreground'>{stop.memoLabel}: </span>
                  {stop.memo}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
