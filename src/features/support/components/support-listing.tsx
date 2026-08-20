import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { buildSupportFilters } from '@/features/support/api/filter-utils';
import {
  getSupportRequestById,
  listSupportRequests
} from '@/features/support/api/service.server';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import {
  SUPPORT_PAGE_SIZE,
  supportDetailQueryOptions,
  supportInfiniteQueryOptions
} from '../api/queries';
import { SupportPage } from './support-page';

export default async function SupportListing() {
  const profile = await getSessionProfile();
  const queryClient = getQueryClient();

  if (profile) {
    const isAdmin = profile.system_role === 'admin';
    const listFilters = buildSupportFilters({
      search: searchParamsCache.get('search'),
      status: searchParamsCache.get('support_status'),
      submitted_by: isAdmin ? searchParamsCache.get('support_user') : undefined
    });

    const supportParam = searchParamsCache.get('support');
    const supportId = supportParam ? Number(supportParam) : NaN;
    const hasDeepLink = Number.isFinite(supportId) && supportId > 0;

    const listPrefetch = queryClient.prefetchInfiniteQuery({
      ...supportInfiniteQueryOptions(listFilters),
      queryFn: ({ pageParam }) =>
        listSupportRequests({
          ...listFilters,
          limit: SUPPORT_PAGE_SIZE,
          cursor: pageParam as string | undefined
        })
    });

    const detailPrefetch = hasDeepLink
      ? queryClient
          .prefetchQuery({
            queryKey: supportDetailQueryOptions(supportId).queryKey,
            queryFn: async () => {
              const request = await getSupportRequestById(supportId);
              if (!request) {
                throw new Error('문의를 찾을 수 없습니다.');
              }
              return request;
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
      <SupportPage />
    </HydrationBoundary>
  );
}
