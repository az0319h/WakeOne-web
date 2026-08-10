import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import {
  fetchAnnouncementById,
  fetchAnnouncements,
  fetchAnnouncementsOverview
} from './service';
import { announcementKeys } from './keys';
import { ANNOUNCEMENTS_PAGE_SIZE, type AnnouncementsFilters } from './types';

export { ANNOUNCEMENTS_PAGE_SIZE, announcementKeys };
export type { AnnouncementsFilters };

export function announcementsInfiniteQueryOptions(filters: AnnouncementsFilters = {}) {
  const baseFilters = {
    limit: ANNOUNCEMENTS_PAGE_SIZE,
    ...filters
  };

  return infiniteQueryOptions({
    queryKey: announcementKeys.list(filters),
    queryFn: ({ pageParam }) =>
      fetchAnnouncements({
        ...baseFilters,
        ...(pageParam ? { cursor: pageParam as string } : {})
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined
  });
}

export function announcementsOverviewQueryOptions() {
  return queryOptions({
    queryKey: announcementKeys.overview(),
    queryFn: () => fetchAnnouncementsOverview()
  });
}

export function announcementDetailQueryOptions(id: number) {
  return queryOptions({
    queryKey: announcementKeys.detail(id),
    queryFn: () => fetchAnnouncementById(id)
  });
}
