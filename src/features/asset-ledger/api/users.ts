import { apiClientWithMessage } from '@/lib/api-client';

export type AssetLedgerUser = {
  id: string;
  name: string;
  email: string;
};

type AssetLedgerUsersResponse = {
  success: boolean;
  message: string;
  users: AssetLedgerUser[];
  usageLocations: string[];
};

export async function listAssetLedgerUsers(search?: string): Promise<AssetLedgerUsersResponse> {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set('search', search.trim());
  }
  const query = params.toString();
  return apiClientWithMessage<AssetLedgerUsersResponse>(`/asset-items/users${query ? `?${query}` : ''}`);
}
