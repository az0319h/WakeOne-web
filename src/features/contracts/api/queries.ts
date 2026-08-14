import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { getContractById, getMyContractById, listContracts, listMyContracts } from './service';
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

export const myContractKeys = {
  all: ['my-contracts'] as const,
  list: (filters: ContractFilters) => [...myContractKeys.all, 'list', filters] as const,
  detail: (id: number) => [...myContractKeys.all, 'detail', id] as const
};

export const myContractsQueryOptions = (filters: ContractFilters) =>
  queryOptions({
    queryKey: myContractKeys.list(filters),
    queryFn: () => listMyContracts(filters),
    placeholderData: keepPreviousData
  });

export const myContractByIdQueryOptions = (id: number) =>
  queryOptions({
    queryKey: myContractKeys.detail(id),
    queryFn: () => getMyContractById(id)
  });
