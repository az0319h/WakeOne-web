'use client';

import { AssetLedgerViewSwitch } from '@/features/asset-requests/components/asset-ledger-view-switch';
import { AssetRequestsView } from '@/features/asset-requests/components/asset-requests-view';
import { EquipmentDetailDialog } from './equipment-detail-dialog';
import { EquipmentFormSheet } from './equipment-form-sheet';
import { EquipmentListView } from './equipment-list-view';

type EquipmentPageProps = {
  /** 서버(`isAssetManager`)가 판정 — 권한자 전용 UI는 렌더 자체를 하지 않는다 */
  isManager: boolean;
};

/** 비품 관리 client shell (`equipment-page` · designer §2-2) */
export function EquipmentPage({ isManager }: EquipmentPageProps) {
  return (
    <div data-testid='equipment-page' className='flex min-w-0 flex-1 flex-col gap-4'>
      <AssetLedgerViewSwitch
        targetType='equipment'
        isManager={isManager}
        list={<EquipmentListView isManager={isManager} />}
        requests={<AssetRequestsView targetType='equipment' isManager={isManager} />}
      />
      <EquipmentDetailDialog />
      {isManager ? <EquipmentFormSheet /> : null}
    </div>
  );
}
