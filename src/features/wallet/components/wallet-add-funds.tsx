'use client';

import { useState } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'motion/react';
import { WALLET_PRESET_AMOUNTS } from '../data/mock-data';
import { formatWalletAmount } from '../utils/format';

interface WalletAddFundsProps {
  onAddFunds: (amount: number) => void;
  isPending?: boolean;
}

export function WalletAddFunds({ onAddFunds, isPending = false }: WalletAddFundsProps) {
  const shouldReduceMotion = useReducedMotion();
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  const parsedCustomAmount = Number(customAmount.replace(/[^\d]/g, ''));
  const activeAmount =
    selectedPreset ?? (Number.isFinite(parsedCustomAmount) && parsedCustomAmount > 0
      ? parsedCustomAmount
      : null);

  function handlePresetSelect(amount: number) {
    setSelectedPreset(amount);
    setCustomAmount('');
  }

  function handleCustomChange(value: string) {
    setCustomAmount(value.replace(/[^\d]/g, ''));
    setSelectedPreset(null);
  }

  function handleSubmit() {
    if (!activeAmount || activeAmount <= 0) {
      return;
    }

    onAddFunds(activeAmount);
    notifySuccess(`${formatWalletAmount(activeAmount)}이 충전되었습니다.`);
    setSelectedPreset(null);
    setCustomAmount('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base font-medium'>잔액 충전</CardTitle>
        <p className='text-muted-foreground text-sm'>빠른 금액을 선택하거나 직접 입력하세요.</p>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-2 gap-2'>
          {WALLET_PRESET_AMOUNTS.map((amount, index) => {
            const isSelected = selectedPreset === amount;

            return (
              <motion.div
                key={amount}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: shouldReduceMotion ? 0 : index * 0.05
                }}
              >
                <Button
                  type='button'
                  variant={isSelected ? 'default' : 'outline'}
                  className={cn('h-auto w-full py-3 tabular-nums')}
                  onClick={() => handlePresetSelect(amount)}
                  disabled={isPending}
                >
                  {formatWalletAmount(amount)}
                </Button>
              </motion.div>
            );
          })}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='wallet-custom-amount'>직접 입력</Label>
          <div className='relative'>
            <Input
              id='wallet-custom-amount'
              inputMode='numeric'
              placeholder='금액 입력 (원)'
              value={customAmount}
              onChange={(event) => handleCustomChange(event.target.value)}
              disabled={isPending}
              className='pr-10 tabular-nums'
            />
            <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm'>
              원
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          type='button'
          className='w-full'
          onClick={handleSubmit}
          disabled={!activeAmount || activeAmount <= 0 || isPending}
          isLoading={isPending}
        >
          <Icons.plusCircle className='size-4' />
          {activeAmount ? `${formatWalletAmount(activeAmount)} 충전` : '충전하기'}
        </Button>
      </CardFooter>
    </Card>
  );
}
