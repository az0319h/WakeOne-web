'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { ProfileAvatar } from '@/features/auth/components/profile-display';
import { formatBirthdayMonthDay } from '@/lib/format-date';
import { cn } from '@/lib/utils';

interface BirthdayCelebrationSlideProps {
  fullName: string;
  avatarUrl: string | null;
  birthday: string;
  className?: string;
}

export function BirthdayCelebrationSlide({
  fullName,
  avatarUrl,
  birthday,
  className
}: BirthdayCelebrationSlideProps) {
  const prefersReducedMotion = useReducedMotion();
  const displayName = fullName.trim() || '이름 미설정';
  const birthdayLabel = formatBirthdayMonthDay(birthday);

  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center px-6 py-8 text-center sm:px-10 sm:py-10',
        className
      )}
    >
      <Icons.sparkles
        aria-hidden
        className='text-muted-foreground/15 pointer-events-none absolute top-5 left-5 size-3.5'
      />
      <Icons.sparkles
        aria-hidden
        className='text-muted-foreground/15 pointer-events-none absolute top-5 right-5 size-3.5'
      />
      <Icons.sparkles
        aria-hidden
        className='text-muted-foreground/10 pointer-events-none absolute bottom-5 left-5 size-3'
      />
      <Icons.sparkles
        aria-hidden
        className='text-muted-foreground/10 pointer-events-none absolute right-5 bottom-5 size-3'
      />

      <Badge variant='outline' className='mx-auto mb-5'>
        <Icons.sparkles className='text-muted-foreground size-3.5' />
        다가오는 생일
      </Badge>

      <div className='relative mb-5 size-20 shrink-0 sm:size-24'>
        {!prefersReducedMotion ? (
          <motion.div
            aria-hidden
            className='absolute inset-0 rounded-full opacity-70'
            style={{
              background:
                'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 45%, transparent), transparent 25%, color-mix(in oklch, var(--muted-foreground) 35%, transparent), transparent 50%, color-mix(in oklch, var(--primary) 45%, transparent), transparent 75%, color-mix(in oklch, var(--muted-foreground) 35%, transparent), transparent)'
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

      <h3 className='text-foreground w-full text-xl font-bold tracking-tight sm:text-2xl'>
        {displayName}님, 생일을 축하해요!
      </h3>
      <p className='text-muted-foreground mt-2 w-full max-w-md text-sm leading-relaxed sm:text-base'>
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
