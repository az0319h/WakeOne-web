'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { contractByIdQueryOptions } from '../api/queries';
import type { ContractDocument } from '../api/types';
import { ContractDetailSheet } from './contract-detail-sheet';
import { ContractEditSheet } from './contract-edit-sheet';
import { ContractsTable } from './contracts-table';

export function ContractsPageClient() {
  const queryClient = useQueryClient();
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractDocument | null>(null);
  const [editingContract, setEditingContract] = useState<ContractDocument | null>(null);

  const handleView = useCallback(
    (contract: ContractDocument) => {
      setSelectedContract(contract);
      setDetailOpen(true);
      void queryClient.prefetchQuery(contractByIdQueryOptions(contract.id));
    },
    [queryClient]
  );

  const handleEdit = useCallback((contract: ContractDocument) => {
    setEditingContract(contract);
    setEditOpen(true);
  }, []);

  return (
    <>
      <div className='flex flex-1 flex-col'>
        <ContractsTable onView={handleView} onEdit={handleEdit} />
      </div>
      <ContractDetailSheet
        contract={selectedContract}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedContract(null);
          }
        }}
        onEdit={(contract) => {
          setDetailOpen(false);
          handleEdit(contract);
        }}
      />
      <ContractEditSheet
        contract={editingContract}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditingContract(null);
          }
        }}
      />
    </>
  );
}
