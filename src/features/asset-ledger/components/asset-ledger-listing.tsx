import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { assetItemsQueryOptions } from '../api/queries';
import { AssetLedgerClientPage } from './asset-ledger-page-client';
import { assetLedgerUsersQueryOptions } from '../api/user-queries';
import type { AssetItemsFilters } from '../api/types';
import {
  listAssetItems as listAssetItemsServer,
  listAssetLedgerUsageLocations,
  listAssetLedgerUsers as listAssetLedgerUsersServer
} from '../api/service.server';

interface AssetLedgerListingProps {
  currentUserId?: string;
  isAdmin: boolean;
  filters: AssetItemsFilters;
}

export function AssetLedgerListing({ currentUserId, isAdmin, filters }: AssetLedgerListingProps) {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery({
    ...assetItemsQueryOptions(filters),
    queryFn: async () => {
      const result = await listAssetItemsServer(filters);
      return {
        success: true,
        message: '비품 목록을 불러왔습니다.',
        ...result
      };
    }
  });
  void queryClient.prefetchQuery({
    ...assetItemsQueryOptions({ page: 1, limit: 1 }),
    queryFn: async () => {
      const result = await listAssetItemsServer({ page: 1, limit: 1 });
      return {
        success: true,
        message: '비품 목록을 불러왔습니다.',
        ...result
      };
    }
  });
  void queryClient.prefetchQuery({
    ...assetLedgerUsersQueryOptions(''),
    queryFn: async () => {
      const [users, usageLocations] = await Promise.all([
        listAssetLedgerUsersServer(),
        listAssetLedgerUsageLocations()
      ]);
      return {
        success: true,
        message: '실사용자 목록을 불러왔습니다.',
        users,
        usageLocations
      };
    }
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AssetLedgerClientPage currentUserId={currentUserId} isAdmin={isAdmin} />
    </HydrationBoundary>
  );
}
