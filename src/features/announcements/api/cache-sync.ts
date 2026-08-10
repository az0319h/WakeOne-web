import type { InfiniteData } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { announcementKeys } from './keys';
import type {
  Announcement,
  AnnouncementListItem,
  AnnouncementsListResponse
} from './types';

function toListItem(announcement: Announcement): AnnouncementListItem {
  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    priority: announcement.priority,
    is_pinned: announcement.is_pinned,
    created_at: announcement.created_at,
    updated_at: announcement.updated_at
  };
}

export function syncAnnouncementInCache(announcement: Announcement) {
  const qc = getQueryClient();

  qc.setQueryData(announcementKeys.detail(announcement.id), announcement);

  qc.setQueriesData<InfiniteData<AnnouncementsListResponse>>(
    {
      queryKey: announcementKeys.all,
      predicate: (query) =>
        query.queryKey.length >= 2 && query.queryKey[1] === 'list'
    },
    (old) => {
      if (!old?.pages) {
        return old;
      }

      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          announcements: page.announcements.map((item) =>
            item.id === announcement.id ? toListItem(announcement) : item
          )
        }))
      };
    }
  );

  qc.setQueryData<AnnouncementListItem[]>(announcementKeys.overview(), (old) => {
    if (!old) {
      return old;
    }

    return old.map((item) =>
      item.id === announcement.id ? toListItem(announcement) : item
    );
  });
}
