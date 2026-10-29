'use client';

import { AssetLedgerViewSwitch } from '@/features/asset-requests/components/asset-ledger-view-switch';
import { AssetRequestsView } from '@/features/asset-requests/components/asset-requests-view';
import { SubscriptionDetailDialog } from './subscription-detail-dialog';
import { SubscriptionFormSheet } from './subscription-form-sheet';
import { SubscriptionListView } from './subscription-list-view';

type SubscriptionsPageProps = {
  /** 서버(`isAssetManager`)가 판정 — 권한자 전용 UI는 렌더 자체를 하지 않는다 */
  isManager: boolean;
};

/** 구독 관리 client shell (`subscriptions-page` · designer §2-2) */
export function SubscriptionsPage({ isManager }: SubscriptionsPageProps) {
  return (
    <div data-testid='subscriptions-page' className='flex min-w-0 flex-1 flex-col gap-4'>
      <AssetLedgerViewSwitch
        targetType='subscription'
        isManager={isManager}
        list={<SubscriptionListView isManager={isManager} />}
        requests={<AssetRequestsView targetType='subscription' isManager={isManager} />}
      />
      <SubscriptionDetailDialog />
      {isManager ? <SubscriptionFormSheet /> : null}
    </div>
  );
}
