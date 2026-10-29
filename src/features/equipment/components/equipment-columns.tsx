import type { ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { AssetStatusBadge } from '@/features/asset-ledger/components/asset-status-badge';
import { AssigneeChip } from '@/features/asset-ledger/components/assignee-chip';
import { OpenRequestsCell } from '@/features/asset-requests/components/open-requests-cell';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import {
  EQUIPMENT_KIND_LABELS,
  isEquipmentManagerItem,
  LEDGER_ENTITY_LABELS,
  type EquipmentItem
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

const Dash = () => <span className='text-muted-foreground'>—</span>;

/**
 * 비품 표 칸 (designer §2-3) — 권한자 칸(「회계장부」「구입일」)은 배열에서 **아예 빼서** 직원에게는 헤더도 없다(AC-02).
 */
export function buildEquipmentColumns({
  isManager
}: {
  isManager: boolean;
}): ColumnDef<EquipmentItem, unknown>[] {
  const columns: ColumnDef<EquipmentItem, unknown>[] = [
    {
      id: 'asset_no',
      header: '자산번호',
      cell: ({ row }) => (
        <span className='font-mono font-semibold whitespace-nowrap tabular-nums' translate='no'>
          {row.original.asset_no}
        </span>
      )
    },
    {
      id: 'kind',
      header: '품목',
      cell: ({ row }) => (
        <span className='whitespace-nowrap'>
          {EQUIPMENT_KIND_LABELS[row.original.kind] ?? row.original.kind}
        </span>
      )
    },
    {
      id: 'model_serial',
      header: '모델·시리얼',
      cell: ({ row }) =>
        row.original.model_serial ? (
          <span className='block max-w-56 truncate' translate='no' title={row.original.model_serial}>
            {row.original.model_serial}
          </span>
        ) : (
          <Dash />
        )
    },
    {
      id: 'assignee',
      header: '사용자',
      cell: ({ row }) => (
        <div className='min-w-36'>
          <AssigneeChip assignee={row.original.assignee} />
        </div>
      )
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => <AssetStatusBadge kind='equipment' status={row.original.status} />
    },
    {
      id: 'open_requests',
      header: '진행 중 요청',
      cell: ({ row }) => (
        <OpenRequestsCell targetType='equipment' openRequests={row.original.open_requests} />
      )
    }
  ];

  if (isManager) {
    columns.push(
      {
        id: 'ledger_entity',
        header: () => <LockedHeader label='회계장부' />,
        cell: ({ row }) => {
          const item = row.original;
          if (!isEquipmentManagerItem(item) || !item.ledger_entity) return <Dash />;
          return <span className='whitespace-nowrap'>{LEDGER_ENTITY_LABELS[item.ledger_entity]}</span>;
        }
      },
      {
        id: 'purchased_on',
        header: () => <LockedHeader label='구입일' />,
        cell: ({ row }) => {
          const item = row.original;
          if (!isEquipmentManagerItem(item) || !item.purchased_on) return <Dash />;
          return (
            <span className='font-mono whitespace-nowrap tabular-nums'>
              {formatAbsoluteDateKo(item.purchased_on)}
            </span>
          );
        }
      }
    );
  }

  return columns;
}
