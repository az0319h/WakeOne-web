import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BIRTHDAY_CARD_HEIGHT_CLASS, BIRTHDAY_WHEEL_MASK_CLASS } from '../lib/birthday-card-styles';

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-center', 'row-4', 'row-5'] as const;

/**
 * overview 생일 카드 로딩 (plan 26 — overview는 Skeleton 유지).
 * plan 102 — 이름·testid는 그대로, 모양만 휠 목록(헤더 · 탭 · 줄 5개)에 맞춤.
 */
export function BirthdayCelebrantsBannerSkeleton() {
  return (
    <Card
      aria-hidden
      data-testid='birthday-celebrants-skeleton'
      className={cn('gap-0 overflow-hidden py-0', BIRTHDAY_CARD_HEIGHT_CLASS)}
    >
      <CardContent className='flex h-full min-h-0 flex-col px-4 py-5 sm:px-6'>
        <div className='flex items-center justify-between gap-2'>
          <Skeleton className='h-5.5 w-28' />
          <Skeleton className='h-3 w-36 sm:w-44' />
        </div>
        <Skeleton className='mt-3 h-9 w-full rounded-lg' />
        <div
          className={cn(
            'mt-3 flex min-h-0 flex-1 flex-col justify-center overflow-hidden',
            BIRTHDAY_WHEEL_MASK_CLASS
          )}
        >
          {SKELETON_ROW_KEYS.map((key) => (
            <div
              key={key}
              className={cn(
                'flex h-16 shrink-0 items-center gap-3 px-3',
                key === 'row-center' && 'rounded-lg border'
              )}
            >
              <Skeleton className='size-11 rounded-full' />
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-3 w-16' />
              </div>
              <Skeleton className='h-5.5 w-10' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
