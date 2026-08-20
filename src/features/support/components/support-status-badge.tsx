import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  SUPPORT_STATUS_LABELS,
  type SupportStatus
} from '../api/types';

const STATUS_BADGE_CLASS: Record<SupportStatus, string> = {
  pending:
    'border-transparent bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400',
  received:
    'border-transparent bg-blue-500/10 text-blue-700 hover:bg-blue-500/10 dark:text-blue-400',
  completed:
    'border-transparent bg-green-500/10 text-green-700 hover:bg-green-500/10 dark:text-green-400'
};

interface SupportStatusBadgeProps {
  status: SupportStatus;
  className?: string;
}

export function SupportStatusBadge({ status, className }: SupportStatusBadgeProps) {
  return (
    <Badge
      variant='outline'
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-normal shadow-none',
        STATUS_BADGE_CLASS[status],
        className
      )}
      data-testid={`support-status-${status}`}
    >
      {SUPPORT_STATUS_LABELS[status]}
    </Badge>
  );
}
