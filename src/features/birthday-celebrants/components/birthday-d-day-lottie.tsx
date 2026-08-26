'use client';

import { Lottie } from 'lottie-react';
import { cn } from '@/lib/utils';

const HAPPY_BIRTHDAY_LOTTIE_PATH = '/lottie/happy-birthday.json';

interface BirthdayDDayLottieProps {
  className?: string;
}

export function BirthdayDDayLottie({ className }: BirthdayDDayLottieProps) {
  return (
    <div
      className={cn(
        'pointer-events-none mx-auto aspect-square w-[7.5rem] sm:w-[8.5rem]',
        className
      )}
      aria-hidden
    >
      <Lottie src={HAPPY_BIRTHDAY_LOTTIE_PATH} loop autoplay className='size-full' />
    </div>
  );
}
