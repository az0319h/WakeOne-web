import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { usersQueryOptions } from '@/features/users/api/queries';
import { getUsersServer } from '@/features/users/api/service.server';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import {
  WALLET_SYNCS_PAGE_SIZE,
  walletSummaryQueryOptions,
  walletSyncsInfiniteQueryOptions
} from '../api/queries';
import type { WalletSummaryFilters, WalletSyncsListFilters } from '../api/types';
import { getWalletSummaryServer, listWalletSyncs } from '../api/service.server';
import { WalletPageContent } from './wallet-page-content';

export async function WalletListing() {
  const profile = await getSessionProfile();
  const isAdmin = profile?.system_role === 'admin';
  const walletUser = isAdmin ? (searchParamsCache.get('wallet_user') ?? 'self') : undefined;

  const summaryFilters: WalletSummaryFilters = isAdmin ? { user: walletUser } : {};
  const syncsFilters: WalletSyncsListFilters = isAdmin ? { user: walletUser } : {};
  const requestedUser = isAdmin ? (walletUser ?? null) : null;

  const queryClient = getQueryClient();

  if (profile) {
    // await: dehydrate 전에 settle 시켜 SSR 에서 클라이언트 queryFn(상대경로 fetch)이 실행되는 것을 방지
    await Promise.all([
      queryClient.prefetchQuery({
        ...walletSummaryQueryOptions(summaryFilters),
        queryFn: () => getWalletSummaryServer(profile.user_id, isAdmin, requestedUser)
      }),
      queryClient.prefetchInfiniteQuery({
        ...walletSyncsInfiniteQueryOptions(syncsFilters),
        queryFn: ({ pageParam }) =>
          listWalletSyncs(profile.user_id, isAdmin, {
            user: walletUser,
            limit: WALLET_SYNCS_PAGE_SIZE,
            ...(pageParam ? { cursor: pageParam as string } : {})
          })
      })
    ]);

    if (isAdmin) {
      void queryClient.prefetchQuery({
        ...usersQueryOptions({ limit: 50 }),
        queryFn: () => getUsersServer({ limit: 50 })
      });
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WalletPageContent isAdmin={isAdmin} />
    </HydrationBoundary>
  );
}
