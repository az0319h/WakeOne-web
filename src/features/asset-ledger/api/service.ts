import { apiClientWithMessage } from '@/lib/api-client';
import type {
  AssetItem,
  AssetItemCreatePayload,
  AssetItemDetailResponse,
  AssetItemUpdatePayload,
  AssetItemsFilters,
  AssetItemsListResponse,
  AssetSuggestNumberResponse
} from './types';

function buildAssetItemsQuery(filters: AssetItemsFilters): string {
  const params = new URLSearchParams();
  if (filters.page) {
    params.set('page', String(filters.page));
  }
  if (filters.limit) {
    params.set('limit', String(filters.limit));
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.category) {
    params.set('category', filters.category);
  }
  if (filters.sort) {
    params.set('sort', filters.sort);
  }
  const query = params.toString();
  return query ? `/asset-items?${query}` : '/asset-items';
}

export async function listAssetItems(filters: AssetItemsFilters): Promise<AssetItemsListResponse> {
  return apiClientWithMessage<AssetItemsListResponse>(buildAssetItemsQuery(filters));
}

export async function getAssetItemById(id: number): Promise<AssetItem> {
  const response = await apiClientWithMessage<AssetItemDetailResponse>(`/asset-items/${id}`);
  return response.item;
}

export async function createAssetItem(payload: AssetItemCreatePayload) {
  return apiClientWithMessage<{ success: boolean; message: string; item: AssetItem }>('/asset-items', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAssetItem(id: number, payload: AssetItemUpdatePayload) {
  return apiClientWithMessage<{ success: boolean; message: string; item: AssetItem }>(`/asset-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAssetItem(id: number) {
  return apiClientWithMessage<{ success: boolean; message: string; item: { id: number; asset_number: string; asset_name: string } }>(
    `/asset-items/${id}`,
    {
      method: 'DELETE'
    }
  );
}

export async function suggestAssetNumber(assetName: string): Promise<AssetSuggestNumberResponse> {
  const query = new URLSearchParams({ asset_name: assetName }).toString();
  return apiClientWithMessage<AssetSuggestNumberResponse>(`/asset-items/suggest-number?${query}`);
}
