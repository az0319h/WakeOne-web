import { apiClient } from '@/lib/api-client';
import type {
  WalletSummary,
  WalletSummaryFilters,
  WalletSyncsFilters,
  WalletSyncsListResponse
} from './types';

type WalletSummaryApiResponse = {
  success: boolean;
  data: WalletSummary;
};

type WalletSyncsApiResponse = {
  success: boolean;
  data: WalletSyncsListResponse;
};

export async function fetchWalletSummary(
  filters: WalletSummaryFilters
): Promise<WalletSummary> {
  const searchParams = new URLSearchParams();
  if (filters.user) {
    searchParams.set('user', filters.user);
  }

  const queryString = searchParams.toString();
  const response = await apiClient<WalletSummaryApiResponse>(
    `/wallet${queryString ? `?${queryString}` : ''}`
  );

  return response.data;
}

export async function fetchWalletSyncs(
  filters: WalletSyncsFilters
): Promise<WalletSyncsListResponse> {
  const searchParams = new URLSearchParams();
  if (filters.user) searchParams.set('user', filters.user);
  if (filters.limit) searchParams.set('limit', String(filters.limit));
  if (filters.cursor) searchParams.set('cursor', filters.cursor);

  const queryString = searchParams.toString();
  const response = await apiClient<WalletSyncsApiResponse>(
    `/wallet/syncs${queryString ? `?${queryString}` : ''}`
  );

  return response.data;
}
