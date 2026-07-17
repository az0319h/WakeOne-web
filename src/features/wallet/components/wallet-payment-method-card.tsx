'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, useReducedMotion } from 'motion/react';
import type { WalletPaymentMethod } from '../data/mock-data';

interface WalletPaymentMethodCardProps {
  paymentMethod: WalletPaymentMethod;
}

export function WalletPaymentMethodCard({ paymentMethod }: WalletPaymentMethodCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div className='space-y-1'>
          <CardTitle className='text-base font-medium'>결제 수단</CardTitle>
          <p className='text-muted-foreground text-sm'>연결된 기본 결제 수단입니다.</p>
        </div>
        {paymentMethod.isDefault ? <Badge variant='secondary'>기본</Badge> : null}
      </CardHeader>
      <CardContent className='space-y-4'>
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className='bg-muted/50 flex items-center gap-4 rounded-xl border p-4'
        >
          <div className='bg-background text-foreground flex size-11 items-center justify-center rounded-lg border shadow-xs'>
            <Icons.creditCard className='size-5' />
          </div>
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-medium'>
              {paymentMethod.brand} •••• {paymentMethod.last4}
            </p>
            <p className='text-muted-foreground text-xs'>
              만료 {String(paymentMethod.expiryMonth).padStart(2, '0')}/
              {paymentMethod.expiryYear}
            </p>
          </div>
        </motion.div>
        <Button type='button' variant='outline' className='w-full' disabled>
          결제 수단 변경 (데모)
        </Button>
      </CardContent>
    </Card>
  );
}
