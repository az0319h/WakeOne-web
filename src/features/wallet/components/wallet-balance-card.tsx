'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'motion/react';
import { formatWalletAmount } from '../utils/format';

interface WalletBalanceCardProps {
  balance: number;
  hidden: boolean;
  onToggleHidden: () => void;
}

export function WalletBalanceCard({
  balance,
  hidden,
  onToggleHidden
}: WalletBalanceCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div className='space-y-1'>
          <CardTitle className='text-base font-medium'>지갑 잔액</CardTitle>
          <p className='text-muted-foreground text-sm'>사용 가능한 크레딧 잔액입니다.</p>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={onToggleHidden}
          aria-label={hidden ? '잔액 표시' : '잔액 숨기기'}
          aria-pressed={hidden}
        >
          {hidden ? (
            <Icons.eyeOff className='size-4' />
          ) : (
            <Icons.eye className='size-4' />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <motion.div
          key={hidden ? 'hidden' : balance}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className='space-y-2'
        >
          <p
            className={cn(
              'text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl',
              hidden && 'select-none blur-md'
            )}
            aria-hidden={hidden}
          >
            {hidden ? '₩••••••' : formatWalletAmount(balance)}
          </p>
          <span className='sr-only'>현재 잔액 {formatWalletAmount(balance)}</span>
          <p className='text-muted-foreground text-sm'>
            {hidden ? '잔액이 숨겨져 있습니다.' : '즉시 결제 및 서비스 이용에 사용할 수 있습니다.'}
          </p>
        </motion.div>
      </CardContent>
    </Card>
  );
}
