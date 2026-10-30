'use client';

import type { KeyboardEvent, Ref } from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { ProfileAvatar } from '@/features/auth/components/profile-display';
import { getAffiliationLabel } from '@/features/users/constants/organization';
import { formatBirthdayMonthDay } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import type { BirthdayCelebrant } from '../api/types';
import { formatDaysOffsetLabel } from '../lib/birthday-order';
import { BirthdayDDayLottie } from './birthday-d-day-lottie';

const EMPTY_NAME_FALLBACK = '이름 미설정';

/** 가운데 줄 아바타 회전 링 — 테마 토큰(`--primary`·`--muted-foreground`)만 섞는다 */
const RING_GRADIENT = {
  upcoming:
    'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 45%, transparent), transparent 25%, color-mix(in oklch, var(--muted-foreground) 35%, transparent), transparent 50%, color-mix(in oklch, var(--primary) 45%, transparent), transparent 75%, color-mix(in oklch, var(--muted-foreground) 35%, transparent), transparent)',
  today:
    'conic-gradient(from 0deg, color-mix(in oklch, var(--primary) 70%, transparent), transparent 20%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 40%, color-mix(in oklch, var(--primary) 70%, transparent), transparent 60%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 80%)'
} as const;

interface BirthdayWheelRowRingProps {
  isToday: boolean;
  reducedMotion: boolean;
}

function BirthdayWheelRowRing({ isToday, reducedMotion }: BirthdayWheelRowRingProps) {
  if (reducedMotion) {
    return (
      <span
        aria-hidden
        data-testid='birthday-row-ring'
        className={cn(
          'absolute inset-0 rounded-full border-2',
          isToday ? 'border-primary/60' : 'border-border'
        )}
      />
    );
  }

  return (
    <span aria-hidden data-testid='birthday-row-ring' className='absolute inset-0'>
      <motion.span
        className={cn('absolute inset-0 rounded-full', isToday ? 'opacity-90' : 'opacity-70')}
        style={{ background: isToday ? RING_GRADIENT.today : RING_GRADIENT.upcoming }}
        animate={{ rotate: 360 }}
        transition={{ duration: isToday ? 8 : 12, repeat: Infinity, ease: 'linear' }}
      />
      <span className='bg-card absolute inset-[2px] rounded-full' />
    </span>
  );
}

interface BirthdayDaysOffsetChipProps {
  daysOffset: number;
  label: string;
}

function BirthdayDaysOffsetChip({ daysOffset, label }: BirthdayDaysOffsetChipProps) {
  if (daysOffset === 0) {
    return (
      <Badge data-testid='birthday-row-chip' className='font-semibold tabular-nums'>
        {label}
      </Badge>
    );
  }

  return (
    <Badge
      data-testid='birthday-row-chip'
      variant='outline'
      className={cn(
        'tabular-nums',
        daysOffset > 0 ? 'bg-card font-semibold' : 'text-muted-foreground'
      )}
    >
      {label}
    </Badge>
  );
}

interface BirthdayWheelRowProps {
  celebrant: BirthdayCelebrant;
  isCenter: boolean;
  /** 「전체」 탭에서만 소속 칩 표시 (D-9) */
  showAffiliation: boolean;
  reducedMotion: boolean;
  ref?: Ref<HTMLButtonElement>;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/**
 * plan 102 — 휠 목록 한 줄 (표시 전용).
 * 크기·투명도(transform/opacity)는 `BirthdayWheel`이 스크롤 위치로 직접 갱신한다(React state 아님).
 */
export function BirthdayWheelRow({
  celebrant,
  isCenter,
  showAffiliation,
  reducedMotion,
  ref,
  onClick,
  onKeyDown
}: BirthdayWheelRowProps) {
  const isToday = celebrant.days_offset === 0;
  const displayName = celebrant.full_name.trim() || EMPTY_NAME_FALLBACK;
  const monthDayLabel = formatBirthdayMonthDay(celebrant.month_day) ?? celebrant.month_day;
  const chipLabel = formatDaysOffsetLabel(celebrant.days_offset);
  const affiliationLabel = showAffiliation ? getAffiliationLabel(celebrant.affiliation) : null;

  return (
    <button
      ref={ref}
      type='button'
      data-testid='birthday-row'
      data-user-id={celebrant.user_id}
      data-affiliation={celebrant.affiliation ?? 'none'}
      data-days-offset={celebrant.days_offset}
      aria-current={isCenter ? 'true' : undefined}
      aria-label={`${displayName} ${monthDayLabel} ${chipLabel}`}
      tabIndex={isCenter ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        'focus-visible:ring-ring/50 flex h-16 w-full origin-center cursor-pointer touch-manipulation items-center gap-3 rounded-lg px-3 text-left transition-[transform,opacity] duration-150 ease-out outline-none focus-visible:ring-[3px] motion-reduce:transition-none',
        !isCenter && 'hover:bg-muted/50'
      )}
    >
      <span className='relative flex size-11 shrink-0 items-center justify-center'>
        {isCenter ? <BirthdayWheelRowRing isToday={isToday} reducedMotion={reducedMotion} /> : null}
        <ProfileAvatar
          profile={{
            full_name: celebrant.full_name,
            email: '',
            avatar_url: celebrant.avatar_url
          }}
          className='relative size-9'
          fallbackClassName='bg-muted text-foreground text-sm font-semibold'
        />
      </span>

      <span className='min-w-0 flex-1'>
        <span className='flex min-w-0 items-center gap-1.5'>
          <span
            className={cn(
              'text-foreground truncate',
              isCenter ? 'text-base font-bold' : 'text-sm font-semibold'
            )}
          >
            {displayName}
          </span>
          {affiliationLabel ? (
            <Badge
              variant='outline'
              data-testid='birthday-row-affiliation'
              className='text-muted-foreground h-4 shrink-0 rounded-sm px-1 py-0 text-xs leading-4 font-medium md:text-[11px]'
            >
              {affiliationLabel}
            </Badge>
          ) : null}
        </span>
        <span
          className={cn(
            'mt-0.5 block truncate text-xs',
            isCenter ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {isToday ? `${monthDayLabel} · 팀원들이 함께 축하합니다.` : monthDayLabel}
        </span>
      </span>

      <span className='flex shrink-0 items-center gap-1.5'>
        {isToday && !reducedMotion ? <BirthdayDDayLottie size='row' /> : null}
        <BirthdayDaysOffsetChip daysOffset={celebrant.days_offset} label={chipLabel} />
      </span>
    </button>
  );
}
