import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { formatPhoneDisplay } from '@/lib/phone';
import { cn } from '@/lib/utils';
import {
  formatQuickRequestGoodsSizeLabel,
  resolveQuickRequestItemDescription
} from '../lib/quick-request-goods-visuals';
import { formatQuickFreightLabel } from '../lib/quick-request-route-label';
import type { QuickRequestFormValues } from '../schemas/quick-request-form';
import {
  formatDestinationSchedule,
  formatOriginSchedule,
  formatVehicleCount,
  formatVehicleTypes,
  QuickRequestRouteDot
} from './quick-request-summary-content';

const LOCATION_CARD_CLASS = 'gap-0 border bg-muted/30 py-0 shadow-none';
const LOCATION_HEADER_CLASS = 'flex-row items-center gap-2 px-4 pt-3 pb-2';

type PreviewRowProps = {
  label: string;
  children: ReactNode;
};

function PreviewRow({ label, children }: PreviewRowProps) {
  return (
    <>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 wrap-break-word'>{children}</dd>
    </>
  );
}

type PreviewLocationCardProps = {
  kind: 'origin' | 'destination';
  title: string;
  roadAddress: string;
  detailAddress: string;
  contactName: string;
  contactPhone: string;
  schedule: { label: '픽업' | '도착'; value: string };
  notes: string[];
  memo: string;
  'data-testid': string;
};

function PreviewLocationCard({
  kind,
  title,
  roadAddress,
  detailAddress,
  contactName,
  contactPhone,
  schedule,
  notes,
  memo,
  'data-testid': testId
}: PreviewLocationCardProps) {
  const road = roadAddress.trim();
  const detail = detailAddress.trim();
  const name = contactName.trim();
  const memoText = memo.trim();

  return (
    <Card data-testid={testId} className={LOCATION_CARD_CLASS}>
      <CardHeader className={LOCATION_HEADER_CLASS}>
        <QuickRequestRouteDot kind={kind} />
        <CardTitle className='text-sm'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='px-4 pb-3'>
        <p
          className={cn(
            'text-sm font-medium break-keep wrap-break-word',
            road ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {road || '주소 미입력'}
        </p>
        {detail ? (
          <p className='text-xs text-muted-foreground break-keep wrap-break-word'>{detail}</p>
        ) : null}
        <dl className='mt-2 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm'>
          {name ? <PreviewRow label='담당자'>{name}</PreviewRow> : null}
          {contactPhone ? (
            <PreviewRow label='연락처'>
              <span className='tabular-nums'>
                {formatPhoneDisplay(contactPhone) ?? contactPhone}
              </span>
            </PreviewRow>
          ) : null}
          <PreviewRow label={schedule.label}>{schedule.value}</PreviewRow>
          {notes.length > 0 ? (
            <PreviewRow label='특이사항'>
              <span className='flex flex-wrap gap-1'>
                {notes.map((note) => (
                  <Badge key={note} variant='outline' className='text-xs'>
                    {note}
                  </Badge>
                ))}
              </span>
            </PreviewRow>
          ) : null}
          {memoText ? (
            <PreviewRow label='메모'>
              <span className='whitespace-pre-line'>{memoText}</span>
            </PreviewRow>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

type PreviewStopoversProps = {
  stopovers: QuickRequestFormValues['stopovers'];
};

function PreviewStopovers({ stopovers }: PreviewStopoversProps) {
  return (
    <section
      aria-label='경유지'
      data-testid='quick-request-preview-stopovers'
      className='lg:order-last lg:col-span-2'
    >
      <Card className={LOCATION_CARD_CLASS}>
        <CardHeader className={LOCATION_HEADER_CLASS}>
          <QuickRequestRouteDot kind='stopover' />
          <CardTitle className='text-sm'>경유지</CardTitle>
        </CardHeader>
        <CardContent className='px-0 pb-0'>
          <ol className='divide-y'>
            {stopovers.map((stop, index) => {
              const name = stop.contactName.trim();
              const phone = stop.contactPhone
                ? (formatPhoneDisplay(stop.contactPhone) ?? stop.contactPhone)
                : '';
              return (
                <li key={`stopover-${index}`} className='flex gap-3 px-4 py-2'>
                  <Badge variant='outline' className='h-6 shrink-0 tabular-nums'>
                    경유 {index + 1}
                  </Badge>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium break-keep wrap-break-word'>
                      {stop.roadAddress.trim() || '주소 미입력'}
                    </p>
                    {stop.detailAddress.trim() ? (
                      <p className='text-xs text-muted-foreground wrap-break-word'>
                        {stop.detailAddress.trim()}
                      </p>
                    ) : null}
                    {name || phone ? (
                      <p className='text-xs text-muted-foreground'>
                        {name}
                        {name && phone ? ' · ' : ''}
                        {phone ? <span className='tabular-nums'>{phone}</span> : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}

type QuickRequestPreviewCardProps = {
  values: QuickRequestFormValues;
  requesterName: string;
  requestedAt: Date;
};

/** plan 96 D-1 — 등록 전 미리보기 구조화 카드 (순수 표시 · 요약 보드 라벨 함수 재사용) */
export function QuickRequestPreviewCard({
  values,
  requesterName,
  requestedAt
}: QuickRequestPreviewCardProps) {
  const item = resolveQuickRequestItemDescription(values.goodsSize, values.itemDescription);
  const chips = [
    formatQuickRequestGoodsSizeLabel(values.goodsSize) ?? '—',
    `${formatVehicleTypes(values)} × ${formatVehicleCount(values)}`,
    formatQuickFreightLabel(values.freightPayment),
    formatOriginSchedule(values.origin)
  ];

  return (
    <div data-testid='quick-request-preview-card' className='space-y-4'>
      <ul
        data-testid='quick-request-preview-chips'
        aria-label='요청 요약'
        className='flex flex-wrap gap-2'
      >
        {chips.map((chip, index) => (
          <li key={`chip-${index}`}>
            <Badge variant='secondary' className='h-7 px-2.5 text-xs'>
              {chip}
            </Badge>
          </li>
        ))}
      </ul>

      {values.goodsSize === 'other' && item ? (
        <div
          data-testid='quick-request-preview-item-description'
          className='rounded-md border bg-muted/30 px-3 py-2'
        >
          <p className='text-xs text-muted-foreground'>물품 내용</p>
          <p className='line-clamp-3 text-sm break-keep wrap-break-word'>{item}</p>
        </div>
      ) : null}

      <div className='grid gap-3 lg:grid-cols-2'>
        <PreviewLocationCard
          kind='origin'
          title='출발지'
          data-testid='quick-request-preview-origin'
          roadAddress={values.origin.roadAddress}
          detailAddress={values.origin.detailAddress}
          contactName={values.origin.contactName}
          contactPhone={values.origin.contactPhone}
          schedule={{
            label: '픽업',
            value: formatOriginSchedule(values.origin)
          }}
          notes={values.origin.notes}
          memo={values.origin.memo}
        />
        {values.stopovers.length > 0 ? <PreviewStopovers stopovers={values.stopovers} /> : null}
        <PreviewLocationCard
          kind='destination'
          title='도착지'
          data-testid='quick-request-preview-destination'
          roadAddress={values.destination.roadAddress}
          detailAddress={values.destination.detailAddress}
          contactName={values.destination.contactName}
          contactPhone={values.destination.contactPhone}
          schedule={{
            label: '도착',
            value: formatDestinationSchedule(values.destination)
          }}
          notes={values.destination.notes}
          memo={values.destination.extraMemo}
        />
      </div>

      <p data-testid='quick-request-preview-requester' className='text-xs text-muted-foreground'>
        요청자 {requesterName} · {formatAbsoluteDateTimeKo(requestedAt)} · 요청번호는 등록 후
        발급됩니다.
      </p>
    </div>
  );
}
