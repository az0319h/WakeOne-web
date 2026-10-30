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
import { cn } from '@/lib/utils';
import { QUICK_REQUEST_GOODS_VISUALS } from '../lib/quick-request-goods-visuals';
import { QUICK_REQUEST_GOODS_SIZES, type QuickRequestGoodsSize } from '../schemas/quick-request-notify';
import { isQuickRequestGoodsSize } from '../schemas/quick-request-form';
import { useQuickRequestFormLayout } from './quick-request-form-layout';

type QuickRequestGoodsSizeCardProps = {
  size: QuickRequestGoodsSize;
};

/**
 * 물품 크기 choice card.
 * plan 106 K13 · AC-23 — 요청 폼 lg 미만: 한 줄 카드(높이 56) = [작은 사진 36][제목·예시][라디오] · 세로 가운데.
 * lg 이상·수정 Sheet: 지금 그대로(높이 128 · 사진 오른쪽 아래).
 */
function QuickRequestGoodsSizeCard({ size }: QuickRequestGoodsSizeCardProps) {
  const isPage = useQuickRequestFormLayout() === 'page';
  const visual = QUICK_REQUEST_GOODS_VISUALS[size];
  const id = `quick-request-goods-size-${size}-radio`;
  const titleId = `${id}-title`;
  const descId = visual.caption ? `${id}-desc` : undefined;

  return (
    <FieldLabel
      htmlFor={id}
      data-testid={`quick-request-goods-size-${size}`}
      className={cn(
        'min-w-0 cursor-pointer bg-card transition-colors group-data-[invalid=true]/field:border-destructive/60 hover:bg-muted/50 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
        isPage
          ? '[&>*]:data-[slot=field]:px-2.5 [&>*]:data-[slot=field]:py-2 lg:[&>*]:data-[slot=field]:p-3'
          : '[&>*]:data-[slot=field]:p-3'
      )}
    >
      <Field
        orientation='horizontal'
        className={cn(
          'relative',
          isPage
            ? 'min-h-10 items-center gap-2.5 has-[>[data-slot=field-content]]:items-center lg:min-h-32 lg:items-start lg:gap-3 lg:has-[>[data-slot=field-content]]:items-start'
            : 'min-h-32 items-start'
        )}
      >
        <FieldContent className={cn('min-w-0', isPage && 'max-lg:gap-0')}>
          <FieldTitle id={titleId} className='text-foreground'>
            {visual.title}
          </FieldTitle>
          {visual.caption ? (
            <FieldDescription
              id={descId}
              className={cn('break-keep', isPage && 'max-lg:text-xs max-lg:leading-4')}
            >
              {visual.caption}
            </FieldDescription>
          ) : null}
        </FieldContent>
        <RadioGroupItem id={id} value={size} aria-labelledby={titleId} aria-describedby={descId} />
        <span
          className={cn(
            'flex items-center justify-center rounded-md bg-muted',
            isPage
              ? 'size-9 shrink-0 max-lg:-order-1 lg:absolute lg:right-2 lg:bottom-2 lg:size-16'
              : 'absolute right-2 bottom-2 size-16'
          )}
        >
          {visual.src ? (
            <Image
              src={visual.src}
              alt={visual.title}
              width={visual.width}
              height={visual.height}
              unoptimized
              className={cn('object-contain', isPage ? 'size-7 lg:size-12' : 'size-12')}
            />
          ) : (
            <Icons.dots
              className={cn('text-muted-foreground', isPage ? 'size-5 lg:size-6' : 'size-6')}
              aria-hidden
            />
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
