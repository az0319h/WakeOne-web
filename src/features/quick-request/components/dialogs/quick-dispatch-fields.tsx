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
import { QuickRequestPhoneField } from '../quick-request-field-controls';
import {
  QUICK_REQUEST_DRIVER_NAME_MAX_LENGTH,
  QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH,
  QUICK_REQUEST_VEHICLE_PLATE_PLACEHOLDER
} from '../../schemas/quick-request-dispatch';

/** plan 94 D-8 — 예상금액·최종금액 설명 (Dialog 2곳 공용) */
export const QUICK_AMOUNT_VAT_INCLUDED_DESCRIPTION = '부가세 포함 금액으로 입력';

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
  /** 자동차등록번호 필드 이름 (Dialog `vehicleInfo` · 수정 Sheet `dispatchVehicleInfo` — 필드명·컬럼은 유지 · plan 94 D-9) */
  vehicleInfoName: 'vehicleInfo' | 'dispatchVehicleInfo';
  /** testid 접두 (`quick-dispatch` · `quick-edit`) */
  testIdPrefix: string;
};

/**
 * 배차 정보 4필드 — 예상금액 · 자동차등록번호 · 기사 이름 · 기사 연락처 (모두 필수).
 * 자동차등록번호 형식 에러 문구는 스키마(`quickRequestVehicleInfoInputSchema` → `lib/quick-request-vehicle-plate.ts`)에서 온다.
 */
export function QuickDispatchFields({ form, vehicleInfoName, testIdPrefix }: QuickDispatchFieldsProps) {
  return (
    <div className='grid min-w-0 gap-4'>
      <form.AppField name='estimatedAmount'>
        {() => (
          <QuickAmountInputField
            label='예상금액'
            description={QUICK_AMOUNT_VAT_INCLUDED_DESCRIPTION}
            required
            data-testid={`${testIdPrefix}-estimated-amount`}
          />
        )}
      </form.AppField>
      <form.AppField name={vehicleInfoName}>
        {(field) => (
          <field.TextField
            label='자동차등록번호'
            required
            placeholder={QUICK_REQUEST_VEHICLE_PLATE_PLACEHOLDER}
            maxLength={QUICK_REQUEST_VEHICLE_PLATE_MAX_LENGTH}
            inputMode='text'
            autoComplete='off'
            spellCheck={false}
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
        {() => (
          <QuickRequestPhoneField
            label='기사 연락처'
            required
            data-testid={`${testIdPrefix}-driver-phone`}
          />
        )}
      </form.AppField>
    </div>
  );
}
