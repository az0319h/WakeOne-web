import type { AnnouncementsFilters } from './types';

export const announcementKeys = {
  all: ['announcements'] as const,
  list: (filters: AnnouncementsFilters = {}) =>
    [...announcementKeys.all, 'list', filters] as const,
  overview: () => [...announcementKeys.all, 'overview'] as const,
  detail: (id: number) => [...announcementKeys.all, 'detail', id] as const
};
