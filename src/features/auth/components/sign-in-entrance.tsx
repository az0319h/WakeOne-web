'use client';

import type { ReactElement, ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  Slide,
  Slides,
  type SlideDirection
} from '@/components/animate-ui/primitives/effects/slide';

type SignInEntranceProps = {
  children: ReactElement | ReactElement[];
  holdDelay?: number;
  className?: string;
  direction?: SlideDirection;
  offset?: number;
};

export function SignInEntrance({
  children,
  holdDelay = 90,
  className,
  direction = 'up',
  offset = 16
}: SignInEntranceProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      <Slides
        holdDelay={holdDelay}
        delay={0}
        inView={false}
        direction={direction}
        offset={offset}
        className='w-full'
      >
        {children}
      </Slides>
    </div>
  );
}

type SignInEntranceItemProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: SlideDirection;
  offset?: number;
};

export function SignInEntranceItem({
  children,
  className,
  delay = 0,
  direction = 'up',
  offset = 16
}: SignInEntranceItemProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Slide
      delay={delay}
      inView={false}
      direction={direction}
      offset={offset}
      className={className}
    >
      {children}
    </Slide>
  );
}
