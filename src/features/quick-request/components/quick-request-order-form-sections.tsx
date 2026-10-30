'use client';

import { QuickRequestAddressSection } from './quick-request-address-section';
import { QuickRequestDriverNotesSection } from './quick-request-driver-notes-section';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { QuickRequestFreightSection } from './quick-request-freight-section';
import { QuickRequestGoodsSection } from './quick-request-goods-section';
import { QuickRequestScheduleSection } from './quick-request-schedule-section';
import { QuickRequestVehicleSection } from './quick-request-vehicle-section';

type QuickRequestOrderFormSectionsProps = {
  form: QuickRequestOrderForm;
  /** plan 99 — 주소 검색 Dialog 「장소 검색」 탭 (기본 false) */
  placeSearchEnabled?: boolean;
};

/**
 * 카카오 순서: 주소 → 배송 수단 → 배송 일정 → 물품 → 기사님 전달사항 → 운임 결제.
 * plan 106 K13 — lg 미만 섹션 간격 20px(높이 예산 AC-23) · lg 이상 40px 그대로.
 */
export function QuickRequestOrderFormSections({
  form,
  placeSearchEnabled = false
}: QuickRequestOrderFormSectionsProps) {
  return (
    <div className='min-w-0 space-y-5 lg:space-y-10'>
      <QuickRequestAddressSection form={form} placeSearchEnabled={placeSearchEnabled} />
      <QuickRequestVehicleSection form={form} />
      <QuickRequestScheduleSection form={form} />
      <QuickRequestGoodsSection form={form} />
      <QuickRequestDriverNotesSection form={form} />
      <QuickRequestFreightSection form={form} />
    </div>
  );
}
