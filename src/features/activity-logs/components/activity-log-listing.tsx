import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { listActivityLogs } from '@/features/activity-logs/api/service.server';
import { usersQueryOptions } from '@/features/users/api/queries';
import { getUsersServer } from '@/features/users/api/service.server';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { activityLogsQueryOptions } from '../api/queries';
import { ActivityLogsTable } from './activity-logs-table';

export default async function ActivityLogListing() {
  const profile = await getSessionProfile();
  const isAdmin = profile?.system_role === 'admin';

  const page = searchParamsCache.get('page');
  const pageLimit = searchParamsCache.get('perPage');
  const sort = searchParamsCache.get('sort');
  const logUser = isAdmin ? (searchParamsCache.get('log_user') ?? 'self') : undefined;
  const action = searchParamsCache.get('action');
  const search = searchParamsCache.get('search');

  const filters = {
    page,
    limit: pageLimit,
    ...(sort && { sort }),
    ...(isAdmin && { log_user: logUser }),
    ...(isAdmin && action && { action }),
    ...(isAdmin && search && { search })
  };

  const queryClient = getQueryClient();

  if (profile) {
    void queryClient.prefetchQuery({
      ...activityLogsQueryOptions(filters),
      queryFn: () => listActivityLogs(profile.user_id, isAdmin, filters)
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
      <ActivityLogsTable />
    </HydrationBoundary>
  );
}
