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
import { Spinner } from '@/components/ui/spinner';

interface TextFieldProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'onBlur'
> {
  label: string;
  description?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number';
}

export function TextField({
  label,
  description,
  required,
  type = 'text',
  className,
  ...inputProps
}: TextFieldProps) {
  const field = useFieldContext();
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  const isValid = useStore(field.store, (s) => s.meta.isValid);
  const isValidating = useStore(field.store, (s) => s.meta.isValidating);
  const value = useStore(field.store, (s) => s.value) as string | number;
  const { id: inputIdProp, ...restInputProps } = inputProps;
  const inputId = inputIdProp ?? field.name;

  return (
    <FormFieldSet>
      <FormField>
        <FieldLabel htmlFor={inputId}>
          {label}
          {required && ' *'}
        </FieldLabel>
        <div className='relative'>
          <Input
            id={inputId}
            type={type}
            value={value ?? ''}
            onBlur={field.handleBlur}
            onChange={(e) => {
              if (type === 'number') {
                const v = e.target.value;
                field.handleChange(v === '' ? '' : parseFloat(v));
              } else {
                field.handleChange(e.target.value);
              }
            }}
            aria-invalid={isTouched && !isValid}
            className={className}
            {...restInputProps}
          />
          {isValidating && (
            <div className='absolute top-1/2 right-3 -translate-y-1/2'>
              <Spinner className='h-4 w-4' />
            </div>
          )}
        </div>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormTextField = createFormField(TextField);
