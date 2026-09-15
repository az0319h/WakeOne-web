import { apiClient } from '@/lib/api-client';
import type {
  WalletBalanceEmailLogDetailResponse,
  WalletBalanceEmailLogsFilters,
  WalletBalanceEmailLogsListResponse
} from './types';

type WalletBalanceEmailLogsApiResponse = {
  success: boolean;
  data: WalletBalanceEmailLogsListResponse;
};

type WalletBalanceEmailLogDetailApiResponse = {
  success: boolean;
  data: WalletBalanceEmailLogDetailResponse;
};

export async function fetchWalletBalanceEmailLogs(
  filters: WalletBalanceEmailLogsFilters
): Promise<WalletBalanceEmailLogsListResponse> {
  const searchParams = new URLSearchParams();

  if (filters.page) searchParams.set('page', String(filters.page));
  if (filters.limit) searchParams.set('limit', String(filters.limit));
  if (filters.sort) searchParams.set('sort', filters.sort);
  if (filters.search) searchParams.set('search', filters.search);

  const queryString = searchParams.toString();
  const response = await apiClient<WalletBalanceEmailLogsApiResponse>(
    `/wallet/balance-email/logs${queryString ? `?${queryString}` : ''}`
  );

  return response.data;
}

export async function fetchWalletBalanceEmailLogDetail(
  runId: number
): Promise<WalletBalanceEmailLogDetailResponse> {
  const response = await apiClient<WalletBalanceEmailLogDetailApiResponse>(
    `/wallet/balance-email/logs/${runId}`
  );

  return response.data;
}
