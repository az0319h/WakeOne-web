import { apiClient } from '@/lib/api-client';
import type { ActivityLogsFilters, ActivityLogsListResponse } from './types';

type ActivityLogsApiResponse = {
  success: boolean;
  data: ActivityLogsListResponse;
};

export async function fetchActivityLogs(
  filters: ActivityLogsFilters
): Promise<ActivityLogsListResponse> {
  const searchParams = new URLSearchParams();

  if (filters.page) searchParams.set('page', String(filters.page));
  if (filters.limit) searchParams.set('limit', String(filters.limit));
  if (filters.sort) searchParams.set('sort', filters.sort);
  if (filters.action) searchParams.set('action', filters.action);
  if (filters.actor_search) searchParams.set('actor_search', filters.actor_search);
  if (filters.search) searchParams.set('search', filters.search);

  const queryString = searchParams.toString();
  const response = await apiClient<ActivityLogsApiResponse>(
    `/activity-logs${queryString ? `?${queryString}` : ''}`
  );

  return response.data;
}
