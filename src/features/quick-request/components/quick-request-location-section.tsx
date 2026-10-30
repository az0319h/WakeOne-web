'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '@tanstack/react-form';
import { notifyInfo } from '@/lib/notify';
import { cn } from '@/lib/utils';
import type { QuickRequestPlace, QuickRequestRecentAddress } from '../api/types';
import { QuickRequestAddressPickerDialog } from './quick-request-address-picker-dialog';
import { QuickRequestPhoneField, QuickRequestRoadAddressInput } from './quick-request-field-controls';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import {
  QUICK_REQUEST_PAGE_INPUT_TEXT_CLASS,
  quickRequestEnterNextProps,
  useQuickRequestFormLayout,
  useQuickRequestIsDesktop
} from './quick-request-form-layout';
import { QUICK_PLACE_SEARCH_TEXT } from './quick-request-place-search-tab';

/** plan 106 D-10 ③ — 좁은 연락처 칸(휴대폰 약 150px)용 짧은 예시 · 형식 안내는 도움말 「숫자만 9~11자리」 */
const MOBILE_PHONE_PLACEHOLDER = '010-1234-5678…';

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
  const layout = useQuickRequestFormLayout();
  const isPage = layout === 'page';
  const isDesktop = useQuickRequestIsDesktop();
  // plan 106 K8 — 요청 폼 휴대폰은 주소 칸 readonly(탭 = 검색) · 「주소 직접 입력」 뒤에만 입력 가능 · lg 이상은 처음부터 입력
  const isMobilePage = isPage && !isDesktop;
  const [manualEntry, setManualEntry] = React.useState(false);
  const pickerOnly = isMobilePage && !manualEntry;

  const [pickerOpen, setPickerOpen] = React.useState(false);
  // 선택으로 닫히면 상세 주소로, 「주소 직접 입력」은 주소 칸으로, Esc·닫기는 「주소 검색」 버튼으로 포커스 복귀
  const returnFocusRef = React.useRef<'search' | 'detail' | 'road'>('search');
  const roadInputId = `${fieldPrefix}.roadAddress`;
  const detailInputId = `${fieldPrefix}.detailAddress`;
  const searchButtonId = `${fieldPrefix}.roadAddress-search`;
  // plan 97 D-8 — 출발 칸은 origin 목록, 경유·도착 칸은 destination 목록
  const recentDirection = fieldPrefix === 'origin' ? 'origin' : 'destination';
  // 도착지 연락처는 뒤에 다른 글자 칸(기타 차량·직접 입력 대수)이 없으면 마지막 칸 → 키보드 「완료」
  const hasLaterTextInput = useStore(
    form.store,
    (s) => s.values.vehicleTypes.includes('기타') || s.values.vehicleCountMode === 'custom'
  );
  const phoneEnterKeyHint = fieldPrefix === 'destination' && !hasLaterTextInput ? 'done' : 'next';
  const pageInputClass = isPage ? QUICK_REQUEST_PAGE_INPUT_TEXT_CLASS : undefined;

  function openPicker() {
    returnFocusRef.current = 'search';
    setPickerOpen(true);
  }

  function closeAfterSelect() {
    returnFocusRef.current = 'detail';
    setPickerOpen(false);
  }

  /**
   * 「주소 직접 입력」 — 검색창을 닫고 주소 칸을 입력 가능하게 바꾼 뒤 바로 포커스(값 유지).
   * readonly 해제를 같은 탭 처리 안에서 반영(flushSync)해야 아이폰에서 키보드가 바로 올라온다.
   */
  function handleManualEntry() {
    returnFocusRef.current = 'road';
    flushSync(() => {
      setManualEntry(true);
      setPickerOpen(false);
    });
    document.getElementById(roadInputId)?.focus();
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
            placeholder={pickerOnly ? '주소 검색…' : '주소 입력…'}
            testIdPrefix={idPrefix}
            onSearchClick={openPicker}
            pickerOnly={pickerOnly}
            enterKeyHint='next'
          />
        )}
      </form.AppField>

      <form.AppField name={`${fieldPrefix}.detailAddress`}>
        {(field) => (
          <field.TextField
            label='상세 주소'
            required
            placeholder='예: 3층 301호…'
            className={cn('h-11 bg-muted/50', pageInputClass)}
            data-testid={`${idPrefix}-detail-address`}
            {...quickRequestEnterNextProps(layout)}
          />
        )}
      </form.AppField>

      {/* plan 106 D-10 ③ — 요청 폼은 칸 폭 288px 이상이면 담당자·연락처 한 줄(M360·M375) · 수정 Sheet는 지금 그대로 */}
      <div className={cn('grid min-w-0 gap-3', isPage ? '@[18rem]:grid-cols-2' : '@sm:grid-cols-2')}>
        <form.AppField name={`${fieldPrefix}.contactName`}>
          {(field) => (
            <field.TextField
              label='담당자'
              required
              placeholder='이름'
              autoComplete='off'
              className={cn('h-11 bg-muted/50', pageInputClass)}
              data-testid={`${idPrefix}-contact-name`}
              {...quickRequestEnterNextProps(layout)}
            />
          )}
        </form.AppField>

        <form.AppField name={`${fieldPrefix}.contactPhone`}>
          {() => (
            <QuickRequestPhoneField
              label='연락처'
              required
              placeholder={isMobilePage ? MOBILE_PHONE_PLACEHOLDER : undefined}
              enterKeyHint={isPage ? phoneEnterKeyHint : undefined}
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
        onManualEntry={isMobilePage ? handleManualEntry : undefined}
        getReturnFocusElement={() =>
          document.getElementById(
            returnFocusRef.current === 'detail'
              ? detailInputId
              : returnFocusRef.current === 'road'
                ? roadInputId
                : searchButtonId
          )
        }
      />
    </div>
  );
}
