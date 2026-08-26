'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'motion/react';
import type { WalletLimitSnapshot } from '../api/types';
import { calculateWalletUsagePercent, formatWalletAmount } from '../utils/format';

interface WalletLimitCardProps {
  snapshot: WalletLimitSnapshot | null;
  hidden: boolean;
  onToggleHidden: () => void;
}

export function WalletLimitCard({ snapshot, hidden, onToggleHidden }: WalletLimitCardProps) {
  const shouldReduceMotion = useReducedMotion();

  if (!snapshot) {
    return (
      <Card>
        <CardHeader className='space-y-1'>
          <CardTitle className='text-base font-medium'>이번 달 식대 잔액</CardTitle>
          <p className='text-muted-foreground text-sm'>
            KB국민 식대 체크카드 기준 · 매일 자동 반영
          </p>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground flex flex-col items-center justify-center gap-2 py-10 text-center text-sm'>
            <Icons.wallet className='size-6 opacity-60' />
            <p>아직 식대 잔액 정보가 없습니다.</p>
            <p className='text-xs'>카드 연동 후 이곳에 표시됩니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const used = Math.max(snapshot.monthly_limit - snapshot.monthly_remaining, 0);
  const usagePercent = calculateWalletUsagePercent(
    snapshot.monthly_limit,
    snapshot.monthly_remaining
  );

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div className='space-y-1'>
          <CardTitle className='text-base font-medium'>이번 달 식대 잔액</CardTitle>
          <p className='text-muted-foreground text-sm'>
            KB국민 식대 체크카드 기준 · 매일 자동 반영
          </p>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={onToggleHidden}
          aria-label={hidden ? '금액 표시' : '금액 숨기기'}
          aria-pressed={hidden}
        >
          {hidden ? <Icons.eyeOff className='size-4' /> : <Icons.eye className='size-4' />}
        </Button>
      </CardHeader>
      <CardContent className='space-y-6'>
        <motion.div
          key={hidden ? 'hidden' : snapshot.monthly_remaining}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'
        >
          <div className='space-y-2'>
            <p className='text-muted-foreground text-sm'>남은 식대</p>
            <p
              className={cn(
                'text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl',
                hidden && 'select-none blur-md'
              )}
              aria-hidden={hidden}
            >
              {hidden ? '₩••••••' : formatWalletAmount(snapshot.monthly_remaining)}
            </p>
            <span className='sr-only'>
              남은 식대 {formatWalletAmount(snapshot.monthly_remaining)}
            </span>
          </div>
          <div className='space-y-1 sm:text-right'>
            <p className='text-muted-foreground text-xs'>이번 달 지급액</p>
            <p
              className={cn(
                'text-lg font-medium tabular-nums',
                hidden && 'select-none blur-sm'
              )}
              aria-hidden={hidden}
            >
              {hidden ? '₩••••••' : formatWalletAmount(snapshot.monthly_limit)}
            </p>
            <p className='text-muted-foreground text-xs tabular-nums'>
              사용한 금액 {hidden ? '••••' : formatWalletAmount(used)} ({usagePercent}%)
            </p>
          </div>
        </motion.div>

        <div className='space-y-2'>
          <Progress value={usagePercent} aria-label={`식대 사용률 ${usagePercent}%`} />
          <div className='text-muted-foreground flex items-center justify-between text-xs tabular-nums'>
            <span>{usagePercent}% 사용</span>
            <span>남은 식대 {hidden ? '••••' : formatWalletAmount(snapshot.monthly_remaining)}</span>
          </div>
        </div>

        <div className='flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div className='text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs'>
            <Icons.clock className='size-3.5 shrink-0' />
            <span>마지막 업데이트</span>
            <span className='font-mono whitespace-nowrap'>
              {formatAbsoluteDateTimeKo(snapshot.synced_at)}
            </span>
          </div>
          <Badge variant='secondary' className='shrink-0 font-normal'>
            {snapshot.source === 'kbcard' ? 'KB국민 식대 체크카드' : snapshot.source}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
