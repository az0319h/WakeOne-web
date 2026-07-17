import { apiClient, apiClientWithMessage } from '@/lib/api-client';
import type { NotificationsFilters, NotificationsListResponse } from './types';

type NotificationsApiResponse = {
  success: boolean;
  data: NotificationsListResponse;
};

export async function fetchNotifications(
  filters: NotificationsFilters
): Promise<NotificationsListResponse> {
  const searchParams = new URLSearchParams();

  if (filters.limit) searchParams.set('limit', String(filters.limit));
  if (filters.cursor) searchParams.set('cursor', filters.cursor);
  if (filters.notif_user) searchParams.set('notif_user', filters.notif_user);

  const queryString = searchParams.toString();
  const response = await apiClient<NotificationsApiResponse>(
    `/notifications${queryString ? `?${queryString}` : ''}`
  );

  return response.data;
}

export async function markNotificationRead(id: number) {
  return apiClientWithMessage<{ success: boolean }>(`/notifications/${id}/read`, {
    method: 'PATCH'
  });
}

export async function markAllNotificationsRead() {
  return apiClientWithMessage<{ success: boolean; data: { count: number } }>(
    '/notifications/read-all',
    {
      method: 'PATCH'
    }
  );
}
