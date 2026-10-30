import type { QuickRequestDetail } from '../../api/types';
import { resolveQuickStatusSummary } from '../../lib/quick-request-status-summary';

type QuickRequestStatusSummaryProps = {
  detail: QuickRequestDetail;
};

/**
 * plan 106 D-15 ① · designer §6.3 — 휴대폰 상태 카드 2행 「지금 상태 한 문장」 (AC-43).
 * 상태가 실시간으로 바뀌면(Realtime invalidate) 문장이 바뀌므로 `aria-live=polite`.
 */
export function QuickRequestStatusSummary({ detail }: QuickRequestStatusSummaryProps) {
  return (
    <p
      data-testid='quick-detail-status-summary'
      aria-live='polite'
      className='text-base font-medium break-keep text-foreground'
    >
      {resolveQuickStatusSummary(detail)}
    </p>
  );
}
