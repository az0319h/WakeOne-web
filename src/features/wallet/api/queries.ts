import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { fetchWalletSummary, fetchWalletSyncs } from './service';
import {
  WALLET_SYNCS_PAGE_SIZE,
  walletKeys,
  type WalletSyncsListFilters
} from './keys';
import type { WalletSummaryFilters } from './types';

export { WALLET_SYNCS_PAGE_SIZE, walletKeys, type WalletSyncsListFilters };

export const walletSummaryQueryOptions = (filters: WalletSummaryFilters) =>
  queryOptions({
    queryKey: walletKeys.summary(filters),
    queryFn: () => fetchWalletSummary(filters)
  });

export const walletSyncsInfiniteQueryOptions = (filters: WalletSyncsListFilters = {}) => {
  const baseFilters = {
    limit: WALLET_SYNCS_PAGE_SIZE,
    ...filters
  };

  return infiniteQueryOptions({
    queryKey: walletKeys.syncs(filters),
    queryFn: ({ pageParam }) =>
      fetchWalletSyncs({
        ...baseFilters,
        ...(pageParam ? { cursor: pageParam as string } : {})
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined
  });
};
