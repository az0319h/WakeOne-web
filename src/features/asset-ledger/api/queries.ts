import { queryOptions } from '@tanstack/react-query';
import { getAssetItemById, listAssetItems } from './service';
import type { AssetItem, AssetItemsFilters } from './types';

export type { AssetItem };

export const assetItemKeys = {
  all: ['asset-items'] as const,
  list: (filters: AssetItemsFilters) => [...assetItemKeys.all, 'list', filters] as const,
  detail: (id: number) => [...assetItemKeys.all, 'detail', id] as const
};

export const assetItemsQueryOptions = (filters: AssetItemsFilters) =>
  queryOptions({
    queryKey: assetItemKeys.list(filters),
    queryFn: () => listAssetItems(filters)
  });

export const assetItemByIdOptions = (id: number) =>
  queryOptions({
    queryKey: assetItemKeys.detail(id),
    queryFn: () => getAssetItemById(id)
  });
