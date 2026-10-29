'use client';

import { useId, useState } from 'react';
import { useStore } from '@tanstack/react-form';
import { ko } from 'date-fns/locale';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  createFormField,
  FormField,
  FormFieldError,
  FormFieldSet,
  useFieldContext,
  type WithTypedName
} from '@/components/ui/tanstack-form';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { cn } from '@/lib/utils';

/**
 * plan 103 · designer §2-7 — Sheet 폼 칸 (항목별 testid가 필요해 공용 Select/Checkbox 필드 대신 feature 칸).
 * 오류 표시는 공용 `FormField`/`FormFieldError`(제출 시도 후 · 첫 오류 칸 포커스는 `scrollToFirstError`).
 */

/** 선택 안 함 — Radix Select는 빈 문자열 값을 못 쓴다 */
const NONE_VALUE = '__none__';

type Option = { value: string; label: string };

type LedgerSelectFieldProps = {
  label: string;
  options: Option[];
  required?: boolean;
  /** 비워 둘 수 있으면 첫 항목 「선택 안 함」 */
  allowEmpty?: boolean;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  'data-testid'?: string;
};

function LedgerSelectField({
  label,
  options,
  required,
  allowEmpty,
  placeholder = '선택해 주세요',
  description,
  disabled,
  ...rest
}: LedgerSelectFieldProps) {
  const field = useFieldContext();
  const value = useStore(field.store, (state) => state.value) as string;
  const isValid = useStore(field.store, (state) => state.meta.isValid);
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const id = `${field.name}-select`;

  return (
    <FormFieldSet>
      <FormField>
        <FieldLabel htmlFor={id}>
          {label}
          {required ? ' *' : null}
        </FieldLabel>
        <Select
          value={value ? value : allowEmpty ? NONE_VALUE : ''}
          disabled={disabled}
          onValueChange={(next) => field.handleChange(next === NONE_VALUE ? '' : next)}
          onOpenChange={(open) => {
            if (!open) field.handleBlur();
          }}
        >
          <SelectTrigger
            id={id}
            data-testid={rest['data-testid']}
            aria-invalid={isTouched && !isValid}
            className='h-11 w-full md:h-9'
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {allowEmpty ? <SelectItem value={NONE_VALUE}>선택 안 함</SelectItem> : null}
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                data-testid={
                  rest['data-testid'] ? `${rest['data-testid']}-option-${option.value}` : undefined
                }
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormLedgerSelectField = createFormField(LedgerSelectField);

type LedgerDateFieldProps = {
  label: string;
  required?: boolean;
  'data-testid'?: string;
};

function parseDateValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** 날짜만 — Popover + Calendar(ko) · 「날짜 지우기」 (workflow DateWidget 복제) · 값은 `yyyy-MM-dd` */
function LedgerDateField({ label, required, ...rest }: LedgerDateFieldProps) {
  const field = useFieldContext();
  const value = (useStore(field.store, (state) => state.value) as string) ?? '';
  const isValid = useStore(field.store, (state) => state.meta.isValid);
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const id = `${field.name}-date`;

  return (
    <FormFieldSet>
      <FormField>
        <FieldLabel htmlFor={id}>
          {label}
          {required ? ' *' : null}
        </FieldLabel>
        <div className='flex items-center gap-1'>
          <Popover
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) field.handleBlur();
            }}
          >
            <PopoverTrigger asChild>
              <Button
                id={id}
                type='button'
                variant='outline'
                data-testid={rest['data-testid']}
                aria-invalid={isTouched && !isValid}
                className={cn(
                  'h-11 flex-1 justify-between font-normal tabular-nums md:h-9',
                  !value && 'text-muted-foreground'
                )}
              >
                {value ? formatAbsoluteDateKo(value) : '날짜 선택'}
                <Icons.calendar aria-hidden className='text-muted-foreground' />
              </Button>
            </PopoverTrigger>
            <PopoverContent align='start' className='w-auto p-0'>
              <Calendar
                mode='single'
                locale={ko}
                selected={selected}
                defaultMonth={selected}
                onSelect={(date) => {
                  if (date) field.handleChange(formatAbsoluteDateKo(date));
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          {value ? (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-11 shrink-0 text-muted-foreground md:h-9'
              onClick={() => field.handleChange('')}
            >
              날짜 지우기
            </Button>
          ) : null}
        </div>
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormLedgerDateField = createFormField(LedgerDateField);

type LedgerCheckboxFieldProps = {
  label: string;
  description?: string;
  'data-testid'?: string;
};

function LedgerCheckboxField({ label, description, ...rest }: LedgerCheckboxFieldProps) {
  const field = useFieldContext();
  const value = Boolean(useStore(field.store, (state) => state.value));
  const id = `${field.name}-checkbox`;

  return (
    <FormFieldSet>
      <FormField orientation='horizontal' className='min-h-11 items-center'>
        <Checkbox
          id={id}
          data-testid={rest['data-testid']}
          checked={value}
          onCheckedChange={(checked) => {
            field.handleChange(checked === true);
            field.handleBlur();
          }}
        />
        <div className='flex flex-1 flex-col gap-1 leading-snug'>
          <FieldLabel htmlFor={id} className='font-normal'>
            {label}
          </FieldLabel>
          {description ? <FieldDescription>{description}</FieldDescription> : null}
        </div>
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormLedgerCheckboxField = createFormField(LedgerCheckboxField);

type LedgerTextareaFieldProps = {
  label: string;
  /** 라벨을 화면에서 숨김(댓글 입력 등) */
  hideLabel?: boolean;
  required?: boolean;
  description?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  'data-testid'?: string;
};

/** 여러 줄 — `useId`로 id를 만든다(같은 화면에 `body` 칸이 둘이어도 label 연결이 안 꼬이게) */
function LedgerTextareaField({
  label,
  hideLabel,
  required,
  description,
  placeholder,
  rows = 4,
  maxLength,
  showCount = false,
  autoFocus,
  disabled,
  className,
  onKeyDown,
  ...rest
}: LedgerTextareaFieldProps) {
  const field = useFieldContext();
  const value = (useStore(field.store, (state) => state.value) as string) ?? '';
  const isValid = useStore(field.store, (state) => state.meta.isValid);
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const id = useId();

  return (
    <FormFieldSet>
      <FormField>
        <FieldLabel htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
          {label}
          {required ? ' *' : null}
        </FieldLabel>
        <Textarea
          id={id}
          data-testid={rest['data-testid']}
          value={value}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete='off'
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={isTouched && !isValid}
          className={className}
          onBlur={field.handleBlur}
          onKeyDown={onKeyDown}
          onChange={(event) => field.handleChange(event.target.value)}
        />
        {showCount && maxLength ? (
          <div className='text-right text-xs text-muted-foreground tabular-nums'>
            {value.length} / {maxLength}
          </div>
        ) : null}
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormLedgerTextareaField = createFormField(LedgerTextareaField);

/** 서버 400/409 문구 → 칸 오류 (`errorMap.onServer` · 값을 바꾸면 TanStack이 지운다) */
/** 폼 값 타입으로 `name`을 좁힌 칸 묶음 (`useFormFields`와 같은 방식) */
export function ledgerFormFields<TValues extends Record<string, unknown>>() {
  type Typed<C> = WithTypedName<C, TValues>;
  return {
    LedgerSelectField: FormLedgerSelectField as unknown as Typed<typeof FormLedgerSelectField>,
    LedgerDateField: FormLedgerDateField as unknown as Typed<typeof FormLedgerDateField>,
    LedgerCheckboxField: FormLedgerCheckboxField as unknown as Typed<typeof FormLedgerCheckboxField>,
    LedgerTextareaField: FormLedgerTextareaField as unknown as Typed<typeof FormLedgerTextareaField>
  };
}

type MetaWithErrorMap = { errorMap?: Record<string, unknown> } & Record<string, unknown>;
type LooseSetFieldMeta = (
  field: string,
  updater: (prev: MetaWithErrorMap | undefined) => MetaWithErrorMap
) => void;

export function setServerFieldError(
  form: { setFieldMeta: unknown },
  field: string,
  message: string
) {
  const setFieldMeta = form.setFieldMeta as LooseSetFieldMeta;
  setFieldMeta(field, (prev) => ({
    ...prev,
    errorMap: { ...prev?.errorMap, onServer: message }
  }));
}
