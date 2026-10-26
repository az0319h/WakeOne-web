'use client';

import { QuickAmountInputField, QuickDispatchFields, type QuickDispatchFieldsForm } from '../dialogs/quick-dispatch-fields';
import { QuickRequestSectionShell } from '../quick-request-section-shell';

type QuickRequestEditDispatchSectionProps = {
  form: QuickDispatchFieldsForm;
  /** 최종금액이 이미 입력된 건 — 비울 수 없다 */
  hasFinalAmount: boolean;
};

/** `dispatched`에서만 — 배차 정보 4필드 + 최종금액 (testid `quick-edit-*`) */
export function QuickRequestEditDispatchSection({ form, hasFinalAmount }: QuickRequestEditDispatchSectionProps) {
  return (
    <>
      <QuickRequestSectionShell id='quick-request-edit-section-dispatch' title='배차 정보'>
        <QuickDispatchFields form={form} vehicleInfoName='dispatchVehicleInfo' testIdPrefix='quick-edit' />
      </QuickRequestSectionShell>
      <QuickRequestSectionShell
        id='quick-request-edit-section-amount'
        title='금액'
        optional={!hasFinalAmount}
        description={hasFinalAmount ? undefined : '비워 두면 최종금액을 저장하지 않습니다.'}
      >
        <form.AppField name='finalAmount'>
          {() => (
            <QuickAmountInputField
              label='최종금액'
              required={hasFinalAmount}
              data-testid='quick-edit-final-amount'
            />
          )}
        </form.AppField>
      </QuickRequestSectionShell>
    </>
  );
}
