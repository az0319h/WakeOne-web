import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { AssigneeView, SubscriptionAssigneeType } from '../api/types';
import { nameInitials } from '../lib/ui-labels';

const CHIP_CLASS =
  'inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border bg-background px-2 text-sm';

type AssigneeChipProps = {
  /** null = 비어 있음(비품 보관) */
  assignee: Pick<AssigneeView, 'assignee_type' | 'label'> | null;
  className?: string;
  children?: React.ReactNode;
};

function ChipIcon({ type, label }: { type: SubscriptionAssigneeType; label: string }) {
  if (type === 'user') {
    return (
      <Avatar className='size-5 shrink-0'>
        <AvatarFallback className='text-[10px] font-medium'>{nameInitials(label)}</AvatarFallback>
      </Avatar>
    );
  }
  const IconComponent = type === 'team' ? Icons.teams : Icons.building;
  return <IconComponent aria-hidden className='size-4 shrink-0 text-muted-foreground' />;
}

/** 대상자·사용자 칩 — 사람 = 아바타 이니셜 · 팀 = 사람들 아이콘 · 소속 전체 = 건물 아이콘 (designer §1) */
export function AssigneeChip({ assignee, className, children }: AssigneeChipProps) {
  if (!assignee) {
    return (
      <span
        className={cn(
          CHIP_CLASS,
          'border-dashed bg-transparent text-muted-foreground',
          className
        )}
      >
        비어 있음
      </span>
    );
  }

  return (
    <span className={cn(CHIP_CLASS, className)}>
      <ChipIcon type={assignee.assignee_type} label={assignee.label} />
      <span className='min-w-0 truncate' translate='no'>
        {assignee.label}
      </span>
      {children}
    </span>
  );
}

type AssigneeChipsProps = {
  assignees: Pick<AssigneeView, 'assignee_type' | 'label'>[];
  /** 앞에서부터 보일 칩 수 — 나머지는 「외 N」 */
  max: number;
  className?: string;
  emptyLabel?: string;
};

export function AssigneeChips({ assignees, max, className, emptyLabel = '—' }: AssigneeChipsProps) {
  if (assignees.length === 0) {
    return <span className='text-muted-foreground'>{emptyLabel}</span>;
  }
  const visible = assignees.slice(0, max);
  const rest = assignees.length - visible.length;
  return (
    <span
      data-assignee-count={assignees.length}
      className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}
    >
      {visible.map((assignee, index) => (
        <AssigneeChip key={`${assignee.assignee_type}-${assignee.label}-${index}`} assignee={assignee} />
      ))}
      {rest > 0 ? (
        <span className='text-xs whitespace-nowrap text-muted-foreground'>외 {rest}</span>
      ) : null}
    </span>
  );
}
