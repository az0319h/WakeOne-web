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
import {
  QUICK_REQUEST_PAGE_INPUT_TEXT_CLASS,
  quickRequestEnterNextProps,
  useQuickRequestFormLayout,
  type QuickRequestEnterKeyHint
} from './quick-request-form-layout';

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
  /**
   * plan 106 D-10 ② · K8 — 요청 폼 휴대폰: 칸 `readonly` · 탭/Enter/Space = 주소 검색 Dialog.
   * 「주소 직접 입력」 뒤나 lg 이상이면 `false` (수정 Sheet는 전달하지 않음 = 지금 그대로)
   */
  pickerOnly?: boolean;
  /** 요청 폼 Enter → 다음 칸 (`pickerOnly`일 때는 건너뜀) */
  enterKeyHint?: QuickRequestEnterKeyHint;
};

export function QuickRequestRoadAddressInput({
  label,
  required,
  placeholder,
  testIdPrefix,
  onSearchClick,
  pickerOnly = false,
  enterKeyHint
}: QuickRequestRoadAddressInputProps) {
  const field = useFieldContext();
  const value = (useStore(field.store, (s) => s.value) as string | undefined) ?? '';
  const hasVisibleError = useQuickRequestVisibleError();
  const layout = useQuickRequestFormLayout();
  const isPage = layout === 'page';
  const inputId = field.name;

  function handlePickerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSearchClick();
  }

  return (
    <FormFieldSet className='min-w-0'>
      <FormField>
        <FieldLabel htmlFor={inputId}>
          {label}
          {required && ' *'}
        </FieldLabel>
        <InputGroup className={cn('h-11 bg-muted/50', pickerOnly && 'cursor-pointer')}>
          <InputGroupInput
            id={inputId}
            value={value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
            aria-invalid={hasVisibleError}
            autoComplete='off'
            placeholder={placeholder}
            className={cn(
              'h-full',
              // 요청 폼: 묶음 테두리(1px×2) 안쪽 42px → 입력 상자 자체를 44px로(테두리 위로 겹쳐 보이는 모양은 같음 · AC-09)
              isPage && ['-my-px h-11', QUICK_REQUEST_PAGE_INPUT_TEXT_CLASS],
              pickerOnly && 'cursor-pointer'
            )}
            data-testid={`${testIdPrefix}-road-address`}
            {...(pickerOnly
              ? {
                  readOnly: true,
                  'aria-haspopup': 'dialog' as const,
                  onClick: onSearchClick,
                  onKeyDown: handlePickerKeyDown
                }
              : quickRequestEnterNextProps(layout, enterKeyHint))}
          />
          <InputGroupAddon align='inline-end' className='self-stretch py-0 pr-0 has-[>button]:mr-0'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className={cn(
                '-my-px -mr-px h-11 rounded-l-none shadow-none',
                // 요청 폼 lg 미만: 칸 안 돋보기 아이콘(44) · 글자는 접근 이름으로만 남김
                isPage &&
                  'max-lg:w-11 max-lg:border-transparent max-lg:bg-transparent max-lg:px-0 max-lg:dark:bg-transparent'
              )}
              id={`${inputId}-search`}
              aria-haspopup='dialog'
              data-testid={`${testIdPrefix}-address-search`}
              onClick={onSearchClick}
            >
              <Icons.search className='size-4' aria-hidden />
              <span className={cn(isPage && 'max-lg:sr-only')}>주소 검색</span>
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
  /** 기본 `PHONE_INPUT_PLACEHOLDER` (요청 폼 휴대폰은 좁은 칸용 짧은 예시) */
  placeholder?: string;
  /** 요청 폼 Enter → 다음 칸 (`quickRequestEnterNextProps` · 수정 Sheet·배차 Dialog는 없음) */
  enterKeyHint?: QuickRequestEnterKeyHint;
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
  placeholder = PHONE_INPUT_PLACEHOLDER,
  enterKeyHint,
  className,
  'data-testid': dataTestId
}: QuickRequestPhoneFieldProps) {
  const field = useFieldContext();
  const value = (useStore(field.store, (s) => s.value) as string | undefined) ?? '';
  const hasVisibleError = useQuickRequestVisibleError();
  const layout = useQuickRequestFormLayout();
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
          placeholder={placeholder}
          value={value}
          onChange={(e) => field.handleChange(parsePhoneDigits(e.target.value))}
          onBlur={field.handleBlur}
          aria-invalid={hasVisibleError}
          aria-describedby={hintId}
          className={cn('h-11', layout === 'page' && QUICK_REQUEST_PAGE_INPUT_TEXT_CLASS, className)}
          data-testid={dataTestId}
          {...(enterKeyHint ? quickRequestEnterNextProps(layout, enterKeyHint) : {})}
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
  /** number는 숫자 · datetime-local은 `yyyy-MM-ddTHH:mm` (plan 106 D-11 — 요청 폼 등록만) */
  min?: number | string;
  /** 칸에 들어올 때 (예: 날짜 `min`을 지금 기준으로 다시 계산) */
  onFocus?: () => void;
  /** 요청 폼 Enter → 다음 칸 (number 칸만 · datetime-local은 제외) */
  enterKeyHint?: QuickRequestEnterKeyHint;
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
  onFocus,
  enterKeyHint,
  inputMode,
  suffix,
  className,
  'data-testid': dataTestId
}: QuickRequestNativeInputFieldProps) {
  const field = useFieldContext();
  const rawValue = useStore(field.store, (s) => s.value) as string | number | undefined;
  const hasVisibleError = useQuickRequestVisibleError();
  const layout = useQuickRequestFormLayout();
  const inputId = field.name;
  const value = rawValue ?? '';
  const isPage = layout === 'page';
  const pageTextClass = isPage ? QUICK_REQUEST_PAGE_INPUT_TEXT_CLASS : undefined;

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
    onFocus,
    'aria-invalid': hasVisibleError,
    'data-testid': dataTestId,
    ...(enterKeyHint ? quickRequestEnterNextProps(layout, enterKeyHint) : {})
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
            <InputGroupInput
              {...inputProps}
              className={cn('h-full', isPage && '-my-px h-11', pageTextClass)}
            />
            <InputGroupAddon align='inline-end'>
              <InputGroupText>{suffix}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        ) : (
          <Input
            {...inputProps}
            className={cn(
              'h-11 w-full min-w-0 appearance-none bg-muted/50 [&::-webkit-date-and-time-value]:text-left',
              pageTextClass,
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

/**
 * 카드 전체가 클릭 영역인 radio (Field choice card) — `getByRole('radio', { name: title })` 유지.
 * plan 106 D-10 ⑧ · R6 · AC-28 — ui `Field` horizontal의 `has-[>[data-slot=field-content]]:items-start`가
 * `items-center`를 이겨 글자가 위로 붙던 문제 → 같은 선택자로 `items-center`를 덮는다.
 * 요청 폼(`page`)·수정 Sheet(`sheet`) 모두 적용(PC 포함 · 사용자 「전체 다 고쳐」).
 */
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
      <Field
        orientation='horizontal'
        className='min-h-12 items-center has-[>[data-slot=field-content]]:items-center'
      >
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
