import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { usersQueryOptions } from '../api/queries';
import { getUsersServer } from '../api/service.server';
import { UsersTable } from './users-table';

export default function UserListingPage() {
  const page = searchParamsCache.get('page');
  const search = searchParamsCache.get('name');
  const pageLimit = searchParamsCache.get('perPage');
  const systemRoles = searchParamsCache.get('system_role');
  const statuses = searchParamsCache.get('status');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page,
    limit: pageLimit,
    ...(search && { search }),
    ...(systemRoles && { systemRoles }),
    ...(statuses && { statuses }),
    ...(sort && { sort }),
    // plan 95 D-2① — 사용자 관리는 동방특송 포함 (users-table/index.tsx 클라이언트 키와 동일해야 hydration 적중)
    includeDongbang: true
  };

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery({
    ...usersQueryOptions(filters),
    queryFn: () => getUsersServer(filters)
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsersTable />
    </HydrationBoundary>
  );
}
