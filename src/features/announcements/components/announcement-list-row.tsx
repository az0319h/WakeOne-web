'use client';

import { Icons } from '@/components/icons';
import {
  formatAbsoluteDateKo,
  formatBirthdayDisplay
} from '@/lib/format-date';
import { cn } from '@/lib/utils';
import type { AnnouncementListItem, AnnouncementPriority } from '../api/types';
import { AnnouncementPinBadge } from './announcement-pin-badge';
import { AnnouncementPriorityBadge } from './announcement-priority-badge';
import { AnnouncementRowAction } from './announcement-row-action';

const LIST_PRIORITY_BADGE_CLASS: Record<AnnouncementPriority, string> = {
  normal:
    'border-transparent bg-black/[0.03] text-muted-foreground hover:bg-black/[0.03] rounded-full px-2 py-0.5 text-xs font-normal shadow-none dark:bg-white/[0.06]',
  important:
    'border-transparent bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 rounded-full px-2 py-0.5 text-xs font-normal shadow-none dark:text-amber-400',
  urgent:
    'border-transparent bg-destructive/10 text-destructive hover:bg-destructive/10 rounded-full px-2 py-0.5 text-xs font-normal shadow-none'
};

const LIST_PIN_BADGE_CLASS =
  'border-transparent bg-black/[0.03] text-muted-foreground hover:bg-black/[0.03] rounded-full px-2 py-0.5 text-xs font-normal shadow-none dark:bg-white/[0.06]';

interface AnnouncementListRowProps {
  announcement: AnnouncementListItem;
  onClick: (announcement: AnnouncementListItem) => void;
  isAdmin?: boolean;
  onEdit?: (announcementId: number) => void;
  onDeleted?: () => void;
  className?: string;
}

function formatListDate(value: string): string {
  return formatBirthdayDisplay(value) ?? formatAbsoluteDateKo(value);
}

export function AnnouncementListRow({
  announcement,
  onClick,
  isAdmin = false,
  onEdit,
  onDeleted,
  className
}: AnnouncementListRowProps) {
  return (
    <div
      className={cn('border-border/80 flex items-center border-b', className)}
      data-testid={`announcement-row-${announcement.id}`}
    >
      <button
        type='button'
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 py-4 text-left transition-colors',
          'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          isAdmin ? 'pr-1' : 'pr-0'
        )}
        onClick={() => onClick(announcement)}
      >
        <div className='flex shrink-0 items-center gap-2'>
          <AnnouncementPriorityBadge
            priority={announcement.priority}
            className={LIST_PRIORITY_BADGE_CLASS[announcement.priority]}
          />
          {announcement.is_pinned ? (
            <AnnouncementPinBadge className={LIST_PIN_BADGE_CLASS} />
          ) : null}
        </div>

        <span className='min-w-0 flex-1 truncate text-sm'>
          {announcement.title}
        </span>

        <time
          dateTime={announcement.created_at}
          className='text-muted-foreground shrink-0 text-sm whitespace-nowrap'
        >
          {formatListDate(announcement.created_at)}
        </time>

        {!isAdmin ? (
          <Icons.chevronRight
            aria-hidden
            className='text-muted-foreground/40 size-5 shrink-0'
          />
        ) : null}
      </button>

      {isAdmin && onEdit ? (
        <div className='shrink-0'>
          <AnnouncementRowAction
            announcement={announcement}
            onView={onClick}
            onEdit={onEdit}
            onDeleted={onDeleted}
          />
        </div>
      ) : null}
    </div>
  );
}
