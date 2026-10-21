'use client';

import * as React from 'react';
import Image from 'next/image';
import { useStore } from '@tanstack/react-form';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import {
  FormField,
  FormFieldError,
  FormFieldSet,
  useFieldContext
} from '@/components/ui/form-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Icons } from '@/components/icons';
import { QUICK_REQUEST_GOODS_VISUALS } from '../lib/quick-request-goods-visuals';
import { QUICK_REQUEST_GOODS_SIZES, type QuickRequestGoodsSize } from '../schemas/quick-request-notify';
import { isQuickRequestGoodsSize } from '../schemas/quick-request-form';

type QuickRequestGoodsSizeCardProps = {
  size: QuickRequestGoodsSize;
};

function QuickRequestGoodsSizeCard({ size }: QuickRequestGoodsSizeCardProps) {
  const visual = QUICK_REQUEST_GOODS_VISUALS[size];
  const id = `quick-request-goods-size-${size}-radio`;
  const titleId = `${id}-title`;
  const descId = visual.caption ? `${id}-desc` : undefined;

  return (
    <FieldLabel
      htmlFor={id}
      data-testid={`quick-request-goods-size-${size}`}
      className='min-w-0 cursor-pointer bg-card transition-colors group-data-[invalid=true]/field:border-destructive/60 hover:bg-muted/50 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 [&>*]:data-[slot=field]:p-3'
    >
      <Field orientation='horizontal' className='relative min-h-32 items-start'>
        <FieldContent className='min-w-0'>
          <FieldTitle id={titleId} className='text-foreground'>
            {visual.title}
          </FieldTitle>
          {visual.caption ? (
            <FieldDescription id={descId} className='break-keep'>
              {visual.caption}
            </FieldDescription>
          ) : null}
        </FieldContent>
        <RadioGroupItem id={id} value={size} aria-labelledby={titleId} aria-describedby={descId} />
        <span className='absolute right-2 bottom-2 flex size-16 items-center justify-center rounded-md bg-muted'>
          {visual.src ? (
            <Image
              src={visual.src}
              alt={visual.title}
              width={visual.width}
              height={visual.height}
              unoptimized
              className='size-12 object-contain'
            />
          ) : (
            <Icons.dots className='size-6 text-muted-foreground' aria-hidden />
          )}
        </span>
      </Field>
    </FieldLabel>
  );
}

/** 물품 크기 choice card 4종 — `radiogroup` 「물품 크기」 (plan 87 AC-01) */
export function QuickRequestGoodsSizeGrid() {
  const field = useFieldContext();
  const value = (useStore(field.store, (s) => s.value) as string | undefined) ?? '';
  // useFieldContext의 formItemId는 FormFieldSet 밖에서 undefined — 고유 id 직접 생성
  const labelId = `${React.useId()}-label`;

  function handleValueChange(next: string) {
    if (!isQuickRequestGoodsSize(next)) {
      return;
    }
    field.handleChange(next);
    field.handleBlur();
  }

  return (
    <FormFieldSet className='min-w-0'>
      <FormField aria-labelledby={labelId}>
        <p id={labelId} className='text-sm font-medium text-foreground'>
          물품 크기{' '}
          <span aria-hidden className='text-destructive'>
            *
          </span>
        </p>
        <div className='@container min-w-0'>
          <RadioGroup
            value={value}
            onValueChange={handleValueChange}
            aria-labelledby={labelId}
            className='grid grid-cols-2 gap-2 @xl:grid-cols-4'
          >
            {QUICK_REQUEST_GOODS_SIZES.map((size) => (
              <QuickRequestGoodsSizeCard key={size} size={size} />
            ))}
          </RadioGroup>
        </div>
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}
