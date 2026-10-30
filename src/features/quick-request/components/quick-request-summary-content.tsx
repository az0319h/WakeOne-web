'use client';

import type { ReactNode } from 'react';
import { Separator } from '@/components/ui/separator';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { localDatetimeInputToIso } from '../lib/datetime-local';
import {
  formatQuickRequestGoodsSizeLabel,
  resolveQuickRequestItemDescription
} from '../lib/quick-request-goods-visuals';
import { resolveVehicleCount, type QuickRequestFormValues } from '../schemas/quick-request-form';

export type QuickRequestRouteKind = 'origin' | 'stopover' | 'destination';

type QuickRequestRouteDotProps = {
  kind: QuickRequestRouteKind;
  className?: string;
};

/** 경로 타임라인 점 — 출발 hollow · 경유 muted · 도착 solid */
export function QuickRequestRouteDot({ kind, className }: QuickRequestRouteDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'block size-2.5 shrink-0 rounded-full',
        kind === 'origin' && 'border-2 border-foreground bg-card',
        kind === 'stopover' && 'bg-muted-foreground',
        kind === 'destination' && 'bg-foreground',
        className
      )}
    />
  );
}

export function formatVehicleTypes(values: QuickRequestFormValues): string {
  if (values.vehicleTypes.length === 0) {
    return '선택 전';
  }
  const other = values.vehicleOtherText.trim();
  return values.vehicleTypes
    .map((type) => (type === '기타' && other ? `기타(${other})` : type))
    .join(', ');
}

export function formatVehicleCount(values: QuickRequestFormValues): string {
  const count = resolveVehicleCount(values);
  return count > 0 ? `${count}대` : '—';
}

export function formatOriginSchedule(origin: QuickRequestFormValues['origin']): string {
  if (origin.scheduleMode === 'immediate') {
    return '즉시 요청';
  }
  const iso = localDatetimeInputToIso(origin.scheduledDatetime);
  return iso ? formatAbsoluteDateTimeKo(iso) : '—';
}

export function formatDestinationSchedule(
  destination: QuickRequestFormValues['destination']
): string {
  if (destination.scheduleMode === 'asap') {
    return '최대한 빠르게';
  }
  const iso = localDatetimeInputToIso(destination.scheduledDatetime);
  return iso ? formatAbsoluteDateTimeKo(iso) : '—';
}

export type QuickRequestSummaryParts = {
  /** `{출발} → {도착}` — 하단 바에서 말줄임되는 부분 */
  route: string;
  /** `{차량} · {대수}` — 하단 바에서 통째로 보이는 부분(「차량 미선택」 줄바꿈 없음 · AC-29) */
  rest: string;
};

/** plan 106 D-10 ⑦ — 하단 바 1줄 요약을 경로/나머지로 나눔 */
export function formatQuickRequestSummaryParts(values: QuickRequestFormValues): QuickRequestSummaryParts {
  const origin = values.origin.roadAddress.trim() || '출발지';
  const destination = values.destination.roadAddress.trim() || '도착지';
  const [firstVehicle] = values.vehicleTypes;
  const vehicle = firstVehicle
    ? `${firstVehicle}${values.vehicleTypes.length > 1 ? ` 외 ${values.vehicleTypes.length - 1}` : ''}`
    : '차량 미선택';
  return {
    route: `${origin} → ${destination}`,
    rest: `${vehicle} · ${formatVehicleCount(values)}`
  };
}

/** 모바일 하단 바 1줄 요약 (parts를 합친 문자열) */
export function formatQuickRequestSummaryLine(values: QuickRequestFormValues): string {
  const { route, rest } = formatQuickRequestSummaryParts(values);
  return `${route} · ${rest}`;
}

type RouteStop = {
  kind: QuickRequestRouteKind;
  label: string;
  roadAddress: string;
  detailAddress: string;
};

function buildRouteStops(values: QuickRequestFormValues): RouteStop[] {
  return [
    {
      kind: 'origin',
      label: '출발지',
      roadAddress: values.origin.roadAddress,
      detailAddress: values.origin.detailAddress
    },
    ...values.stopovers.map((stop, index) => ({
      kind: 'stopover' as const,
      label: `경유지 ${index + 1}`,
      roadAddress: stop.roadAddress,
      detailAddress: stop.detailAddress
    })),
    {
      kind: 'destination',
      label: '도착지',
      roadAddress: values.destination.roadAddress,
      detailAddress: values.destination.detailAddress
    }
  ];
}

type SummaryRowProps = {
  label: string;
  children: ReactNode;
};

function SummaryRow({ label, children }: SummaryRowProps) {
  return (
    <>
      <dt className='break-keep text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 text-foreground wrap-break-word'>{children}</dd>
    </>
  );
}

type QuickRequestSummaryContentProps = {
  values: QuickRequestFormValues;
};

/** 요청 요약 본문 — 데스크톱 aside · 모바일 Drawer 공유 (순수 표시) */
export function QuickRequestSummaryContent({ values }: QuickRequestSummaryContentProps) {
  const stops = buildRouteStops(values);
  const isOtherGoods = values.goodsSize === 'other';
  const item = resolveQuickRequestItemDescription(values.goodsSize, values.itemDescription);
  const goodsSizeLabel = formatQuickRequestGoodsSizeLabel(values.goodsSize);
  const freightLabel = values.freightPayment === 'collect' ? '착불' : '월정산';

  return (
    <div className='space-y-4'>
      <ol aria-label='배송 경로' className='space-y-0'>
        {stops.map((stop, index) => {
          const isLast = index === stops.length - 1;
          const road = stop.roadAddress.trim();
          const detail = stop.detailAddress.trim();
          return (
            <li
              key={`${stop.kind}-${index}`}
              className={cn('relative flex gap-3', !isLast && 'pb-4')}
            >
              <QuickRequestRouteDot kind={stop.kind} className='mt-1' />
              {!isLast ? (
                <span aria-hidden className='absolute top-4 bottom-0 left-[4px] w-px bg-border' />
              ) : null}
              <div className='min-w-0 flex-1'>
                <p className='text-xs text-muted-foreground'>{stop.label}</p>
                <p
                  className={cn(
                    'text-sm font-medium wrap-break-word',
                    road ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {road || '주소 미입력'}
                </p>
                {detail ? (
                  <p className='line-clamp-2 text-xs text-muted-foreground wrap-break-word'>
                    {detail}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <Separator />

      <dl className='grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm'>
        <SummaryRow label='배송 수단'>{formatVehicleTypes(values)}</SummaryRow>
        <SummaryRow label='차량 대수'>{formatVehicleCount(values)}</SummaryRow>
        <SummaryRow label='물품 크기'>{goodsSizeLabel ?? '—'}</SummaryRow>
        {isOtherGoods ? (
          <SummaryRow label='물품'>
            {item ? <span className='line-clamp-3'>{item}</span> : '—'}
          </SummaryRow>
        ) : null}
        <SummaryRow label='픽업'>{formatOriginSchedule(values.origin)}</SummaryRow>
        <SummaryRow label='도착'>{formatDestinationSchedule(values.destination)}</SummaryRow>
        {values.origin.notes.length > 0 ? (
          <SummaryRow label='출발 특이사항'>{values.origin.notes.join(', ')}</SummaryRow>
        ) : null}
        {values.destination.notes.length > 0 ? (
          <SummaryRow label='도착 특이사항'>{values.destination.notes.join(', ')}</SummaryRow>
        ) : null}
        <SummaryRow label='결제'>{freightLabel}</SummaryRow>
      </dl>
    </div>
  );
}
