import { queryOptions } from '@tanstack/react-query';
import { fetchSystemEmailLogDetail, fetchSystemEmailLogs } from './service';
import type { SystemEmailLogsFilters } from './types';

export const systemEmailLogKeys = {
  all: ['system-email-logs'] as const,
  list: (filters: SystemEmailLogsFilters) => [...systemEmailLogKeys.all, 'list', filters] as const,
  detail: (runId: number) => [...systemEmailLogKeys.all, 'detail', runId] as const
};

export const systemEmailLogsQueryOptions = (filters: SystemEmailLogsFilters) =>
  queryOptions({
    queryKey: systemEmailLogKeys.list(filters),
    queryFn: () => fetchSystemEmailLogs(filters)
  });

export const systemEmailLogDetailQueryOptions = (runId: number) =>
  queryOptions({
    queryKey: systemEmailLogKeys.detail(runId),
    queryFn: () => fetchSystemEmailLogDetail(runId)
  });
