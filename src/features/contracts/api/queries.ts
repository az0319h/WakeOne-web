import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { getContractById, listContracts } from './service';
import type { ContractDocument, ContractFilters } from './types';

export type { ContractDocument };

export const contractKeys = {
  all: ['contracts'] as const,
  list: (filters: ContractFilters) => [...contractKeys.all, 'list', filters] as const,
  detail: (id: number) => [...contractKeys.all, 'detail', id] as const
};

export const contractsQueryOptions = (filters: ContractFilters) =>
  queryOptions({
    queryKey: contractKeys.list(filters),
    queryFn: () => listContracts(filters),
    placeholderData: keepPreviousData
  });

export const contractByIdQueryOptions = (id: number) =>
  queryOptions({
    queryKey: contractKeys.detail(id),
    queryFn: () => getContractById(id)
  });
