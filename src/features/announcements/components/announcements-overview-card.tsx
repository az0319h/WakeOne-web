'use client';

import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnnouncementListItem } from '../api/types';
import { AnnouncementPinBadge } from './announcement-pin-badge';
import { AnnouncementPriorityBadge } from './announcement-priority-badge';
import { AnnouncementTimestamps } from './announcement-timestamps';
import { getAnnouncementBodyExcerpt } from './announcement-utils';

interface AnnouncementsOverviewCardProps {
  announcements: AnnouncementListItem[];
}

export function AnnouncementsOverviewCard({
  announcements
}: AnnouncementsOverviewCardProps) {
  if (announcements.length === 0) {
    return null;
  }

  return (
    <Card aria-label='공지사항' data-testid='announcements-overview-card'>
      <CardHeader className='flex flex-row items-start justify-between gap-4 pb-2'>
        <div className='space-y-1'>
          <CardTitle className='text-base font-medium'>공지사항</CardTitle>
          <p className='text-muted-foreground text-sm'>최근 등록된 공지를 확인합니다.</p>
        </div>
        <Link
          href='/dashboard/announcements'
          className='text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline'
          data-testid='announcements-overview-view-all'
        >
          전체 보기
          <Icons.chevronRight className='size-4' />
        </Link>
      </CardHeader>
      <CardContent className='space-y-2'>
        {announcements.map((announcement) => (
          <Link
            key={announcement.id}
            href={`/dashboard/announcements?announcement=${announcement.id}`}
            className='hover:bg-accent/50 block rounded-md border p-3 transition-colors'
            data-testid={`announcements-overview-item-${announcement.id}`}
          >
            <div className='flex flex-wrap items-center gap-2'>
              <span className='truncate text-sm font-medium'>{announcement.title}</span>
              {announcement.is_pinned ? <AnnouncementPinBadge /> : null}
              <AnnouncementPriorityBadge priority={announcement.priority} />
            </div>
            <p className='text-muted-foreground mt-1 line-clamp-1 text-xs'>
              {getAnnouncementBodyExcerpt(announcement.body, 60)}
            </p>
            <AnnouncementTimestamps
              createdAt={announcement.created_at}
              updatedAt={announcement.updated_at}
              className='mt-1'
            />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
