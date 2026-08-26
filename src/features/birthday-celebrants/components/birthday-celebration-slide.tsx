'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { ProfileAvatar } from '@/features/auth/components/profile-display';
import { getDaysUntilBirthday } from '@/lib/birthday';
import { formatBirthdayMonthDay } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { BirthdayDDayLottie } from './birthday-d-day-lottie';

interface BirthdayCelebrationSlideProps {
  referenceDate: string;
  fullName: string;
  avatarUrl: string | null;
  birthday: string;
  className?: string;
}

export function BirthdayCelebrationSlide({
  referenceDate,
  fullName,
  avatarUrl,
  birthday,
  className
}: BirthdayCelebrationSlideProps) {
  const prefersReducedMotion = useReducedMotion();
  const displayName = fullName.trim() || '이름 미설정';
  const birthdayLabel = formatBirthdayMonthDay(birthday);
  const isBirthdayToday = getDaysUntilBirthday(birthday, referenceDate) === 0;

  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center px-6 py-8 text-center sm:px-10 sm:py-10',
        className
      )}
    >
      <Icons.sparkles
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-5 left-5 size-3.5',
          isBirthdayToday ? 'text-primary/35' : 'text-muted-foreground/15'
        )}
      />
      <Icons.sparkles
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-5 right-5 size-3.5',
          isBirthdayToday ? 'text-primary/35' : 'text-muted-foreground/15'
        )}
      />
      <Icons.sparkles
        aria-hidden
        className={cn(
          'pointer-events-none absolute bottom-5 left-5 size-3',
          isBirthdayToday ? 'text-primary/25' : 'text-muted-foreground/10'
        )}
      />
      <Icons.sparkles
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-5 bottom-5 size-3',
          isBirthdayToday ? 'text-primary/25' : 'text-muted-foreground/10'
        )}
      />

      {isBirthdayToday ? (
        <Badge className='mx-auto mb-5'>
          <Icons.sparkles className='size-3.5' />
          D-DAY!
        </Badge>
      ) : (
        <Badge variant='outline' className='mx-auto mb-5'>
          <Icons.sparkles className='text-muted-foreground size-3.5' />
          다가오는 생일
        </Badge>
      )}

      {isBirthdayToday && !prefersReducedMotion ? (
        <BirthdayDDayLottie className='mb-3' />
      ) : null}

      <div className='relative mb-5 size-20 shrink-0 sm:size-24'>
        {!prefersReducedMotion ? (
          <motion.div
            aria-hidden
            className={cn(
              'absolute inset-0 rounded-full',
              isBirthdayToday ? 'opacity-90' : 'opacity-70'
            )}
            style={{
              background: isBirthdayToday
                ? 'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 70%, transparent), transparent 20%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 40%, color-mix(in oklch, var(--primary) 70%, transparent), transparent 60%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 80%)'
                : 'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 45%, transparent), transparent 25%, color-mix(in oklch, var(--muted-foreground) 35%, transparent), transparent 50%, color-mix(in oklch, var(--primary) 45%, transparent), transparent 75%, color-mix(in oklch, var(--muted-foreground) 35%, transparent), transparent)'
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: isBirthdayToday ? 8 : 12,
              repeat: Infinity,
              ease: 'linear'
            }}
          />
        ) : null}
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-muted/30',
            prefersReducedMotion
              ? cn(
                  'size-full border-2',
                  isBirthdayToday ? 'border-primary/60' : 'border-border/60'
                )
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
        {isBirthdayToday
          ? `오늘은 ${displayName}님의 생일이에요!`
          : `곧 ${displayName}님의 생일이에요!`}
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
