'use client';

import * as React from 'react';
import type { QuickRequestRecentAddress } from '../api/types';
import { QuickRequestAddressPickerDialog } from './quick-request-address-picker-dialog';
import { QuickRequestRoadAddressInput } from './quick-request-field-controls';
import type { QuickRequestOrderForm } from './quick-request-form-api';

type QuickRequestLocationSectionProps = {
  form: QuickRequestOrderForm;
  fieldPrefix: 'origin' | 'destination' | `stopovers[${number}]`;
  /** e.g. `quick-request-origin` · `quick-request-stopover-0` */
  idPrefix: string;
  /** 주소 검색 Dialog의 「최근 이용 내역」 탭 (기본 true · plan 89 수정 Sheet는 false) */
  showRecent?: boolean;
};

export function QuickRequestLocationSection({
  form,
  fieldPrefix,
  idPrefix,
  showRecent = true
}: QuickRequestLocationSectionProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  // 선택으로 닫히면 상세 주소로, Esc·닫기는 「주소 검색」 버튼으로 포커스 복귀
  const selectedRef = React.useRef(false);
  const detailInputId = `${fieldPrefix}.detailAddress`;
  const searchButtonId = `${fieldPrefix}.roadAddress-search`;

  function openPicker() {
    selectedRef.current = false;
    setPickerOpen(true);
  }

  function closeAfterSelect() {
    selectedRef.current = true;
    setPickerOpen(false);
  }

  function handleRoadSelect(roadAddress: string) {
    form.setFieldValue(`${fieldPrefix}.roadAddress`, roadAddress);
    closeAfterSelect();
  }

  function handleRecentSelect(address: QuickRequestRecentAddress) {
    form.setFieldValue(`${fieldPrefix}.roadAddress`, address.roadAddress);
    form.setFieldValue(`${fieldPrefix}.detailAddress`, address.detailAddress);
    form.setFieldValue(`${fieldPrefix}.contactName`, address.contactName);
    form.setFieldValue(`${fieldPrefix}.contactPhone`, address.contactPhone);
    closeAfterSelect();
  }

  return (
    <div className='@container grid min-w-0 gap-3'>
      <form.AppField name={`${fieldPrefix}.roadAddress`}>
        {() => (
          <QuickRequestRoadAddressInput
            label='주소'
            required
            placeholder='주소 입력…'
            testIdPrefix={idPrefix}
            onSearchClick={openPicker}
          />
        )}
      </form.AppField>

      <form.AppField name={`${fieldPrefix}.detailAddress`}>
        {(field) => (
          <field.TextField
            label='상세 주소'
            required
            placeholder='예: 3층 301호…'
            className='h-11 bg-muted/50'
            data-testid={`${idPrefix}-detail-address`}
          />
        )}
      </form.AppField>

      <div className='grid min-w-0 gap-3 @sm:grid-cols-2'>
        <form.AppField name={`${fieldPrefix}.contactName`}>
          {(field) => (
            <field.TextField
              label='담당자'
              required
              placeholder='이름'
              autoComplete='off'
              className='h-11 bg-muted/50'
              data-testid={`${idPrefix}-contact-name`}
            />
          )}
        </form.AppField>

        <form.AppField name={`${fieldPrefix}.contactPhone`}>
          {(field) => (
            <field.TextField
              label='연락처'
              required
              type='tel'
              inputMode='numeric'
              placeholder='01012345678'
              autoComplete='off'
              className='h-11 bg-muted/50'
              data-testid={`${idPrefix}-contact-phone`}
            />
          )}
        </form.AppField>
      </div>

      <QuickRequestAddressPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onRoadSelect={handleRoadSelect}
        onRecentSelect={handleRecentSelect}
        showRecent={showRecent}
        getReturnFocusElement={() =>
          document.getElementById(selectedRef.current ? detailInputId : searchButtonId)
        }
      />
    </div>
  );
}
