import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { listNotifications } from '@/features/notifications/api/service.server';
import { usersQueryOptions } from '@/features/users/api/queries';
import { getUsersServer } from '@/features/users/api/service.server';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import {
  NOTIFICATIONS_PAGE_SIZE,
  notificationsInfiniteQueryOptions
} from '../api/queries';
import { NotificationsPage } from './notifications-page';

export default async function NotificationsListing() {
  const profile = await getSessionProfile();
  const isAdmin = profile?.system_role === 'admin';
  const notifUser = isAdmin ? (searchParamsCache.get('notif_user') ?? 'self') : undefined;

  const filters = {
    ...(isAdmin && { notif_user: notifUser })
  };

  const queryClient = getQueryClient();

  if (profile) {
    void queryClient.prefetchInfiniteQuery({
      ...notificationsInfiniteQueryOptions(filters),
      queryFn: ({ pageParam }) =>
        listNotifications(profile.user_id, isAdmin, {
          limit: NOTIFICATIONS_PAGE_SIZE,
          cursor: pageParam,
          notif_user: notifUser
        })
    });

    if (isAdmin) {
      void queryClient.prefetchQuery({
        ...usersQueryOptions({ limit: 50 }),
        queryFn: () => getUsersServer({ limit: 50 })
      });
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NotificationsPage />
    </HydrationBoundary>
  );
}
