import { Suspense } from 'react';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { getQueryClient } from '@/lib/query-client';
import { myContractsQueryOptions } from '../api/queries';
import { listMyContracts as listMyContractsServer } from '../api/service.server';
import { requireMyContractsPage } from '@/features/auth/api/session.server';
import type { ContractFilters } from '../api/types';
import { MyContractsPageClient } from './my-contracts-page-client';

interface MyContractsListingProps {
  filters: ContractFilters;
}

export async function MyContractsListing({ filters }: MyContractsListingProps) {
  const profile = await requireMyContractsPage();
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    ...myContractsQueryOptions(filters),
    queryFn: async () => {
      const result = await listMyContractsServer(profile.full_name ?? '', filters);
      return {
        success: true,
        message: '내 계약서 목록을 불러왔습니다.',
        ...result
      };
    }
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <MyContractsPageClient />
      </Suspense>
    </HydrationBoundary>
  );
}
