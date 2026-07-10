import { apiClient } from '@/lib/api-client';
import type {
  SystemEmailLogDetailResponse,
  SystemEmailLogsFilters,
  SystemEmailLogsListResponse
} from './types';

type SystemEmailLogsApiResponse = {
  success: boolean;
  data: SystemEmailLogsListResponse;
};

type SystemEmailLogDetailApiResponse = {
  success: boolean;
  data: SystemEmailLogDetailResponse;
};

export async function fetchSystemEmailLogs(
  filters: SystemEmailLogsFilters
): Promise<SystemEmailLogsListResponse> {
  const searchParams = new URLSearchParams();

  if (filters.page) searchParams.set('page', String(filters.page));
  if (filters.limit) searchParams.set('limit', String(filters.limit));
  if (filters.sort) searchParams.set('sort', filters.sort);

  const queryString = searchParams.toString();
  const response = await apiClient<SystemEmailLogsApiResponse>(
    `/system-email-logs${queryString ? `?${queryString}` : ''}`
  );

  return response.data;
}

export async function fetchSystemEmailLogDetail(runId: number): Promise<SystemEmailLogDetailResponse> {
  const response = await apiClient<SystemEmailLogDetailApiResponse>(`/system-email-logs/${runId}`);
  return response.data;
}
