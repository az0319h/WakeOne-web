'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  MOCK_AUTO_RELOAD,
  MOCK_INITIAL_BALANCE,
  MOCK_PAYMENT_METHOD,
  MOCK_TRANSACTIONS,
  type WalletTransaction
} from '../data/mock-data';
import { WalletAddFunds } from './wallet-add-funds';
import { WalletAutoReload } from './wallet-auto-reload';
import { WalletBalanceCard } from './wallet-balance-card';
import { WalletPaymentMethodCard } from './wallet-payment-method-card';
import { WalletTransactionList } from './wallet-transaction-list';

function createDepositTransaction(amount: number, balance: number): WalletTransaction {
  return {
    id: `tx-${crypto.randomUUID()}`,
    type: 'deposit',
    description: '지갑 충전',
    amount,
    balance,
    createdAt: new Date().toISOString()
  };
}

export function WalletPageContent() {
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [balance, setBalance] = useState(MOCK_INITIAL_BALANCE);
  const [transactions, setTransactions] = useState(MOCK_TRANSACTIONS);
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(MOCK_AUTO_RELOAD.enabled);
  const [autoReloadThreshold, setAutoReloadThreshold] = useState(MOCK_AUTO_RELOAD.threshold);
  const [isPending, startTransition] = useTransition();

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [transactions]
  );

  function handleAddFunds(amount: number) {
    startTransition(() => {
      setBalance((currentBalance) => {
        const nextBalance = currentBalance + amount;

        setTransactions((currentTransactions) => [
          createDepositTransaction(amount, nextBalance),
          ...currentTransactions
        ]);

        return nextBalance;
      });
    });
  }

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6'>
      <div className='grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]'>
        <div className='flex flex-col gap-6'>
          <WalletBalanceCard
            balance={balance}
            hidden={balanceHidden}
            onToggleHidden={() => setBalanceHidden((current) => !current)}
          />
          <WalletTransactionList transactions={sortedTransactions} />
        </div>

        <div className='flex flex-col gap-6'>
          <WalletAddFunds onAddFunds={handleAddFunds} isPending={isPending} />
          <WalletAutoReload
            enabled={autoReloadEnabled}
            threshold={autoReloadThreshold}
            reloadAmount={MOCK_AUTO_RELOAD.reloadAmount}
            onEnabledChange={setAutoReloadEnabled}
            onThresholdChange={setAutoReloadThreshold}
          />
          <WalletPaymentMethodCard paymentMethod={MOCK_PAYMENT_METHOD} />
        </div>
      </div>
    </div>
  );
}
