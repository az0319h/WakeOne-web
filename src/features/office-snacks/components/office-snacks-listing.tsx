import { Suspense } from 'react';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { listOfficeSnackSessions } from '../api/service.server';
import { officeSnackSessionsQueryOptions } from '../api/queries';
import { OfficeSnacksListClient } from './office-snacks-listing-client';
import { OfficeSnacksListingErrorBoundary } from './office-snacks-listing-error-boundary';
import { OfficeSnacksPageSkeleton } from './office-snacks-skeleton';

export default function OfficeSnacksListing() {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery({
    ...officeSnackSessionsQueryOptions(),
    queryFn: () => listOfficeSnackSessions()
  });

  return (
    <OfficeSnacksListingErrorBoundary>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<OfficeSnacksPageSkeleton />}>
          <OfficeSnacksListClient />
        </Suspense>
      </HydrationBoundary>
    </OfficeSnacksListingErrorBoundary>
  );
}
