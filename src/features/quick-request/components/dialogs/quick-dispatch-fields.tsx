'use client';

import { useStore } from '@tanstack/react-form';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  FormField,
  FormFieldError,
  FormFieldSet,
  useFieldContext,
  useFormContext
} from '@/components/ui/form-context';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { formatQuickAmountInput } from '../../lib/format-quick-amount';
import {
  QUICK_REQUEST_DRIVER_NAME_MAX_LENGTH,
  QUICK_REQUEST_VEHICLE_INFO_MAX_LENGTH
} from '../../schemas/quick-request-dispatch';

type QuickAmountInputFieldProps = {
  label: string;
  description?: string;
  required?: boolean;
  'data-testid'?: string;
};

/** 금액 입력 — 입력 중 천 단위 콤마 · 오른쪽 「원」 (plan 89 §5) */
export function QuickAmountInputField({
  label,
  description,
  required,
  'data-testid': testId
}: QuickAmountInputFieldProps) {
  const field = useFieldContext();
  const form = useFormContext();
  const value = (useStore(field.store, (s) => s.value) as string | undefined) ?? '';
  const isTouched = useStore(field.store, (s) => s.meta.isTouched);
  const hasSubmitted = useStore(form.store, (s) => s.submissionAttempts > 0);
  const hasVisibleError = field.errors.length > 0 && (isTouched || hasSubmitted);

  return (
    <FormFieldSet className='min-w-0'>
      <FormField>
        <FieldLabel htmlFor={field.name}>
          {label}
          {required && ' *'}
        </FieldLabel>
        <InputGroup className='h-11'>
          <InputGroupInput
            id={field.name}
            inputMode='numeric'
            autoComplete='off'
            placeholder='0'
            value={value}
            onChange={(event) => field.handleChange(formatQuickAmountInput(event.target.value))}
            onBlur={field.handleBlur}
            aria-invalid={hasVisibleError}
            className='h-full text-right tabular-nums'
            data-testid={testId}
          />
          <InputGroupAddon align='inline-end'>
            <InputGroupText>원</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

/** `form.AppField` 최소 구조 — 배차 Dialog · 수정 Sheet 공용 */
type DispatchFieldApi = {
  TextField: (props: Record<string, unknown>) => React.ReactNode;
};

export type QuickDispatchFieldsForm = {
  AppField: (props: {
    name: string;
    children: (field: DispatchFieldApi) => React.ReactNode;
  }) => React.ReactNode;
};

type QuickDispatchFieldsProps = {
  form: QuickDispatchFieldsForm;
  /** 차량정보 필드 이름 (Dialog `vehicleInfo` · 수정 Sheet `dispatchVehicleInfo`) */
  vehicleInfoName: 'vehicleInfo' | 'dispatchVehicleInfo';
  /** testid 접두 (`quick-dispatch` · `quick-edit`) */
  testIdPrefix: string;
};

/** 배차 정보 4필드 — 예상금액 · 차량정보 · 기사 이름 · 기사 연락처 (모두 필수) */
export function QuickDispatchFields({ form, vehicleInfoName, testIdPrefix }: QuickDispatchFieldsProps) {
  return (
    <div className='grid min-w-0 gap-4'>
      <form.AppField name='estimatedAmount'>
        {() => (
          <QuickAmountInputField
            label='예상금액'
            description='부가세 별도'
            required
            data-testid={`${testIdPrefix}-estimated-amount`}
          />
        )}
      </form.AppField>
      <form.AppField name={vehicleInfoName}>
        {(field) => (
          <field.TextField
            label='차량정보'
            required
            placeholder='예: 오토바이 8514…'
            maxLength={QUICK_REQUEST_VEHICLE_INFO_MAX_LENGTH}
            autoComplete='off'
            className='h-11'
            data-testid={`${testIdPrefix}-vehicle-info`}
          />
        )}
      </form.AppField>
      <form.AppField name='driverName'>
        {(field) => (
          <field.TextField
            label='기사 이름'
            required
            placeholder='예: 홍길동…'
            maxLength={QUICK_REQUEST_DRIVER_NAME_MAX_LENGTH}
            autoComplete='off'
            className='h-11'
            data-testid={`${testIdPrefix}-driver-name`}
          />
        )}
      </form.AppField>
      <form.AppField name='driverPhone'>
        {(field) => (
          <field.TextField
            label='기사 연락처'
            required
            type='tel'
            inputMode='numeric'
            placeholder='01012345678'
            autoComplete='off'
            className='h-11'
            data-testid={`${testIdPrefix}-driver-phone`}
          />
        )}
      </form.AppField>
    </div>
  );
}
