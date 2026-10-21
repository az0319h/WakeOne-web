'use client';

import * as React from 'react';
import Image from 'next/image';
import { useStore } from '@tanstack/react-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FormField,
  FormFieldError,
  FormFieldSet,
  useFieldContext
} from '@/components/ui/form-context';
import { Toggle } from '@/components/ui/toggle';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { QUICK_REQUEST_VEHICLE_COUNT_PRESETS } from '../lib/quick-request-constants';
import { QUICK_REQUEST_VEHICLE_VISUALS } from '../lib/quick-request-vehicle-visuals';
import {
  QUICK_REQUEST_VEHICLE_TYPES,
  type QuickRequestVehicleType
} from '../schemas/quick-request-notify';
import { toggleVehicleType } from '../schemas/quick-request-form';
import { QuickRequestNativeInputField } from './quick-request-field-controls';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { QuickRequestSectionShell } from './quick-request-section-shell';

function vehicleCardTestId(type: string) {
  return `quick-request-vehicle-${type.replace(/\s+/g, '-').replace(/[()]/g, '')}`;
}

type QuickRequestVehicleCardProps = {
  type: QuickRequestVehicleType;
  selected: boolean;
  onToggle: (type: QuickRequestVehicleType) => void;
};

function QuickRequestVehicleCard({ type, selected, onToggle }: QuickRequestVehicleCardProps) {
  const visual = QUICK_REQUEST_VEHICLE_VISUALS[type];
  const hasImage = visual.src !== null;

  return (
    <Toggle
      variant='outline'
      pressed={selected}
      onPressedChange={() => onToggle(type)}
      data-testid={vehicleCardTestId(type)}
      className={cn(
        'group relative h-auto min-h-11 min-w-0 flex-col items-stretch justify-start gap-2 rounded-lg bg-card p-2 text-left whitespace-normal text-foreground shadow-none',
        'hover:bg-muted/50 hover:text-foreground',
        'data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground data-[state=on]:ring-1 data-[state=on]:ring-primary',
        !selected && 'group-data-[invalid=true]/field:border-destructive/60'
      )}
    >
      <span className='relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-muted'>
        {visual.src ? (
          <Image
            src={visual.src}
            alt={type}
            width={448}
            height={448}
            sizes='(min-width: 1024px) 160px, 34vw'
            className='size-full object-cover object-bottom'
          />
        ) : (
          <Icons.dots className='size-6 text-muted-foreground' aria-hidden />
        )}
        {visual.badge ? (
          <Badge
            variant='outline'
            aria-hidden
            className='absolute top-1.5 left-1.5 bg-background text-foreground'
          >
            {visual.badge}
          </Badge>
        ) : null}
      </span>
      <span
        aria-hidden={hasImage ? true : undefined}
        className='px-0.5 text-sm leading-tight font-medium break-keep wrap-break-word'
      >
        {visual.title}
        {visual.caption ? (
          <span className='block text-xs font-normal text-muted-foreground'>
            ({visual.caption})
          </span>
        ) : null}
      </span>
      <span
        aria-hidden
        className='absolute top-1.5 right-1.5 hidden size-5 items-center justify-center rounded-full bg-primary text-primary-foreground group-data-[state=on]:flex'
      >
        <Icons.check className='size-3.5' />
      </span>
    </Toggle>
  );
}

function QuickRequestVehicleTypeGrid() {
  const field = useFieldContext();
  const value = useStore(field.store, (s) => s.value) as QuickRequestVehicleType[];
  // useFieldContext의 formItemId는 FormFieldSet 밖에서 undefined — 고유 id 직접 생성
  const labelId = `${React.useId()}-label`;

  function handleToggle(type: QuickRequestVehicleType) {
    field.handleChange(toggleVehicleType(value, type));
    field.handleBlur();
  }

  return (
    <FormFieldSet className='min-w-0'>
      <FormField aria-labelledby={labelId}>
        <p id={labelId} className='text-sm font-medium'>
          차량 종류{' '}
          <span aria-hidden className='text-destructive'>
            *
          </span>
        </p>
        <div className='@container min-w-0'>
          <div className='grid grid-cols-3 gap-2 @lg:grid-cols-4 @3xl:grid-cols-5'>
            {QUICK_REQUEST_VEHICLE_TYPES.map((type) => (
              <QuickRequestVehicleCard
                key={type}
                type={type}
                selected={value.includes(type)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

type QuickRequestVehicleSectionProps = {
  form: QuickRequestOrderForm;
};

export function QuickRequestVehicleSection({ form }: QuickRequestVehicleSectionProps) {
  const countLabelId = React.useId();
  const showOther = useStore(form.store, (s) => s.values.vehicleTypes.includes('기타'));
  const vehicleCountMode = useStore(form.store, (s) => s.values.vehicleCountMode);
  const vehicleCountPreset = useStore(form.store, (s) => s.values.vehicleCountPreset);

  return (
    <QuickRequestSectionShell
      id='quick-request-section-vehicles'
      title='배송 수단'
      description='복수 선택 가능'
    >
      <div className='space-y-5'>
        <form.AppField name='vehicleTypes'>{() => <QuickRequestVehicleTypeGrid />}</form.AppField>

        {/* 항상 마운트 + hidden (물품 크기 「기타」와 같은 이유) */}
        <div hidden={!showOther}>
          <form.AppField name='vehicleOtherText'>
            {(field) => (
              <field.TextField
                label='기타 차량'
                required
                placeholder='예: 윙바디 11톤…'
                autoComplete='off'
                className='h-11 bg-muted/50'
                data-testid='quick-request-vehicle-other'
              />
            )}
          </form.AppField>
        </div>

        <div className='space-y-3'>
          <p id={countLabelId} className='text-sm font-medium text-foreground'>
            차량 대수{' '}
            <span aria-hidden className='text-destructive'>
              *
            </span>
          </p>
          <div
            role='group'
            aria-labelledby={countLabelId}
            className='grid max-w-md grid-cols-6 gap-2'
          >
            {QUICK_REQUEST_VEHICLE_COUNT_PRESETS.map((count) => {
              const selected = vehicleCountMode === 'preset' && vehicleCountPreset === count;
              return (
                <Button
                  key={count}
                  type='button'
                  variant={selected ? 'default' : 'outline'}
                  aria-pressed={selected}
                  className='h-11 min-w-0 px-0'
                  data-testid={`quick-request-vehicle-count-${count}`}
                  onClick={() => {
                    form.setFieldValue('vehicleCountMode', 'preset');
                    form.setFieldValue('vehicleCountPreset', count);
                  }}
                >
                  {count}대
                </Button>
              );
            })}
            <Button
              type='button'
              variant={vehicleCountMode === 'custom' ? 'default' : 'outline'}
              aria-pressed={vehicleCountMode === 'custom'}
              className='h-11 min-w-0 px-0'
              data-testid='quick-request-vehicle-count-custom-toggle'
              onClick={() => form.setFieldValue('vehicleCountMode', 'custom')}
            >
              직접
            </Button>
          </div>

          {vehicleCountMode === 'custom' ? (
            <form.AppField name='vehicleCountCustom'>
              {() => (
                <QuickRequestNativeInputField
                  type='number'
                  label='직접 입력 대수'
                  required
                  min={1}
                  inputMode='numeric'
                  suffix='대'
                  className='w-32'
                  data-testid='quick-request-vehicle-count-custom-input'
                />
              )}
            </form.AppField>
          ) : null}
        </div>
      </div>
    </QuickRequestSectionShell>
  );
}
