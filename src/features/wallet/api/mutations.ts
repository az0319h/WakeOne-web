import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import type { UpdateWalletBalanceEmailPreferencesInput } from './balance-email.types';
import { normalizeWalletBalanceEmailPreferencesFilters, walletKeys } from './keys';
import { updateWalletBalanceEmailPreferences } from './service';

function invalidateWalletQueries() {
  getQueryClient().invalidateQueries({ queryKey: walletKeys.all });
}

export const updateWalletBalanceEmailPreferencesMutation = mutationOptions({
  mutationFn: (input: UpdateWalletBalanceEmailPreferencesInput) =>
    updateWalletBalanceEmailPreferences(input),
  onSuccess: (data, variables) => {
    const filters = normalizeWalletBalanceEmailPreferencesFilters(
      variables.user ? { user: variables.user } : {}
    );
    getQueryClient().setQueryData(walletKeys.balanceEmailPreferences(filters), data);
  },
  onSettled: () => {
    invalidateWalletQueries();
  }
});
