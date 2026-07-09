'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { ProfileAvatar } from '@/features/auth/components/profile-display';
import { formatBirthdayMonthDay } from '@/lib/format';
import { cn } from '@/lib/utils';

interface BirthdayCelebrationSlideProps {
  fullName: string;
  avatarUrl: string | null;
  birthday: string;
  month: number;
  className?: string;
}

export function BirthdayCelebrationSlide({
  fullName,
  avatarUrl,
  birthday,
  month,
  className
}: BirthdayCelebrationSlideProps) {
  const prefersReducedMotion = useReducedMotion();
  const displayName = fullName.trim() || '이름 미설정';
  const birthdayLabel = formatBirthdayMonthDay(birthday);

  return (
    <div className={cn('relative px-6 py-8 text-center sm:px-10 sm:py-10', className)}>
      <Icons.sparkles
        aria-hidden
        className='text-muted-foreground/20 pointer-events-none absolute top-5 left-5 size-4'
      />
      <Icons.sparkles
        aria-hidden
        className='text-muted-foreground/15 pointer-events-none absolute right-5 bottom-5 size-3.5'
      />

      <Badge variant='outline' className='mb-5'>
        <Icons.sparkles className='text-muted-foreground size-3.5' />
        {month}월 생일
      </Badge>

      <div className='relative mx-auto mb-5 size-20 sm:size-24'>
        {!prefersReducedMotion ? (
          <motion.div
            aria-hidden
            className='absolute inset-0 rounded-full opacity-80'
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, color-mix(in oklch, var(--primary) 55%, transparent) 100deg, transparent 200deg, color-mix(in oklch, var(--muted-foreground) 40%, transparent) 300deg, transparent 360deg)'
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          />
        ) : null}
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-muted/30',
            prefersReducedMotion
              ? 'border-border/60 size-full border-2'
              : 'bg-card absolute inset-[2px]'
          )}
        >
          <ProfileAvatar
            profile={{
              full_name: fullName,
              email: '',
              avatar_url: avatarUrl
            }}
            className='size-14 sm:size-16'
            fallbackClassName='bg-muted text-foreground text-lg font-semibold'
          />
        </div>
      </div>

      <h3 className='text-foreground text-xl font-bold tracking-tight sm:text-2xl'>
        {displayName}님, 생일을 축하해요!
      </h3>
      <p className='text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed sm:text-base'>
        {birthdayLabel ? (
          <>
            <span className='text-foreground font-medium'>{birthdayLabel}</span>
            {' · '}팀원들이 함께 축하합니다.
          </>
        ) : (
          '팀원들이 함께 축하합니다.'
        )}
      </p>
    </div>
  );
}
