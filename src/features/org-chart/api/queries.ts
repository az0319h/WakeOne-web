import { queryOptions } from '@tanstack/react-query';
import type { OrgAffiliation } from '@/features/users/constants/organization';
import { fetchOrgChart } from './service';

export const orgChartKeys = {
  all: ['org-chart'] as const,
  detail: (affiliation: OrgAffiliation) =>
    [...orgChartKeys.all, 'detail', affiliation] as const
};

export const orgChartQueryOptions = (affiliation: OrgAffiliation) =>
  queryOptions({
    queryKey: orgChartKeys.detail(affiliation),
    queryFn: () => fetchOrgChart(affiliation)
  });
