import type { WalletSummaryFilters, WalletSyncsFilters } from './types';

export const WALLET_SYNCS_PAGE_SIZE = 5;

export type WalletSyncsListFilters = Omit<WalletSyncsFilters, 'cursor' | 'limit'>;

export const walletKeys = {
  all: ['wallet'] as const,
  summary: (filters: WalletSummaryFilters) => [...walletKeys.all, 'summary', filters] as const,
  syncs: (filters: WalletSyncsListFilters) => [...walletKeys.all, 'syncs', filters] as const
};
