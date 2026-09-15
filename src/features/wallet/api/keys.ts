import type { WalletBalanceEmailPreferencesFilters } from './balance-email.types';
import type { WalletSummaryFilters, WalletSyncsFilters } from './types';

export const WALLET_SYNCS_PAGE_SIZE = 5;

export type WalletSyncsListFilters = Omit<WalletSyncsFilters, 'cursor' | 'limit'>;

/** self · 빈 user 는 동일 query key 로 통일 (SSR prefetch ↔ 클라이언트) */
export function normalizeWalletBalanceEmailPreferencesFilters(
  filters: WalletBalanceEmailPreferencesFilters = {}
): WalletBalanceEmailPreferencesFilters {
  if (!filters.user || filters.user === 'self') {
    return {};
  }

  return { user: filters.user };
}

export const walletKeys = {
  all: ['wallet'] as const,
  summary: (filters: WalletSummaryFilters) => [...walletKeys.all, 'summary', filters] as const,
  syncs: (filters: WalletSyncsListFilters) => [...walletKeys.all, 'syncs', filters] as const,
  balanceEmailPreferences: (filters: WalletBalanceEmailPreferencesFilters = {}) =>
    [
      ...walletKeys.all,
      'balance-email-preferences',
      normalizeWalletBalanceEmailPreferencesFilters(filters)
    ] as const
};
