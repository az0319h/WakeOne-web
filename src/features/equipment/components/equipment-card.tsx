import { Icons } from '@/components/icons';
import { AssetStatusBadge } from '@/features/asset-ledger/components/asset-status-badge';
import { AssigneeChip } from '@/features/asset-ledger/components/assignee-chip';
import { EQUIPMENT_KIND_ICONS } from '@/features/asset-ledger/lib/ui-labels';
import { OpenRequestsCell } from '@/features/asset-requests/components/open-requests-cell';
import type { EquipmentItem } from '../api/types';

type EquipmentCardProps = {
  item: EquipmentItem;
  onOpen: (id: number) => void;
};

/** 휴대폰 카드 (`equipment-card-{id}` · AC-15) — 자산번호·모델·사용자·상태 · 권한자 칸은 Dialog에서 */
export function EquipmentCard({ item, onOpen }: EquipmentCardProps) {
  const KindIcon = Icons[EQUIPMENT_KIND_ICONS[item.kind] ?? 'product'];
  const label = [item.asset_no, item.model_serial].filter(Boolean).join(' ');
  return (
    <li>
      <button
        type='button'
        data-testid={`equipment-card-${item.id}`}
        aria-label={`${label} 자세히 보기`}
        onClick={() => onOpen(item.id)}
        className='flex w-full min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
      >
        <span className='flex w-full min-w-0 items-start gap-3'>
          <span className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted'>
            <KindIcon aria-hidden className='size-5' />
          </span>
          <span className='flex min-w-0 flex-1 flex-col'>
            <span className='font-mono font-semibold tabular-nums' translate='no'>
              {item.asset_no}
            </span>
            <span className='truncate text-sm' translate='no'>
              {item.model_serial ?? '—'}
            </span>
          </span>
          <AssetStatusBadge kind='equipment' status={item.status} className='shrink-0' />
        </span>
        <span className='flex w-full min-w-0 items-center justify-between gap-2'>
          <AssigneeChip assignee={item.assignee} className='min-w-0' />
          <OpenRequestsCell targetType='equipment' openRequests={item.open_requests} emptyLabel='요청 없음' />
        </span>
      </button>
    </li>
  );
}
