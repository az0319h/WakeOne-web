'use client';

import { Icons } from '@/components/icons';
import { AssetStatusBadge } from '@/features/asset-ledger/components/asset-status-badge';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { requestTypeLabel, type AssetRequestListItem, type AssetTargetType } from '../api/types';

type AssetRowRequestsProps = {
  targetType: AssetTargetType;
  requests: AssetRequestListItem[];
  onOpen: (id: number) => void;
};

/**
 * 행 Dialog 「이 장비의 요청」/「이 구독의 요청」 (`asset-row-requests`) — 보는 사람 기준(직원 = 본인 요청만 · 서버).
 */
export function AssetRowRequests({ targetType, requests, onOpen }: AssetRowRequestsProps) {
  const title = targetType === 'equipment' ? '이 장비의 요청' : '이 구독의 요청';
  return (
    <section data-testid='asset-row-requests' aria-labelledby='asset-row-requests-title' className='space-y-3'>
      <h3 id='asset-row-requests-title' className='flex items-center gap-2 text-sm font-semibold'>
        {title}
        <span className='font-normal text-muted-foreground tabular-nums'>{requests.length}</span>
      </h3>
      {requests.length === 0 ? (
        <p
          data-testid='asset-row-requests-empty'
          className='rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground'
        >
          아직 요청이 없어요.
        </p>
      ) : (
        <ul className='space-y-2'>
          {requests.map((request) => {
            const typeLabel = requestTypeLabel(targetType, request.request_type);
            return (
              <li key={request.id}>
                <button
                  type='button'
                  data-testid={`asset-request-item-${request.id}`}
                  onClick={() => onOpen(request.id)}
                  className='flex min-h-14 w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                >
                  <span className='flex min-w-0 flex-1 flex-col gap-1'>
                    <span className='flex flex-wrap items-center gap-2'>
                      <span className='font-medium'>{typeLabel}</span>
                      <AssetStatusBadge kind='request' status={request.status} />
                    </span>
                    <span className='text-xs text-muted-foreground tabular-nums'>
                      <span translate='no'>{request.requester_name}</span>
                      {' · '}
                      <span className='font-mono'>{formatAbsoluteDateTimeKo(request.created_at)}</span>
                      {request.assignee_name ? (
                        <>
                          {' · 담당 '}
                          <span translate='no'>{request.assignee_name}</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span
                    className='inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums'
                    aria-label={`댓글 ${request.comment_count}개`}
                  >
                    <Icons.chat aria-hidden className='size-3.5' />
                    {request.comment_count}
                  </span>
                  <Icons.chevronRight aria-hidden className='size-4 shrink-0 text-muted-foreground' />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
