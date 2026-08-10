'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AnnouncementListItem } from '../api/types';
import { AnnouncementPinBadge } from './announcement-pin-badge';
import { AnnouncementPriorityBadge } from './announcement-priority-badge';
import { AnnouncementRowAction } from './announcement-row-action';
import { AnnouncementTimestamps } from './announcement-timestamps';
import { getAnnouncementBodyExcerpt } from './announcement-utils';

interface AnnouncementListRowProps {
  announcement: AnnouncementListItem;
  onClick: (announcement: AnnouncementListItem) => void;
  isAdmin?: boolean;
  onEdit?: (announcementId: number) => void;
  onDeleted?: () => void;
  className?: string;
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
    <Card
      className={cn('hover:bg-accent/50 transition-colors', className)}
      data-testid={`announcement-row-${announcement.id}`}
    >
      <CardContent className='flex items-start gap-2 p-4'>
        <button
          type='button'
          className='min-w-0 flex-1 cursor-pointer text-left'
          onClick={() => onClick(announcement)}
        >
          <div className='space-y-2'>
            <div className='flex flex-wrap items-start gap-2'>
              <div className='min-w-0 flex-1 space-y-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h3 className='truncate text-sm font-semibold'>{announcement.title}</h3>
                  {announcement.is_pinned ? <AnnouncementPinBadge /> : null}
                  <AnnouncementPriorityBadge priority={announcement.priority} />
                </div>
                <p className='text-muted-foreground line-clamp-1 text-sm'>
                  {getAnnouncementBodyExcerpt(announcement.body)}
                </p>
              </div>
            </div>
            <AnnouncementTimestamps
              createdAt={announcement.created_at}
              updatedAt={announcement.updated_at}
            />
          </div>
        </button>
        {isAdmin && onEdit ? (
          <AnnouncementRowAction
            announcement={announcement}
            onView={onClick}
            onEdit={onEdit}
            onDeleted={onDeleted}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
