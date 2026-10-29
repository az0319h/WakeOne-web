'use client';

import { useStore } from '@tanstack/react-form';
import { Input } from '@/components/ui/input';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  useFieldContext,
  FormFieldSet,
  FormField,
  FormFieldError,
  createFormField
} from '@/components/ui/form-context';
import { formatPhoneDisplay, parsePhoneDigits } from '@/lib/phone';
import { PHONE_INPUT_HINT, PHONE_INPUT_PLACEHOLDER } from '@/lib/phone-messages';

interface PhoneFieldProps {
  label: string;
  placeholder?: string;
}

/**
 * 연락처 입력 (profile · users Sheet 공용) — 표시는 `formatPhoneDisplay`, 값은 숫자만(`parsePhoneDigits`).
 * plan 97 U-6 — placeholder `010-1234-5678 / 02-123-4567` · 도움말 「숫자만 9~11자리」(`aria-describedby`).
 */
export function PhoneField({
  label,
  placeholder = PHONE_INPUT_PLACEHOLDER
}: PhoneFieldProps) {
  const field = useFieldContext();
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  const isValid = useStore(field.store, (s) => s.meta.isValid);
  const digits = (useStore(field.store, (s) => s.value) as string | undefined) ?? '';
  const hintId = `${field.name}-hint`;

  const displayValue = digits ? (formatPhoneDisplay(digits) ?? digits) : '';

  return (
    <FormFieldSet>
      <FormField>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <Input
          id={field.name}
          name={field.name}
          type='tel'
          inputMode='numeric'
          value={displayValue}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(parsePhoneDigits(e.target.value))}
          placeholder={placeholder}
          aria-invalid={isTouched && !isValid}
          aria-describedby={hintId}
        />
        <FieldDescription id={hintId} className='text-xs'>
          {PHONE_INPUT_HINT}
        </FieldDescription>
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormPhoneField = createFormField(PhoneField);
