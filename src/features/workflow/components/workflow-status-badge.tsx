import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkflowDocumentStatus } from '../api/types';

type BadgeTone = 'approval' | 'progress' | 'done' | 'declined' | 'canceled';

const TONE_CLASS: Record<BadgeTone, string> = {
  approval: 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400',
  progress: 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/10 dark:text-blue-400',
  done: 'bg-green-500/10 text-green-700 hover:bg-green-500/10 dark:text-green-400',
  declined: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
  canceled: 'bg-muted text-muted-foreground hover:bg-muted'
};

type WorkflowStatusBadgeProps = {
  status: WorkflowDocumentStatus;
  currentStep: number;
  totalSteps: number;
  /** 목록 행: 보는 사람이 지금 승인할 차례면 「승인 필요」가 우선한다 */
  approvalRequired?: boolean;
  size?: 'default' | 'lg';
  className?: string;
};

export function getWorkflowStatusLabel(input: {
  status: WorkflowDocumentStatus;
  currentStep: number;
  totalSteps: number;
}): string {
  switch (input.status) {
    case 'DONE':
      return '완료';
    case 'DECLINED':
      return '반려';
    case 'CANCELED':
      return '취소';
    case 'IN_PROGRESS':
    default:
      return `진행중 ${input.currentStep}/${input.totalSteps}`;
  }
}

export function WorkflowStatusBadge({
  status,
  currentStep,
  totalSteps,
  approvalRequired = false,
  size = 'default',
  className
}: WorkflowStatusBadgeProps) {
  const tone: BadgeTone = approvalRequired
    ? 'approval'
    : status === 'DONE'
      ? 'done'
      : status === 'DECLINED'
        ? 'declined'
        : status === 'CANCELED'
          ? 'canceled'
          : 'progress';
  const label = approvalRequired
    ? '승인 필요'
    : getWorkflowStatusLabel({ status, currentStep, totalSteps });

  return (
    <Badge
      variant='outline'
      className={cn(
        'shrink-0 rounded-full border-transparent font-normal tabular-nums shadow-none',
        size === 'lg' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs',
        TONE_CLASS[tone],
        className
      )}
    >
      {label}
    </Badge>
  );
}
