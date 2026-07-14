import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { systemEmailLogKeys } from '../api/queries';
import { listSystemEmailLogRuns } from '../api/service.server';
import { SystemEmailLogsTable } from './system-email-logs-table';

export default async function SystemEmailLogListing() {
  const page = searchParamsCache.get('page');
  const pageLimit = searchParamsCache.get('perPage');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page,
    limit: pageLimit,
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery({
    queryKey: systemEmailLogKeys.list(filters),
    queryFn: () => listSystemEmailLogRuns(filters)
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SystemEmailLogsTable />
    </HydrationBoundary>
  );
}
