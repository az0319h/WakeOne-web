'use client';

import * as React from 'react';
import { useStore } from '@tanstack/react-form';
import { RadioGroup } from '@/components/ui/radio-group';
import { isoToLocalDatetimeInput } from '../lib/datetime-local';
import {
  QuickRequestNativeInputField,
  QuickRequestRadioCard
} from './quick-request-field-controls';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { useQuickRequestFormLayout } from './quick-request-form-layout';
import { QuickRequestSectionShell } from './quick-request-section-shell';

/** 지금(로컬 · 분 단위) `yyyy-MM-ddTHH:mm` — `datetime-local` `min` 값 */
function nowLocalDatetimeInput(): string {
  return isoToLocalDatetimeInput(new Date().toISOString());
}

/**
 * plan 106 D-11 · AC-26 — 요청 폼(등록)에서만 날짜 칸 `min`(브라우저 선택기가 지난 시각을 흐리게).
 * 픽업 `min` = 지금 · 도착 `min` = 픽업이 예약이고 지금보다 뒤면 픽업 값, 아니면 지금.
 * 오래 열어 둔 화면 대비로 칸에 들어올 때(`onFocus`) 「지금」을 다시 잰다.
 * 날짜 칸은 「날짜/시간 선택」을 고른 뒤에만 그려지므로(SSR 없음) hydration 불일치가 없다.
 * 실제 차단·문구는 등록 전용 스키마(`quickRequestCreateFormSchema`) 몫 — `min`은 보조.
 */
function useScheduleMin(form: QuickRequestOrderForm, enabled: boolean) {
  const [nowMin, setNowMin] = React.useState(nowLocalDatetimeInput);
  const originPickup = useStore(form.store, (s) =>
    s.values.origin.scheduleMode === 'scheduled' ? s.values.origin.scheduledDatetime : ''
  );
  const refreshNow = React.useCallback(() => setNowMin(nowLocalDatetimeInput()), []);
  if (!enabled) {
    return { originMin: undefined, destinationMin: undefined, refreshNow: undefined };
  }
  // 같은 형식(yyyy-MM-ddTHH:mm) 문자열은 사전순 = 시간순
  const destinationMin = originPickup && originPickup > nowMin ? originPickup : nowMin;
  return { originMin: nowMin, destinationMin, refreshNow };
}

type QuickRequestScheduleSectionProps = {
  form: QuickRequestOrderForm;
};

export function QuickRequestScheduleSection({ form }: QuickRequestScheduleSectionProps) {
  const originScheduleMode = useStore(form.store, (s) => s.values.origin.scheduleMode);
  const destinationScheduleMode = useStore(form.store, (s) => s.values.destination.scheduleMode);
  const { originMin, destinationMin, refreshNow } = useScheduleMin(
    form,
    useQuickRequestFormLayout() === 'page'
  );

  return (
    <QuickRequestSectionShell id='quick-request-section-schedule' title='배송 일정'>
      <div className='@container min-w-0'>
        <div className='grid gap-4 @2xl:grid-cols-2'>
          <fieldset className='min-w-0 space-y-3'>
            <legend
              id='quick-request-origin-schedule-legend'
              className='mb-3 text-sm font-medium text-foreground'
            >
              픽업 일시{' '}
              <span aria-hidden className='text-destructive'>
                *
              </span>
            </legend>
            <form.AppField name='origin.scheduleMode'>
              {(field) => (
                <RadioGroup
                  value={field.state.value as string}
                  onValueChange={(v) => field.handleChange(v as 'immediate' | 'scheduled')}
                  aria-labelledby='quick-request-origin-schedule-legend'
                  className='grid grid-cols-2 gap-2'
                >
                  <QuickRequestRadioCard
                    id='quick-request-origin-schedule-immediate'
                    value='immediate'
                    title='즉시 요청'
                  />
                  <QuickRequestRadioCard
                    id='quick-request-origin-schedule-scheduled'
                    value='scheduled'
                    title='날짜/시간 선택'
                  />
                </RadioGroup>
              )}
            </form.AppField>
            {originScheduleMode === 'scheduled' ? (
              <form.AppField name='origin.scheduledDatetime'>
                {() => (
                  <QuickRequestNativeInputField
                    type='datetime-local'
                    label='픽업 일시'
                    required
                    min={originMin}
                    onFocus={refreshNow}
                    data-testid='quick-request-origin-scheduled-datetime'
                  />
                )}
              </form.AppField>
            ) : null}
          </fieldset>

          <fieldset className='min-w-0 space-y-3'>
            <legend
              id='quick-request-destination-schedule-legend'
              className='mb-3 text-sm font-medium text-foreground'
            >
              도착 희망{' '}
              <span aria-hidden className='text-destructive'>
                *
              </span>
            </legend>
            <form.AppField name='destination.scheduleMode'>
              {(field) => (
                <RadioGroup
                  value={field.state.value as string}
                  onValueChange={(v) => field.handleChange(v as 'asap' | 'scheduled')}
                  aria-labelledby='quick-request-destination-schedule-legend'
                  className='grid grid-cols-2 gap-2'
                >
                  <QuickRequestRadioCard
                    id='quick-request-destination-schedule-asap'
                    value='asap'
                    title='최대한 빠르게'
                  />
                  <QuickRequestRadioCard
                    id='quick-request-destination-schedule-scheduled'
                    value='scheduled'
                    title='날짜/시간 선택'
                  />
                </RadioGroup>
              )}
            </form.AppField>
            {destinationScheduleMode === 'scheduled' ? (
              <form.AppField name='destination.scheduledDatetime'>
                {() => (
                  <QuickRequestNativeInputField
                    type='datetime-local'
                    label='도착 희망 일시'
                    required
                    min={destinationMin}
                    onFocus={refreshNow}
                    data-testid='quick-request-destination-scheduled-datetime'
                  />
                )}
              </form.AppField>
            ) : null}
          </fieldset>
        </div>
      </div>
    </QuickRequestSectionShell>
  );
}
