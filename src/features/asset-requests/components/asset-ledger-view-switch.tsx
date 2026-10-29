'use client';

import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LedgerToneBadge } from '@/features/asset-ledger/components/asset-status-badge';
import { useLedgerView } from '@/features/asset-ledger/hooks/use-ledger-params';
import { assetRequestSummaryQueryOptions } from '../api/queries';
import type { AssetTargetType } from '../api/types';

type AssetLedgerViewSwitchProps = {
  targetType: AssetTargetType;
  isManager: boolean;
  list: React.ReactNode;
  requests: React.ReactNode;
};

/**
 * 「목록 | 요청」 전환 (plan D-18 · designer §2-2) — `?view=requests`.
 * 배지: 권한자 「처리 대기 N」(`asset-pending-badge`) · 직원 「내 요청 N」(`asset-my-open-badge`) · N=0이면 숨김.
 * 배지 숫자는 집계 1개라 non-suspense 조회(사이드바 배지와 같은 summary 캐시) — 로딩·실패 중엔 배지 없음.
 */
export function AssetLedgerViewSwitch({
  targetType,
  isManager,
  list,
  requests
}: AssetLedgerViewSwitchProps) {
  const { view, setView } = useLedgerView();
  const { data: summary } = useQuery(assetRequestSummaryQueryOptions());

  const pending =
    targetType === 'subscription' ? summary?.subscription_pending : summary?.equipment_pending;
  const myOpen =
    targetType === 'subscription' ? summary?.subscription_my_open : summary?.equipment_my_open;

  return (
    <Tabs
      value={view}
      onValueChange={(next) => setView(next === 'requests' ? 'requests' : 'list')}
      className='min-w-0 gap-4'
    >
      <TabsList
        data-testid='asset-view-switch'
        className='grid h-11 w-full grid-cols-2 md:inline-flex md:h-9 md:w-fit'
      >
        <TabsTrigger value='list' data-testid='asset-view-list' className='px-3'>
          <Icons.list aria-hidden />
          목록
        </TabsTrigger>
        <TabsTrigger value='requests' data-testid='asset-view-requests' className='px-3'>
          <Icons.chat aria-hidden />
          요청
          {isManager && pending ? (
            <LedgerToneBadge tone='amber' data-testid='asset-pending-badge' className='ml-0.5'>
              처리 대기 {pending}
            </LedgerToneBadge>
          ) : null}
          {!isManager && myOpen ? (
            <LedgerToneBadge tone='amber' data-testid='asset-my-open-badge' className='ml-0.5'>
              내 요청 {myOpen}
            </LedgerToneBadge>
          ) : null}
        </TabsTrigger>
      </TabsList>
      <TabsContent value='list' className='flex min-w-0 flex-col gap-4'>
        {list}
      </TabsContent>
      <TabsContent value='requests' className='flex min-w-0 flex-col gap-4'>
        {requests}
      </TabsContent>
    </Tabs>
  );
}
