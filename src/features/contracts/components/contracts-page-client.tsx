'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { contractByIdQueryOptions, contractKeys } from '../api/queries';
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
      queryClient.setQueryData(contractKeys.detail(contract.id), contract);
      void queryClient.prefetchQuery(contractByIdQueryOptions(contract.id));
      setSelectedContract(contract);
      setDetailOpen(true);
    },
    [queryClient]
  );

  const handleEdit = useCallback((contract: ContractDocument) => {
    setEditingContract(contract);
    setEditOpen(true);
  }, []);

  return (
    <>
      <Card className='mb-4'>
        <CardContent className='flex flex-col gap-3 p-4 md:flex-row md:items-start'>
          <div className='bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full'>
            <Icons.info className='h-5 w-5' />
          </div>
          <div className='space-y-1'>
            <p className='text-sm font-medium'>
              Flex 계약서 체결 요청은 OpenClaw/Gmail 수집을 통해 자동 생성됩니다.
            </p>
            <p className='text-muted-foreground text-sm'>
              WakeOne은 Gmail/Flex에 직접 접근하지 않고, OpenClaw가 service token으로 Import API를 호출합니다.
              최근 수집 및 CUD 이력은 활동 로그에서 contract action으로 필터링해 확인하세요.
            </p>
          </div>
        </CardContent>
      </Card>

      <ContractsTable onView={handleView} onEdit={handleEdit} />
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
