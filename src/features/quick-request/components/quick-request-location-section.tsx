'use client';

import * as React from 'react';
import { notifyInfo } from '@/lib/notify';
import type { QuickRequestPlace, QuickRequestRecentAddress } from '../api/types';
import { QuickRequestAddressPickerDialog } from './quick-request-address-picker-dialog';
import { QuickRequestPhoneField, QuickRequestRoadAddressInput } from './quick-request-field-controls';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { QUICK_PLACE_SEARCH_TEXT } from './quick-request-place-search-tab';

type QuickRequestLocationSectionProps = {
  form: QuickRequestOrderForm;
  fieldPrefix: 'origin' | 'destination' | `stopovers[${number}]`;
  /** e.g. `quick-request-origin` · `quick-request-stopover-0` */
  idPrefix: string;
  /** 주소 검색 Dialog의 「최근 이용 내역」 탭 (기본 true · plan 89 수정 Sheet는 false) */
  showRecent?: boolean;
  /** plan 99 — 주소 검색 Dialog의 「장소 검색」 탭 (기본 false · 요청 페이지만 서버 설정값 전달) */
  placeSearchEnabled?: boolean;
};

export function QuickRequestLocationSection({
  form,
  fieldPrefix,
  idPrefix,
  showRecent = true,
  placeSearchEnabled = false
}: QuickRequestLocationSectionProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  // 선택으로 닫히면 상세 주소로, Esc·닫기는 「주소 검색」 버튼으로 포커스 복귀
  const selectedRef = React.useRef(false);
  const detailInputId = `${fieldPrefix}.detailAddress`;
  const searchButtonId = `${fieldPrefix}.roadAddress-search`;
  // plan 97 D-8 — 출발 칸은 origin 목록, 경유·도착 칸은 destination 목록
  const recentDirection = fieldPrefix === 'origin' ? 'origin' : 'destination';

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

  /**
   * plan 99 D-4 — 도로명(없으면 지번 + 안내) · 상세 주소가 비어 있을 때만 장소명.
   * 담당자·연락처는 건드리지 않는다(장소 대표 전화는 담당자 번호가 아님).
   * 닫힌 뒤 포커스는 상세 주소 → 장소명 뒤에 「3층」 등을 바로 덧붙일 수 있다.
   */
  function handlePlaceSelect(place: QuickRequestPlace) {
    form.setFieldValue(`${fieldPrefix}.roadAddress`, place.roadAddress ?? place.address);
    if (place.roadAddress == null) {
      notifyInfo(QUICK_PLACE_SEARCH_TEXT.jibunFallback);
    }
    const currentDetail = form.getFieldValue(`${fieldPrefix}.detailAddress`);
    if (typeof currentDetail !== 'string' || currentDetail.trim() === '') {
      form.setFieldValue(`${fieldPrefix}.detailAddress`, place.name);
    }
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
          {() => (
            <QuickRequestPhoneField
              label='연락처'
              required
              className='bg-muted/50'
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
        recentDirection={recentDirection}
        placeSearchEnabled={placeSearchEnabled}
        onPlaceSelect={handlePlaceSelect}
        getReturnFocusElement={() =>
          document.getElementById(selectedRef.current ? detailInputId : searchButtonId)
        }
      />
    </div>
  );
}
