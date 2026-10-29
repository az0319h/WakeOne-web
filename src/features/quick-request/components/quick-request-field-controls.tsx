'use client';

import type { ReactNode } from 'react';
import { useStore } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import {
  FormField,
  FormFieldError,
  FormFieldSet,
  useFieldContext,
  useFormContext
} from '@/components/ui/form-context';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { Icons } from '@/components/icons';
import { parsePhoneDigits } from '@/lib/phone';
import { PHONE_INPUT_HINT, PHONE_INPUT_PLACEHOLDER } from '@/lib/phone-messages';
import { cn } from '@/lib/utils';

/** FormField·FormFieldError와 동일한 노출 조건 (touched 또는 제출 시도 1회 이상) */
function useQuickRequestVisibleError() {
  const field = useFieldContext();
  const form = useFormContext();
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  const hasSubmitted = useStore(form.store, (s) => s.submissionAttempts > 0);
  return field.errors.length > 0 && (isTouched || hasSubmitted);
}

type QuickRequestRoadAddressInputProps = {
  label: string;
  required?: boolean;
  placeholder?: string;
  /** e.g. `quick-request-origin` → `-road-address` · `-address-search` */
  testIdPrefix: string;
  /** 「주소 검색」 — 주소 검색 Dialog 열기 */
  onSearchClick: () => void;
};

export function QuickRequestRoadAddressInput({
  label,
  required,
  placeholder,
  testIdPrefix,
  onSearchClick
}: QuickRequestRoadAddressInputProps) {
  const field = useFieldContext();
  const value = (useStore(field.store, (s) => s.value) as string | undefined) ?? '';
  const hasVisibleError = useQuickRequestVisibleError();
  const inputId = field.name;

  return (
    <FormFieldSet className='min-w-0'>
      <FormField>
        <FieldLabel htmlFor={inputId}>
          {label}
          {required && ' *'}
        </FieldLabel>
        <InputGroup className='h-11 bg-muted/50'>
          <InputGroupInput
            id={inputId}
            value={value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            aria-invalid={hasVisibleError}
            autoComplete='off'
            placeholder={placeholder}
            className='h-full'
            data-testid={`${testIdPrefix}-road-address`}
          />
          <InputGroupAddon align='inline-end' className='self-stretch py-0 pr-0 has-[>button]:mr-0'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='-my-px -mr-px h-11 rounded-l-none shadow-none'
              id={`${inputId}-search`}
              aria-haspopup='dialog'
              data-testid={`${testIdPrefix}-address-search`}
              onClick={onSearchClick}
            >
              <Icons.search className='size-4' aria-hidden />
              주소 검색
            </Button>
          </InputGroupAddon>
        </InputGroup>
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

type QuickRequestPhoneFieldProps = {
  label: string;
  required?: boolean;
  className?: string;
  'data-testid'?: string;
};

/**
 * plan 97 U-6 · designer K4 — 연락처 입력 (퀵 폼 담당자 연락처 · 배차 기사 연락처 공용).
 * placeholder `010-1234-5678 / 02-123-4567` · 도움말 「숫자만 9~11자리」(`aria-describedby`) ·
 * 입력 시 `parsePhoneDigits`로 하이픈·공백을 지우고 숫자만 최대 자릿수까지 남긴다(하이픈 예시를 보여주므로 하이픈 입력도 통과).
 * 에러 문구는 zod(`PHONE_INPUT_ERROR`)에서 온다.
 */
export function QuickRequestPhoneField({
  label,
  required,
  className,
  'data-testid': dataTestId
}: QuickRequestPhoneFieldProps) {
  const field = useFieldContext();
  const value = (useStore(field.store, (s) => s.value) as string | undefined) ?? '';
  const hasVisibleError = useQuickRequestVisibleError();
  const inputId = field.name;
  const hintId = `${inputId}-hint`;

  return (
    <FormFieldSet className='min-w-0'>
      <FormField>
        <FieldLabel htmlFor={inputId}>
          {label}
          {required && ' *'}
        </FieldLabel>
        <Input
          id={inputId}
          name={inputId}
          type='tel'
          inputMode='numeric'
          autoComplete='off'
          placeholder={PHONE_INPUT_PLACEHOLDER}
          value={value}
          onChange={(e) => field.handleChange(parsePhoneDigits(e.target.value))}
          onBlur={field.handleBlur}
          aria-invalid={hasVisibleError}
          aria-describedby={hintId}
          className={cn('h-11', className)}
          data-testid={dataTestId}
        />
        <FieldDescription id={hintId} className='text-xs'>
          {PHONE_INPUT_HINT}
        </FieldDescription>
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

type QuickRequestNativeInputFieldProps = {
  label: string;
  type: 'datetime-local' | 'number';
  required?: boolean;
  min?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  /** 입력 오른쪽 접미 (예: 「대」) — 지정 시 InputGroup으로 렌더 */
  suffix?: ReactNode;
  className?: string;
  'data-testid'?: string;
};

export function QuickRequestNativeInputField({
  label,
  type,
  required,
  min,
  inputMode,
  suffix,
  className,
  'data-testid': dataTestId
}: QuickRequestNativeInputFieldProps) {
  const field = useFieldContext();
  const rawValue = useStore(field.store, (s) => s.value) as string | number | undefined;
  const hasVisibleError = useQuickRequestVisibleError();
  const inputId = field.name;
  const value = rawValue ?? '';

  function handleChange(next: string) {
    if (type === 'number') {
      field.handleChange(next === '' ? undefined : Number.parseInt(next, 10));
      return;
    }
    field.handleChange(next);
  }

  const inputProps = {
    id: inputId,
    type,
    min,
    inputMode,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleChange(e.target.value),
    onBlur: field.handleBlur,
    'aria-invalid': hasVisibleError,
    'data-testid': dataTestId
  };

  return (
    <FormFieldSet className='min-w-0'>
      <FormField>
        <FieldLabel htmlFor={inputId}>
          {label}
          {required && ' *'}
        </FieldLabel>
        {suffix ? (
          <InputGroup className={cn('h-11 bg-muted/50', className)}>
            <InputGroupInput {...inputProps} className='h-full' />
            <InputGroupAddon align='inline-end'>
              <InputGroupText>{suffix}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        ) : (
          <Input
            {...inputProps}
            className={cn(
              'h-11 w-full min-w-0 appearance-none bg-muted/50 [&::-webkit-date-and-time-value]:text-left',
              className
            )}
          />
        )}
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

type QuickRequestRadioCardProps = {
  id: string;
  value: string;
  title: string;
  'data-testid'?: string;
};

/** 카드 전체가 클릭 영역인 radio (Field choice card) — `getByRole('radio', { name: title })` 유지 */
export function QuickRequestRadioCard({
  id,
  value,
  title,
  'data-testid': dataTestId
}: QuickRequestRadioCardProps) {
  const titleId = `${id}-title`;
  return (
    <FieldLabel
      htmlFor={id}
      data-testid={dataTestId}
      className='min-w-0 cursor-pointer bg-card transition-colors hover:bg-muted/50 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 [&>*]:data-[slot=field]:px-3 [&>*]:data-[slot=field]:py-2'
    >
      <Field orientation='horizontal' className='min-h-12 items-center'>
        <RadioGroupItem id={id} value={value} aria-labelledby={titleId} />
        <FieldContent className='min-w-0'>
          <FieldTitle id={titleId} className='break-keep wrap-break-word text-foreground'>
            {title}
          </FieldTitle>
        </FieldContent>
      </Field>
    </FieldLabel>
  );
}
