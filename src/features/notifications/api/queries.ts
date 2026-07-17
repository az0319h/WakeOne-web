import { infiniteQueryOptions } from '@tanstack/react-query';
import { fetchNotifications } from './service';
import {
  NOTIFICATIONS_PAGE_SIZE,
  notificationKeys,
  type NotificationsListFilters
} from './keys';

export { NOTIFICATIONS_PAGE_SIZE, notificationKeys, type NotificationsListFilters };

export function notificationsInfiniteQueryOptions(filters: NotificationsListFilters = {}) {
  const baseFilters = {
    limit: NOTIFICATIONS_PAGE_SIZE,
    ...filters
  };

  return infiniteQueryOptions({
    queryKey: notificationKeys.list(filters),
    queryFn: ({ pageParam }) =>
      fetchNotifications({
        ...baseFilters,
        ...(pageParam ? { cursor: pageParam as string } : {})
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined
  });
}
