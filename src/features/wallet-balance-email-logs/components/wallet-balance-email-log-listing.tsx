import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { walletBalanceEmailLogKeys } from '../api/queries';
import { listWalletBalanceEmailLogRuns } from '../api/service.server';
import { WalletBalanceEmailLogsTable } from './wallet-balance-email-logs-table';

export default async function WalletBalanceEmailLogListing() {
  const page = searchParamsCache.get('page');
  const pageLimit = searchParamsCache.get('perPage');
  const sort = searchParamsCache.get('sort');
  const search = searchParamsCache.get('search');

  const filters = {
    page,
    limit: pageLimit,
    ...(sort && { sort }),
    ...(search && { search })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery({
    queryKey: walletBalanceEmailLogKeys.list(filters),
    queryFn: () => listWalletBalanceEmailLogRuns(filters)
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WalletBalanceEmailLogsTable />
    </HydrationBoundary>
  );
}
