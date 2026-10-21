'use client';

import { useStore } from '@tanstack/react-form';
import { RadioGroup } from '@/components/ui/radio-group';
import {
  QuickRequestNativeInputField,
  QuickRequestRadioCard
} from './quick-request-field-controls';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { QuickRequestSectionShell } from './quick-request-section-shell';

type QuickRequestScheduleSectionProps = {
  form: QuickRequestOrderForm;
};

export function QuickRequestScheduleSection({ form }: QuickRequestScheduleSectionProps) {
  const originScheduleMode = useStore(form.store, (s) => s.values.origin.scheduleMode);
  const destinationScheduleMode = useStore(form.store, (s) => s.values.destination.scheduleMode);

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
