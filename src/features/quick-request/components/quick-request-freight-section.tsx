'use client';

import { RadioGroup } from '@/components/ui/radio-group';
import { QuickRequestRadioCard } from './quick-request-field-controls';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { QuickRequestSectionShell } from './quick-request-section-shell';

const FREIGHT_OPTIONS = [
  { value: 'monthly', title: '월정산' },
  { value: 'collect', title: '착불' }
] as const;

type QuickRequestFreightSectionProps = {
  form: QuickRequestOrderForm;
};

export function QuickRequestFreightSection({ form }: QuickRequestFreightSectionProps) {
  return (
    <QuickRequestSectionShell id='quick-request-section-freight' title='운임 결제'>
      <form.AppField name='freightPayment'>
        {(field) => (
          <RadioGroup
            value={field.state.value as string}
            onValueChange={(v) => field.handleChange(v as 'monthly' | 'collect')}
            aria-label='운임 결제 방식'
            className='grid max-w-md grid-cols-2 gap-2'
          >
            {FREIGHT_OPTIONS.map((option) => (
              <QuickRequestRadioCard
                key={option.value}
                id={`quick-request-freight-${option.value}-radio`}
                value={option.value}
                title={option.title}
                data-testid={`quick-request-freight-${option.value}`}
              />
            ))}
          </RadioGroup>
        )}
      </form.AppField>
    </QuickRequestSectionShell>
  );
}
