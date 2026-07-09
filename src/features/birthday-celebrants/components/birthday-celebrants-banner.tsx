'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
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
  const { celebrants, month, year } = data;
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
    const storageKey = getBirthdayConfettiStorageKey(year, month);

    if (!canvas || sessionStorage.getItem(storageKey)) {
      return;
    }

    sessionStorage.setItem(storageKey, '1');
    const cleanup = fireBirthdayConfetti(canvas);

    return cleanup;
  }, [month, prefersReducedMotion, year]);

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
    birthday: celebrant.birthday,
    month
  });

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Card className='relative overflow-hidden' aria-label='이번 달 생일 축하'>
        <canvas
          ref={confettiCanvasRef}
          aria-hidden
          className='pointer-events-none absolute inset-0 z-[1] size-full'
        />
        <CardContent className='relative z-[2] mx-auto max-w-2xl p-0'>
          {showCarousel ? (
            <div className='px-10 sm:px-14'>
              <Carousel
                setApi={setCarouselApi}
                opts={{ align: 'center', loop: true }}
                className='w-full'
              >
                <CarouselContent className='-ml-0'>
                  {celebrants.map((celebrant) => (
                    <CarouselItem key={celebrant.user_id} className='pl-0'>
                      <BirthdayCelebrationSlide {...slideProps(celebrant)} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className='size-9' />
                <CarouselNext className='size-9' />
              </Carousel>

              <div className='flex flex-col items-center gap-3 pb-6'>
                <p className='text-muted-foreground text-xs'>
                  {currentSlide} / {slideCount}
                </p>
                <div className='flex items-center gap-1.5'>
                  {celebrants.map((celebrant, index) => (
                    <button
                      key={celebrant.user_id}
                      type='button'
                      aria-label={`${index + 1}번째 생일자 보기`}
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
            </div>
          ) : (
            <BirthdayCelebrationSlide {...slideProps(celebrants[0])} className='pb-2' />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
