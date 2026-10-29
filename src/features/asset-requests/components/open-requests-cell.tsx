import type { AssetOpenRequests } from '@/features/asset-ledger/api/types';
import { AssetStatusBadge } from '@/features/asset-ledger/components/asset-status-badge';
import { requestTypeLabel, type AssetTargetType } from '../api/types';

type OpenRequestsCellProps = {
  targetType: AssetTargetType;
  openRequests: AssetOpenRequests | null;
  emptyLabel?: string;
};

/** 「진행 중 요청」 — 보는 사람 기준 · [상태] 종류 + 2건↑ 「외 N」 · 없으면 「—」 (designer C-3) */
export function OpenRequestsCell({ targetType, openRequests, emptyLabel = '—' }: OpenRequestsCellProps) {
  if (!openRequests || openRequests.count === 0) {
    return <span className='text-xs text-muted-foreground'>{emptyLabel}</span>;
  }
  const { first, count } = openRequests;
  return (
    <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
      <AssetStatusBadge kind='request' status={first.status} />
      <span className='text-xs'>{requestTypeLabel(targetType, first.request_type)}</span>
      {count > 1 ? <span className='text-xs text-muted-foreground'>외 {count - 1}</span> : null}
    </span>
  );
}
