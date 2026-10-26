import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { ORG_AFFILIATIONS, type OrgAffiliation } from '@/features/users/constants/organization';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { getOrgChartResponse } from '../api/service.server';
import { orgChartQueryOptions } from '../api/queries';
import { OrgChartPageContent } from './org-chart-page-content';

function resolveAffiliation(value: string | null | undefined): OrgAffiliation {
  if (value && ORG_AFFILIATIONS.includes(value as OrgAffiliation)) {
    return value as OrgAffiliation;
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
    <div className='flex min-h-0 flex-1 flex-col'>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <OrgChartPageContent />
      </HydrationBoundary>
    </div>
  );
}
