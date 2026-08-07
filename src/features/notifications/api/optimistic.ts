import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { notificationKeys } from './keys';
import type { NotificationsListResponse } from './types';

export type NotificationInfiniteData = InfiniteData<
  NotificationsListResponse,
  string | undefined
>;

export type NotificationQueriesSnapshot = Array<
  [QueryKey, NotificationInfiniteData | undefined]
>;

export function snapshotNotificationQueries(
  queryClient: QueryClient
): NotificationQueriesSnapshot {
  return queryClient.getQueriesData<NotificationInfiniteData>({
    queryKey: notificationKeys.all
  });
}

export function restoreNotificationQueries(
  queryClient: QueryClient,
  snapshot: NotificationQueriesSnapshot
): void {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data);
  }
}

function patchNotificationReadPage(
  data: NotificationInfiniteData | undefined,
  id: number
): NotificationInfiniteData | undefined {
  if (!data) return data;

  const readAt = new Date().toISOString();

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      notifications: page.notifications.map((notification) =>
        notification.id === id
          ? { ...notification, status: 'read' as const, read_at: readAt }
          : notification
      )
    }))
  };
}

function patchAllNotificationsReadPage(
  data: NotificationInfiniteData | undefined
): NotificationInfiniteData | undefined {
  if (!data) return data;

  const readAt = new Date().toISOString();

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      notifications: page.notifications.map((notification) =>
        notification.status === 'unread'
          ? { ...notification, status: 'read' as const, read_at: readAt }
          : notification
      )
    }))
  };
}

export function applyMarkNotificationReadOptimistic(
  queryClient: QueryClient,
  id: number
): void {
  queryClient.setQueriesData<NotificationInfiniteData>(
    { queryKey: notificationKeys.all },
    (old) => patchNotificationReadPage(old, id)
  );
}

export function applyMarkAllNotificationsReadOptimistic(queryClient: QueryClient): void {
  queryClient.setQueriesData<NotificationInfiniteData>(
    { queryKey: notificationKeys.all },
    (old) => patchAllNotificationsReadPage(old)
  );
}
