import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { fetchWalletBalanceEmailLogDetail, fetchWalletBalanceEmailLogs } from './service';
import type { WalletBalanceEmailLogsFilters } from './types';

export const walletBalanceEmailLogKeys = {
  all: ['wallet-balance-email-logs'] as const,
  list: (filters: WalletBalanceEmailLogsFilters) =>
    [...walletBalanceEmailLogKeys.all, 'list', filters] as const,
  detail: (runId: number) => [...walletBalanceEmailLogKeys.all, 'detail', runId] as const
};

export const walletBalanceEmailLogsQueryOptions = (filters: WalletBalanceEmailLogsFilters) =>
  queryOptions({
    queryKey: walletBalanceEmailLogKeys.list(filters),
    queryFn: () => fetchWalletBalanceEmailLogs(filters),
    placeholderData: keepPreviousData
  });

export const walletBalanceEmailLogDetailQueryOptions = (runId: number) =>
  queryOptions({
    queryKey: walletBalanceEmailLogKeys.detail(runId),
    queryFn: () => fetchWalletBalanceEmailLogDetail(runId)
  });
