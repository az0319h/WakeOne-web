import type { ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { AssetDateWithDday } from '@/features/asset-ledger/components/asset-dday';
import { AssetStatusBadge } from '@/features/asset-ledger/components/asset-status-badge';
import { AssigneeChips } from '@/features/asset-ledger/components/assignee-chip';
import { formatPaymentLine } from '@/features/asset-ledger/lib/format';
import { OpenRequestsCell } from '@/features/asset-requests/components/open-requests-cell';
import {
  isSubscriptionManagerItem,
  SUBSCRIPTION_CATEGORY_LABELS,
  type SubscriptionItem
} from '../api/types';

/** 권한자 칸 헤더 — 이름은 그대로 두고 잠금 아이콘만(보조) */
function LockedHeader({ label }: { label: string }) {
  return (
    <span className='inline-flex items-center gap-1'>
      {label}
      <Icons.lock aria-hidden className='size-3.5 text-violet-600 dark:text-violet-300' />
    </span>
  );
}

/**
 * 구독 표 칸 (designer §2-3) — 권한자 칸(「결제」)은 배열에서 **아예 빼서** 직원에게는 헤더도 없다(AC-02).
 */
export function buildSubscriptionColumns({
  isManager
}: {
  isManager: boolean;
}): ColumnDef<SubscriptionItem, unknown>[] {
  const columns: ColumnDef<SubscriptionItem, unknown>[] = [
    {
      id: 'name',
      header: '구독',
      cell: ({ row }) => (
        <div className='flex w-56 min-w-0 flex-col'>
          <span className='truncate font-medium' translate='no' title={row.original.name}>
            {row.original.name}
          </span>
          {row.original.plan_name ? (
            <span className='truncate text-xs text-muted-foreground' translate='no'>
              {row.original.plan_name}
            </span>
          ) : null}
        </div>
      )
    },
    {
      id: 'category',
      header: '구분',
      cell: ({ row }) => (
        <span className='whitespace-nowrap'>
          {SUBSCRIPTION_CATEGORY_LABELS[row.original.category] ?? row.original.category}
        </span>
      )
    },
    {
      id: 'purpose',
      header: '사용 목적',
      cell: ({ row }) =>
        row.original.purpose ? (
          <span className='block max-w-56 truncate' title={row.original.purpose}>
            {row.original.purpose}
          </span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        )
    },
    {
      id: 'assignees',
      header: '대상자',
      cell: ({ row }) => (
        <div className='min-w-44'>
          <AssigneeChips assignees={row.original.assignees} max={2} />
        </div>
      )
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => <AssetStatusBadge kind='subscription' status={row.original.status} />
    },
    {
      id: 'expires_on',
      header: '만료·갱신일',
      cell: ({ row }) => <AssetDateWithDday date={row.original.expires_on} />
    }
  ];

  if (isManager) {
    columns.push({
      id: 'payment',
      header: () => <LockedHeader label='결제' />,
      cell: ({ row }) => {
        const item = row.original;
        if (!isSubscriptionManagerItem(item)) return null;
        return (
          <div className='flex flex-col whitespace-nowrap'>
            <span className='tabular-nums'>{formatPaymentLine(item)}</span>
            {item.card_last4 ? (
              <span className='font-mono text-xs text-muted-foreground'>카드 끝 {item.card_last4}</span>
            ) : null}
          </div>
        );
      }
    });
  }

  columns.push({
    id: 'open_requests',
    header: '진행 중 요청',
    cell: ({ row }) => (
      <OpenRequestsCell targetType='subscription' openRequests={row.original.open_requests} />
    )
  });

  return columns;
}
