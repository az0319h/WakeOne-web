import { queryOptions } from '@tanstack/react-query';
import type { Affiliation } from '@/features/users/constants/organization';
import { fetchOrgChart } from './service';

export const orgChartKeys = {
  all: ['org-chart'] as const,
  detail: (affiliation: Affiliation) =>
    [...orgChartKeys.all, 'detail', affiliation] as const
};

export const orgChartQueryOptions = (affiliation: Affiliation) =>
  queryOptions({
    queryKey: orgChartKeys.detail(affiliation),
    queryFn: () => fetchOrgChart(affiliation)
  });
