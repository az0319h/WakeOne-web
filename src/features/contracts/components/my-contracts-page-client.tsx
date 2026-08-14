'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { myContractByIdQueryOptions } from '../api/queries';
import type { ContractDocument } from '../api/types';
import { MyContractDetailSheet } from './my-contract-detail-sheet';
import { MyContractsTable } from './my-contracts-table';

export function MyContractsPageClient() {
  const queryClient = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractDocument | null>(null);

  const handleView = useCallback(
    (contract: ContractDocument) => {
      setSelectedContract(contract);
      setDetailOpen(true);
      void queryClient.prefetchQuery(myContractByIdQueryOptions(contract.id));
    },
    [queryClient]
  );

  return (
    <>
      <div className='flex flex-1 flex-col'>
        <MyContractsTable onView={handleView} />
      </div>
      <MyContractDetailSheet
        contract={selectedContract}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedContract(null);
          }
        }}
      />
    </>
  );
}
