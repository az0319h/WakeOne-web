import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { buildAnnouncementsFilters } from '@/features/announcements/api/filter-utils';
import { listAnnouncements, getAnnouncementById } from '@/features/announcements/api/service.server';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import {
  ANNOUNCEMENTS_PAGE_SIZE,
  announcementDetailQueryOptions,
  announcementsInfiniteQueryOptions
} from '../api/queries';
import { AnnouncementsPage } from './announcements-page';

export default async function AnnouncementsListing() {
  const profile = await getSessionProfile();
  const queryClient = getQueryClient();

  if (profile) {
    const listFilters = buildAnnouncementsFilters({
      search: searchParamsCache.get('search'),
      priority: searchParamsCache.get('priority'),
      pinned: searchParamsCache.get('pinned')
    });

    const announcementParam = searchParamsCache.get('announcement');
    const announcementId = announcementParam ? Number(announcementParam) : NaN;
    const hasDeepLink =
      Number.isFinite(announcementId) && announcementId > 0;

    const listPrefetch = queryClient.prefetchInfiniteQuery({
      ...announcementsInfiniteQueryOptions(listFilters),
      queryFn: ({ pageParam }) =>
        listAnnouncements({
          ...listFilters,
          limit: ANNOUNCEMENTS_PAGE_SIZE,
          cursor: pageParam as string | undefined
        })
    });

    const detailPrefetch = hasDeepLink
      ? queryClient
          .prefetchQuery({
            queryKey: announcementDetailQueryOptions(announcementId).queryKey,
            queryFn: async () => {
              const announcement = await getAnnouncementById(announcementId);
              if (!announcement) {
                throw new Error('공지를 찾을 수 없습니다.');
              }
              return announcement;
            }
          })
          .catch(() => undefined)
      : Promise.resolve();

    if (hasDeepLink) {
      await detailPrefetch;
      void listPrefetch;
    } else {
      await listPrefetch;
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnnouncementsPage />
    </HydrationBoundary>
  );
}
