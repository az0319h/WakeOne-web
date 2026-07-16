import { Suspense } from 'react';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { getQueryClient } from '@/lib/query-client';
import { contractsQueryOptions } from '../api/queries';
import { listContracts as listContractsServer } from '../api/service.server';
import type { ContractFilters } from '../api/types';
import { ContractsPageClient } from './contracts-page-client';

interface ContractListingProps {
  filters: ContractFilters;
}

export async function ContractListing({ filters }: ContractListingProps) {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    ...contractsQueryOptions(filters),
    queryFn: async () => {
      const result = await listContractsServer(filters);
      return {
        success: true,
        message: '계약서 목록을 불러왔습니다.',
        ...result
      };
    }
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <ContractsPageClient />
      </Suspense>
    </HydrationBoundary>
  );
}
