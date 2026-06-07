'use client';

import { useStore } from '@tanstack/react-form';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field';
import {
  useFieldContext,
  FormFieldSet,
  FormField,
  FormFieldError,
  createFormField
} from '@/components/ui/form-context';
import { formatPhoneDisplay, parsePhoneDigits } from '@/lib/phone';

interface PhoneFieldProps {
  label: string;
  placeholder?: string;
}

export function PhoneField({
  label,
  placeholder = '010-0000-0000'
}: PhoneFieldProps) {
  const field = useFieldContext();
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  const isValid = useStore(field.store, (s) => s.meta.isValid);
  const digits = (useStore(field.store, (s) => s.value) as string | undefined) ?? '';

  const displayValue = digits ? (formatPhoneDisplay(digits) ?? digits) : '';

  return (
    <FormFieldSet>
      <FormField>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <Input
          id={field.name}
          name={field.name}
          type='tel'
          value={displayValue}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(parsePhoneDigits(e.target.value))}
          placeholder={placeholder}
          aria-invalid={isTouched && !isValid}
        />
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormPhoneField = createFormField(PhoneField);
