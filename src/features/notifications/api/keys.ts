import type { NotificationsFilters } from './types';

export const NOTIFICATIONS_PAGE_SIZE = 10;

export type NotificationsListFilters = Omit<NotificationsFilters, 'cursor' | 'limit'>;

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters: NotificationsListFilters) =>
    [...notificationKeys.all, 'list', filters] as const
};
