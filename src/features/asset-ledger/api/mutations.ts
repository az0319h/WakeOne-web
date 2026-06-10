import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { createAssetItem, deleteAssetItem, updateAssetItem } from './service';
import { assetItemKeys } from './queries';
import type { AssetItemCreatePayload, AssetItemUpdatePayload } from './types';

export const createAssetItemMutation = mutationOptions({
  mutationFn: (payload: AssetItemCreatePayload) => createAssetItem(payload),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: assetItemKeys.all });
  }
});

export const updateAssetItemMutation = mutationOptions({
  mutationFn: ({ id, payload }: { id: number; payload: AssetItemUpdatePayload }) =>
    updateAssetItem(id, payload),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: assetItemKeys.all });
  }
});

export const deleteAssetItemMutation = mutationOptions({
  mutationFn: (id: number) => deleteAssetItem(id),
  onSettled: () => {
    getQueryClient().invalidateQueries({ queryKey: assetItemKeys.all });
  }
});
