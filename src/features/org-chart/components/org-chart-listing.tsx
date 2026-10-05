import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { AFFILIATIONS, type Affiliation } from '@/features/users/constants/organization';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { getOrgChartResponse } from '../api/service.server';
import { orgChartQueryOptions } from '../api/queries';
import { OrgChartPageContent } from './org-chart-page-content';

function resolveAffiliation(value: string | null | undefined): Affiliation {
  if (value && AFFILIATIONS.includes(value as Affiliation)) {
    return value as Affiliation;
  }
  return 'wake';
}

export async function OrgChartListing() {
  const affiliation = resolveAffiliation(searchParamsCache.get('affiliation'));
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    ...orgChartQueryOptions(affiliation),
    queryFn: () => getOrgChartResponse(affiliation)
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrgChartPageContent />
    </HydrationBoundary>
  );
}
