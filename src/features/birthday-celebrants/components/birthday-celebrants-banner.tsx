'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { BirthdayCelebrantsResponse } from '../api/types';
import {
  fireBirthdayConfetti,
  getBirthdayConfettiStorageKey
} from '../lib/confetti';
import { BirthdayCelebrationSlide } from './birthday-celebration-slide';

interface BirthdayCelebrantsBannerProps {
  data: BirthdayCelebrantsResponse;
}

export function BirthdayCelebrantsBanner({ data }: BirthdayCelebrantsBannerProps) {
  const { celebrants, referenceDate } = data;
  const showCarousel = celebrants.length > 1;
  const prefersReducedMotion = useReducedMotion();
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(1);
  const [slideCount, setSlideCount] = useState(celebrants.length);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const canvas = confettiCanvasRef.current;
    const storageKey = getBirthdayConfettiStorageKey(referenceDate);

    if (!canvas || sessionStorage.getItem(storageKey)) {
      return;
    }

    sessionStorage.setItem(storageKey, '1');
    const cleanup = fireBirthdayConfetti(canvas);

    return cleanup;
  }, [prefersReducedMotion, referenceDate]);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    setSlideCount(carouselApi.scrollSnapList().length);
    setCurrentSlide(carouselApi.selectedScrollSnap() + 1);

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap() + 1);
    };

    carouselApi.on('select', onSelect);
    carouselApi.on('reInit', onSelect);

    return () => {
      carouselApi.off('select', onSelect);
      carouselApi.off('reInit', onSelect);
    };
  }, [carouselApi]);

  const slideProps = (celebrant: (typeof celebrants)[number]) => ({
    fullName: celebrant.full_name,
    avatarUrl: celebrant.avatar_url,
    birthday: celebrant.birthday
  });

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Card className='relative overflow-hidden' aria-label='다가오는 생일 축하'>
        <canvas
          ref={confettiCanvasRef}
          aria-hidden
          className='pointer-events-none absolute inset-0 z-[1] size-full'
        />
        <CardContent className='relative z-[2] w-full p-0'>
          {showCarousel ? (
            <>
              <Carousel
                setApi={setCarouselApi}
                opts={{ align: 'start', loop: true, containScroll: 'trimSnaps' }}
                className='w-full'
              >
                <CarouselContent className='-ml-0'>
                  {celebrants.map((celebrant) => (
                    <CarouselItem key={celebrant.user_id} className='basis-full pl-0'>
                      <BirthdayCelebrationSlide {...slideProps(celebrant)} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              <div className='flex items-center justify-center gap-4 px-4 pb-6'>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='size-9 shrink-0 rounded-full'
                  aria-label='이전 생일자'
                  onClick={() => carouselApi?.scrollPrev()}
                >
                  <Icons.chevronLeft />
                </Button>

                <div className='flex min-w-0 flex-col items-center gap-2'>
                  <p className='text-muted-foreground text-xs'>
                    {currentSlide} / {slideCount}
                  </p>
                  <div className='flex items-center gap-1.5'>
                    {celebrants.map((celebrant, index) => (
                      <button
                        key={celebrant.user_id}
                        type='button'
                        aria-label={`${index + 1}번째 생일자 보기`}
                        aria-current={currentSlide === index + 1 ? 'true' : undefined}
                        onClick={() => carouselApi?.scrollTo(index)}
                        className={cn(
                          'size-2 rounded-full transition-colors',
                          currentSlide === index + 1
                            ? 'bg-primary'
                            : 'bg-muted-foreground/25 hover:bg-muted-foreground/40'
                        )}
                      />
                    ))}
                  </div>
                </div>

                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='size-9 shrink-0 rounded-full'
                  aria-label='다음 생일자'
                  onClick={() => carouselApi?.scrollNext()}
                >
                  <Icons.chevronRight />
                </Button>
              </div>
            </>
          ) : (
            <BirthdayCelebrationSlide {...slideProps(celebrants[0])} className='pb-2' />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
