'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { motion, useReducedMotion } from 'motion/react';
import { formatWalletAmount } from '../utils/format';

interface WalletAutoReloadProps {
  enabled: boolean;
  threshold: number;
  reloadAmount: number;
  onEnabledChange: (enabled: boolean) => void;
  onThresholdChange: (threshold: number) => void;
}

export function WalletAutoReload({
  enabled,
  threshold,
  reloadAmount,
  onEnabledChange,
  onThresholdChange
}: WalletAutoReloadProps) {
  const shouldReduceMotion = useReducedMotion();

  function handleThresholdChange(value: string) {
    const parsed = Number(value.replace(/[^\d]/g, ''));

    if (!Number.isFinite(parsed)) {
      return;
    }

    onThresholdChange(parsed);
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4 space-y-0'>
        <div className='space-y-1'>
          <CardTitle className='text-base font-medium'>자동 충전</CardTitle>
          <p className='text-muted-foreground text-sm'>
            잔액이 기준 이하로 떨어지면 자동으로 충전합니다.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label='자동 충전 사용'
        />
      </CardHeader>
      <CardContent className='space-y-4'>
        <motion.div
          initial={false}
          animate={{
            opacity: enabled ? 1 : 0.55,
            height: 'auto'
          }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
          className='space-y-4'
        >
          <div className='space-y-2'>
            <Label htmlFor='wallet-auto-reload-threshold'>충전 기준 잔액</Label>
            <div className='relative'>
              <Input
                id='wallet-auto-reload-threshold'
                inputMode='numeric'
                value={threshold > 0 ? String(threshold) : ''}
                onChange={(event) => handleThresholdChange(event.target.value)}
                disabled={!enabled}
                className='pr-10 tabular-nums'
              />
              <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm'>
                원
              </span>
            </div>
            <p className='text-muted-foreground text-xs'>
              잔액이 {formatWalletAmount(threshold)} 이하가 되면{' '}
              {formatWalletAmount(reloadAmount)}이 자동 충전됩니다.
            </p>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
