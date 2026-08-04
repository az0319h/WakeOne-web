'use client';

import { Suspense, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { walletSummaryQueryOptions, type WalletSyncsListFilters } from '../api/queries';
import type { WalletSummaryFilters } from '../api/types';
import { WalletLimitCard } from './wallet-limit-card';
import { WalletSyncLog } from './wallet-sync-log';
import { WalletUserCombobox } from './wallet-user-combobox';

interface WalletPageContentProps {
  isAdmin: boolean;
}

interface WalletDataProps {
  summaryFilters: WalletSummaryFilters;
  syncsFilters: WalletSyncsListFilters;
  amountHidden: boolean;
  onToggleHidden: () => void;
}

function WalletData({ summaryFilters, syncsFilters, amountHidden, onToggleHidden }: WalletDataProps) {
  const { data } = useSuspenseQuery(walletSummaryQueryOptions(summaryFilters));

  return (
    <>
      <WalletLimitCard
        snapshot={data.snapshot}
        hidden={amountHidden}
        onToggleHidden={onToggleHidden}
      />
      <WalletSyncLog filters={syncsFilters} />
    </>
  );
}

export function WalletPageContent({ isAdmin }: WalletPageContentProps) {
  const [amountHidden, setAmountHidden] = useState(false);
  const [{ wallet_user: walletUser }, setParams] = useQueryStates(
    { wallet_user: parseAsString.withDefault('self') },
    { shallow: true }
  );

  const summaryFilters: WalletSummaryFilters = isAdmin ? { user: walletUser } : {};
  const syncsFilters: WalletSyncsListFilters = isAdmin ? { user: walletUser } : {};
  const suspenseKey = isAdmin ? walletUser : 'self';

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6'>
      {isAdmin ? (
        <div className='flex justify-end'>
          <WalletUserCombobox
            value={walletUser}
            onValueChange={(value) => setParams({ wallet_user: value })}
          />
        </div>
      ) : null}

      <Suspense key={suspenseKey} fallback={<PageLoadingSpinner variant='fill' />}>
        <WalletData
          summaryFilters={summaryFilters}
          syncsFilters={syncsFilters}
          amountHidden={amountHidden}
          onToggleHidden={() => setAmountHidden((current) => !current)}
        />
      </Suspense>
    </div>
  );
}
