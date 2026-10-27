import type { QuickRequestListFilters } from './types';

export const quickRequestKeys = {
  all: ['quick-request'] as const,
  notes: () => [...quickRequestKeys.all, 'notes'] as const,
  recentAddresses: () => [...quickRequestKeys.all, 'recent-addresses'] as const,
  /** plan 89 — 대시보드 카드 숫자 (status·search 무시) */
  summary: () => [...quickRequestKeys.all, 'summary'] as const,
  lists: () => [...quickRequestKeys.all, 'list'] as const,
  list: (filters: QuickRequestListFilters) => [...quickRequestKeys.lists(), filters] as const,
  details: () => [...quickRequestKeys.all, 'detail'] as const,
  detail: (requestNo: string) => [...quickRequestKeys.details(), requestNo] as const
};
