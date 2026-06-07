import { queryOptions } from '@tanstack/react-query';
import { fetchActivityLogs } from './service';
import type { ActivityLog, ActivityLogsFilters } from './types';

export type { ActivityLog };

export const activityLogKeys = {
  all: ['activity-logs'] as const,
  list: (filters: ActivityLogsFilters) => [...activityLogKeys.all, 'list', filters] as const
};

export const activityLogsQueryOptions = (filters: ActivityLogsFilters) =>
  queryOptions({
    queryKey: activityLogKeys.list(filters),
    queryFn: () => fetchActivityLogs(filters)
  });
