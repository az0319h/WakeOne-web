import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AnnouncementPriority } from '../api/types';

const PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  normal: '일반',
  important: '중요',
  urgent: '긴급'
};

interface AnnouncementPriorityBadgeProps {
  priority: AnnouncementPriority;
  className?: string;
}

export function AnnouncementPriorityBadge({
  priority,
  className
}: AnnouncementPriorityBadgeProps) {
  if (priority === 'urgent') {
    return (
      <Badge variant='destructive' className={className}>
        {PRIORITY_LABELS[priority]}
      </Badge>
    );
  }

  if (priority === 'important') {
    return (
      <Badge
        variant='outline'
        className={cn(
          'border-amber-500/50 text-amber-700 dark:text-amber-400',
          className
        )}
      >
        {PRIORITY_LABELS[priority]}
      </Badge>
    );
  }

  return (
    <Badge variant='outline' className={className}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
