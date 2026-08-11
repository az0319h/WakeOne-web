'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import {
  ANNOUNCEMENTS_PAGE_SIZE,
  announcementsInfiniteQueryOptions
} from '../api/queries';
import type { AnnouncementListItem } from '../api/types';
import { useAnnouncementListFilterParams } from './announcements-list-filters';
import { AnnouncementListRow } from './announcement-list-row';
import { hasActiveAnnouncementFilters } from '../api/filter-utils';

interface AnnouncementInfiniteListProps {
  onRowClick: (announcement: AnnouncementListItem) => void;
  isAdmin?: boolean;
  onEdit?: (announcementId: number) => void;
  onDeleted?: () => void;
  emptyMessage?: string;
  className?: string;
}

function flattenAnnouncements(
  pages: { announcements: AnnouncementListItem[] }[] | undefined
): AnnouncementListItem[] {
  if (!pages) {
    return [];
  }

  const seen = new Set<number>();
  const result: AnnouncementListItem[] = [];

  for (const page of pages) {
    for (const announcement of page.announcements) {
      if (!seen.has(announcement.id)) {
        seen.add(announcement.id);
        result.push(announcement);
      }
    }
  }

  return result;
}

export function AnnouncementInfiniteList({
  onRowClick,
  isAdmin = false,
  onEdit,
  onDeleted,
  emptyMessage = '등록된 공지가 없습니다.',
  className
}: AnnouncementInfiniteListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { filters } = useAnnouncementListFilterParams();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(announcementsInfiniteQueryOptions(filters));

  const announcements = useMemo(
    () => flattenAnnouncements(data.pages),
    [data.pages]
  );

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '120px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (announcements.length === 0) {
    const filteredEmptyMessage = hasActiveAnnouncementFilters(filters)
      ? '조건에 맞는 공지가 없습니다.'
      : emptyMessage;

    return (
      <div className={className} data-testid='announcements-empty'>
        <div className='flex flex-col items-center justify-center py-16'>
          <Icons.page className='text-muted-foreground/40 mb-3 h-10 w-10' />
          <p className='text-muted-foreground text-sm'>{filteredEmptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid='announcements-infinite-list'>
      <div className='flex flex-col'>
        {announcements.map((announcement) => (
          <AnnouncementListRow
            key={announcement.id}
            announcement={announcement}
            onClick={onRowClick}
            isAdmin={isAdmin}
            onEdit={onEdit}
            onDeleted={onDeleted}
          />
        ))}
      </div>
      <div ref={loadMoreRef} className='flex justify-center py-4'>
        {isFetchingNextPage ? <PageLoadingSpinner variant='compact' /> : null}
      </div>
    </div>
  );
}

export { ANNOUNCEMENTS_PAGE_SIZE };
