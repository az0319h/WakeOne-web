'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'motion/react';
import type { WalletTransaction, WalletTransactionType } from '../data/mock-data';
import { formatSignedWalletAmount, formatWalletAmount, formatWalletDate } from '../utils/format';

interface WalletTransactionListProps {
  transactions: WalletTransaction[];
}

const TRANSACTION_TYPE_LABELS: Record<WalletTransactionType, string> = {
  deposit: '충전',
  withdrawal: '출금',
  payment: '결제',
  refund: '환불'
};

const TRANSACTION_TYPE_VARIANTS: Record<
  WalletTransactionType,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  deposit: 'default',
  withdrawal: 'secondary',
  payment: 'outline',
  refund: 'secondary'
};

function TransactionTypeIcon({ type }: { type: WalletTransactionType }) {
  const className = 'size-4 shrink-0';

  switch (type) {
    case 'deposit':
      return <Icons.trendingUp className={className} />;
    case 'withdrawal':
      return <Icons.trendingDown className={className} />;
    case 'payment':
      return <Icons.creditCard className={className} />;
    case 'refund':
      return <Icons.arrowRight className={className} />;
    default:
      return <Icons.circle className={className} />;
  }
}

export function WalletTransactionList({ transactions }: WalletTransactionListProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Card className='flex flex-1 flex-col'>
      <CardHeader>
        <CardTitle className='text-base font-medium'>거래 내역</CardTitle>
        <p className='text-muted-foreground text-sm'>최근 거래와 잔액 변동을 확인합니다.</p>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col'>
        {transactions.length === 0 ? (
          <div className='text-muted-foreground flex flex-1 items-center justify-center py-10 text-sm'>
            거래 내역이 없습니다.
          </div>
        ) : (
          <ul className='divide-border divide-y'>
            {transactions.map((transaction, index) => (
              <motion.li
                key={transaction.id}
                initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.22,
                  ease: 'easeOut',
                  delay: shouldReduceMotion ? 0 : index * 0.04
                }}
                className='flex items-start gap-3 py-3 first:pt-0 last:pb-0'
              >
                <div className='bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg'>
                  <TransactionTypeIcon type={transaction.type} />
                </div>
                <div className='min-w-0 flex-1 space-y-1'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0 space-y-1'>
                      <p className='truncate text-sm font-medium'>{transaction.description}</p>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Badge variant={TRANSACTION_TYPE_VARIANTS[transaction.type]}>
                          {TRANSACTION_TYPE_LABELS[transaction.type]}
                        </Badge>
                        <span className='text-muted-foreground text-xs'>
                          {formatWalletDate(transaction.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className='shrink-0 text-right'>
                      <p
                        className={cn(
                          'text-sm font-medium tabular-nums',
                          transaction.amount > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-foreground'
                        )}
                      >
                        {formatSignedWalletAmount(transaction.amount)}
                      </p>
                      <p className='text-muted-foreground text-xs tabular-nums'>
                        잔액 {formatWalletAmount(transaction.balance)}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
