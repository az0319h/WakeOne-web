import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  WalletBalanceEmailRecipientStatus,
  WalletBalanceEmailRunStatus
} from '@/features/wallet/api/balance-email.types';

export function TriggerSourceBadge({ source }: { source: 'cron' | 'admin' }) {
  return (
    <Badge variant='outline' className='font-normal'>
      {source === 'cron' ? '자동(Cron)' : '관리자'}
    </Badge>
  );
}

export function RunStatusBadge({ status }: { status: WalletBalanceEmailRunStatus }) {
  const className =
    status === 'completed'
      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
      : status === 'partial_failed'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300';

  const label =
    status === 'completed' ? '완료' : status === 'partial_failed' ? '일부 실패' : '실패';

  return (
    <Badge variant='outline' className={cn('font-normal', className)}>
      {label}
    </Badge>
  );
}

export function RecipientStatusBadge({ status }: { status: WalletBalanceEmailRecipientStatus }) {
  const className =
    status === 'sent'
      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
      : status === 'skipped'
        ? 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
        : status === 'blocked'
          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300';

  const label =
    status === 'sent'
      ? '발송'
      : status === 'failed'
        ? '실패'
        : status === 'blocked'
          ? '차단'
          : '건너뜀';

  return (
    <Badge variant='outline' className={cn('font-normal', className)}>
      {label}
    </Badge>
  );
}
