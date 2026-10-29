import { Icons } from '@/components/icons';
import { AssetDateWithDday } from '@/features/asset-ledger/components/asset-dday';
import { AssetStatusBadge } from '@/features/asset-ledger/components/asset-status-badge';
import { AssigneeChips } from '@/features/asset-ledger/components/assignee-chip';
import { SUBSCRIPTION_CATEGORY_ICONS } from '@/features/asset-ledger/lib/ui-labels';
import type { SubscriptionItem } from '../api/types';
import { OpenRequestsCell } from '@/features/asset-requests/components/open-requests-cell';

type SubscriptionCardProps = {
  item: SubscriptionItem;
  onOpen: (id: number) => void;
};

/** 휴대폰 카드 (`subscription-card-{id}`) — 권한자 칸(결제)은 넣지 않는다(Dialog에서 본다) */
export function SubscriptionCard({ item, onOpen }: SubscriptionCardProps) {
  const CategoryIcon = Icons[SUBSCRIPTION_CATEGORY_ICONS[item.category] ?? 'product'];
  return (
    <li>
      <button
        type='button'
        data-testid={`subscription-card-${item.id}`}
        aria-label={`${item.name} 자세히 보기`}
        onClick={() => onOpen(item.id)}
        className='flex w-full min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
      >
        <span className='flex w-full min-w-0 items-start gap-3'>
          <span className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted'>
            <CategoryIcon aria-hidden className='size-5' />
          </span>
          <span className='flex min-w-0 flex-1 flex-col'>
            <span className='truncate font-semibold' translate='no'>
              {item.name}
            </span>
            {item.plan_name ? (
              <span className='truncate text-sm text-muted-foreground' translate='no'>
                {item.plan_name}
              </span>
            ) : null}
          </span>
          <AssetStatusBadge kind='subscription' status={item.status} className='shrink-0' />
        </span>
        <span className='flex w-full min-w-0 items-center justify-between gap-2'>
          <AssigneeChips assignees={item.assignees} max={1} className='flex-nowrap' />
          <OpenRequestsCell
            targetType='subscription'
            openRequests={item.open_requests}
            emptyLabel='요청 없음'
          />
        </span>
        {item.expires_on ? (
          <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            만료·갱신
            <AssetDateWithDday date={item.expires_on} />
          </span>
        ) : null}
      </button>
    </li>
  );
}
