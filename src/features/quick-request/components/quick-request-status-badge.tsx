import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { QuickRequestStatus } from '../api/types';
import {
  QUICK_REQUEST_STATUS_LABELS,
  QUICK_REQUEST_STATUS_TONE_CLASS
} from '../lib/quick-request-status';

type QuickRequestStatusBadgeProps = {
  status: QuickRequestStatus;
  size?: 'default' | 'lg';
  className?: string;
  'data-testid'?: string;
};

/** plan 89 U-3 — 진행 상태 Badge (색 매핑은 `lib/quick-request-status.ts` K1) */
export function QuickRequestStatusBadge({
  status,
  size = 'default',
  className,
  'data-testid': testId
}: QuickRequestStatusBadgeProps) {
  return (
    <Badge
      variant='outline'
      data-testid={testId}
      data-status={status}
      className={cn(
        'shrink-0 rounded-full border-transparent font-normal shadow-none',
        size === 'lg' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs',
        QUICK_REQUEST_STATUS_TONE_CLASS[status],
        className
      )}
    >
      {QUICK_REQUEST_STATUS_LABELS[status]}
    </Badge>
  );
}
