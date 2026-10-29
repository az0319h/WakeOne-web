'use client';

import { Lottie } from 'lottie-react';
import { cn } from '@/lib/utils';

const HAPPY_BIRTHDAY_LOTTIE_PATH = '/lottie/happy-birthday.json';

const LOTTIE_SIZE_CLASS = {
  /** 큰 축하 영역 (기존 배너 크기) */
  hero: 'mx-auto aspect-square w-[7.5rem] sm:w-[8.5rem]',
  /** plan 102 — 휠 목록 당일 줄 칩 왼쪽 (약 40px) */
  row: 'mx-0 size-10 shrink-0'
} as const;

interface BirthdayDDayLottieProps {
  size?: keyof typeof LOTTIE_SIZE_CLASS;
  className?: string;
}

export function BirthdayDDayLottie({ size = 'hero', className }: BirthdayDDayLottieProps) {
  return (
    <div
      className={cn('pointer-events-none', LOTTIE_SIZE_CLASS[size], className)}
      aria-hidden
      data-testid='birthday-dday-lottie'
    >
      <Lottie src={HAPPY_BIRTHDAY_LOTTIE_PATH} loop autoplay className='size-full' />
    </div>
  );
}
