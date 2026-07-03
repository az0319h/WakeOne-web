import { Suspense } from 'react';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
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
      <Suspense
        fallback={
          <DataTableSkeleton columnCount={8} rowCount={10} filterCount={3} />
        }
      >
        <ContractsPageClient />
      </Suspense>
    </HydrationBoundary>
  );
}
