'use client';

import Link from 'next/link';
import { useState } from 'react';
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

interface WalletSummaryOverviewCardProps {
  snapshot: WalletLimitSnapshot | null;
}

function formatWalletSource(source: string): string {
  if (source === 'kbcard') {
    return 'KB국민 식대 체크카드';
  }

  return source;
}

export function WalletSummaryOverviewCard({ snapshot }: WalletSummaryOverviewCardProps) {
  const [hidden, setHidden] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  if (!snapshot) {
    return (
      <Card aria-label='이번 달 식대 잔액'>
        <CardHeader className='space-y-1 pb-2'>
          <CardTitle className='text-base font-medium'>이번 달 식대 잔액</CardTitle>
          <p className='text-muted-foreground text-sm'>
            식대 카드에 남은 금액을 한눈에 확인합니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground flex flex-col items-center justify-center gap-2 py-6 text-center text-sm'>
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
    <Card aria-label='이번 달 식대 잔액'>
      <CardHeader className='flex flex-row items-start justify-between gap-4 pb-2'>
        <div className='space-y-1'>
          <CardTitle className='text-base font-medium'>이번 달 식대 잔액</CardTitle>
          <p className='text-muted-foreground text-sm'>
            식대 카드에 남은 금액을 한눈에 확인합니다.
          </p>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='shrink-0'
          onClick={() => setHidden((current) => !current)}
          aria-label={hidden ? '금액 표시' : '금액 숨기기'}
          aria-pressed={hidden}
        >
          {hidden ? <Icons.eyeOff className='size-4' /> : <Icons.eye className='size-4' />}
        </Button>
      </CardHeader>
      <CardContent className='space-y-4'>
        <motion.div
          key={hidden ? 'hidden' : snapshot.monthly_remaining}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className='space-y-1'
        >
          <p className='text-muted-foreground text-sm'>남은 식대</p>
          <p
            className={cn(
              'text-3xl font-semibold tracking-tight tabular-nums',
              hidden && 'select-none blur-md'
            )}
            aria-hidden={hidden}
          >
            {hidden ? '₩••••••' : formatWalletAmount(snapshot.monthly_remaining)}
          </p>
          <span className='sr-only'>
            남은 식대 {formatWalletAmount(snapshot.monthly_remaining)}
          </span>
          <p className='text-muted-foreground text-sm tabular-nums'>
            이번 달 지급액{' '}
            <span className={cn(hidden && 'select-none blur-sm')} aria-hidden={hidden}>
              {hidden ? '₩••••••' : formatWalletAmount(snapshot.monthly_limit)}
            </span>
            {' · '}
            사용한 금액 {hidden ? '••••' : formatWalletAmount(used)} ({usagePercent}%)
          </p>
        </motion.div>

        <div className='space-y-1.5'>
          <Progress value={usagePercent} aria-label={`식대 사용률 ${usagePercent}%`} />
          <div className='text-muted-foreground flex items-center justify-between text-xs tabular-nums'>
            <span>{usagePercent}% 사용</span>
            <span>남은 식대 {hidden ? '••••' : formatWalletAmount(snapshot.monthly_remaining)}</span>
          </div>
        </div>

        <div className='flex flex-col items-start gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs'>
            <Icons.clock className='size-3.5 shrink-0' />
            <span>마지막 업데이트</span>
            <span className='font-mono whitespace-nowrap'>
              {formatAbsoluteDateTimeKo(snapshot.synced_at)}
            </span>
          </div>
          <Badge variant='outline' className='shrink-0 font-normal'>
            {formatWalletSource(snapshot.source)}
          </Badge>
        </div>

        <Link
          href='/dashboard/wallet'
          className='text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline'
        >
          식대 카드 자세히
          <Icons.chevronRight className='size-4' />
        </Link>
      </CardContent>
    </Card>
  );
}
