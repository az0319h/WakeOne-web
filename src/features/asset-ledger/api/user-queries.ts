import { queryOptions } from '@tanstack/react-query';
import { listAssetLedgerUsers } from './users';

export const assetLedgerUserKeys = {
  all: ['asset-ledger-users'] as const,
  list: (search: string) => [...assetLedgerUserKeys.all, 'list', search] as const
};

export const assetLedgerUsersQueryOptions = (search: string) =>
  queryOptions({
    queryKey: assetLedgerUserKeys.list(search),
    queryFn: () => listAssetLedgerUsers(search)
  });
