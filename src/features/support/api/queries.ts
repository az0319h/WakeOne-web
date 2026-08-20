import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import {
  fetchSupportComments,
  fetchSupportRequestById,
  fetchSupportRequests
} from './service';
import { supportKeys } from './keys';
import { SUPPORT_PAGE_SIZE, type SupportFilters } from './types';

export { SUPPORT_PAGE_SIZE, supportKeys };
export type { SupportFilters };

export function supportInfiniteQueryOptions(filters: SupportFilters = {}) {
  const baseFilters = {
    limit: SUPPORT_PAGE_SIZE,
    ...filters
  };

  return infiniteQueryOptions({
    queryKey: supportKeys.list(filters),
    queryFn: ({ pageParam }) =>
      fetchSupportRequests({
        ...baseFilters,
        ...(pageParam ? { cursor: pageParam as string } : {})
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined
  });
}

export function supportDetailQueryOptions(id: number) {
  return queryOptions({
    queryKey: supportKeys.detail(id),
    queryFn: () => fetchSupportRequestById(id)
  });
}

export function supportCommentsQueryOptions(id: number) {
  return queryOptions({
    queryKey: supportKeys.comments(id),
    queryFn: () => fetchSupportComments(id)
  });
}
