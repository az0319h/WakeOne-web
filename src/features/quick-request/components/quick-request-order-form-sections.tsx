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
};

/** 카카오 순서: 주소 → 배송 수단 → 배송 일정 → 물품 → 기사님 전달사항 → 운임 결제 */
export function QuickRequestOrderFormSections({ form }: QuickRequestOrderFormSectionsProps) {
  return (
    <div className='min-w-0 space-y-10'>
      <QuickRequestAddressSection form={form} />
      <QuickRequestVehicleSection form={form} />
      <QuickRequestScheduleSection form={form} />
      <QuickRequestGoodsSection form={form} />
      <QuickRequestDriverNotesSection form={form} />
      <QuickRequestFreightSection form={form} />
    </div>
  );
}
