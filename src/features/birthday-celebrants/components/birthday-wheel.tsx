'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BirthdayCelebrant } from '../api/types';
import { findCenterIndex } from '../lib/birthday-order';
import { BIRTHDAY_WHEEL_MASK_CLASS, BIRTHDAY_WHEEL_ROW_HEIGHT } from '../lib/birthday-card-styles';
import { BirthdayWheelRow } from './birthday-wheel-row';

/** 가운데에서 이 줄 수 이상 떨어지면 더 작아지거나 흐려지지 않는다 */
const MAX_FADE_DISTANCE = 3;
const SCALE_STEP = 0.05;
const OPACITY_STEP = 0.22;
const MIN_OPACITY = 0.3;

function clampIndex(index: number, lastIndex: number): number {
  return Math.min(Math.max(index, 0), Math.max(lastIndex, 0));
}

/** ↑/↓/Home/End → 이동할 줄 index (그 외 키는 null) */
function getKeyboardTargetIndex(key: string, index: number, lastIndex: number): number | null {
  switch (key) {
    case 'ArrowUp':
      return clampIndex(index - 1, lastIndex);
    case 'ArrowDown':
      return clampIndex(index + 1, lastIndex);
    case 'Home':
      return 0;
    case 'End':
      return lastIndex;
    default:
      return null;
  }
}

interface BirthdayWheelProps {
  /** 탭 필터가 끝난 목록 (서버 정렬 그대로 · 1명 이상) */
  celebrants: BirthdayCelebrant[];
  /** 스크롤 목록 `aria-label` */
  label: string;
  showAffiliation: boolean;
  /** 가운데 띠 톤 — 회사 전체에 오늘 생일이 있으면 `today` */
  tone: 'upcoming' | 'today';
  reducedMotion: boolean;
}

/**
 * plan 102 — 가운데 줄 강조 세로 휠 (D-3 · D-4 · D-7).
 * 줄 높이 64px 고정 → index i의 가운데 맞춤 scrollTop = `i × 64`.
 * 위아래 여백은 `before`/`after` 높이 `calc(50% - 32px)`라 목록 높이가 바뀌어도 계산식이 그대로다.
 */
export function BirthdayWheel({
  celebrants,
  label,
  showAffiliation,
  tone,
  reducedMotion
}: BirthdayWheelProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const initialCenterRef = useRef(Math.max(findCenterIndex(celebrants), 0));
  const [centerIndex, setCenterIndex] = useState(initialCenterRef.current);
  const [aligned, setAligned] = useState(false);
  const lastIndex = celebrants.length - 1;
  const activeIndex = clampIndex(centerIndex, lastIndex);

  /** 스크롤 위치 → 줄별 크기·투명도(DOM 직접) + 가운데 index(state, 바뀔 때만 렌더) */
  const syncToScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const position = list.scrollTop / BIRTHDAY_WHEEL_ROW_HEIGHT;

    for (let index = 0; index <= lastIndex; index += 1) {
      const row = rowRefs.current[index];
      if (!row) {
        continue;
      }

      const distance = Math.min(Math.abs(index - position), MAX_FADE_DISTANCE);
      row.style.transform = `scale(${1 - distance * SCALE_STEP})`;
      row.style.opacity = String(Math.max(MIN_OPACITY, 1 - distance * OPACITY_STEP));
    }

    setCenterIndex(clampIndex(Math.round(position), lastIndex));
  }, [lastIndex]);

  // 첫 화면: 애니메이션 없이 가운데 사람에 즉시 맞춤 → 맞춘 뒤에만 보이게(data-ready)
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    list.style.scrollSnapType = 'none';
    list.scrollTop = initialCenterRef.current * BIRTHDAY_WHEEL_ROW_HEIGHT;
    syncToScroll();
    setAligned(true);

    const frame = requestAnimationFrame(() => {
      list.style.scrollSnapType = '';
    });

    return () => {
      cancelAnimationFrame(frame);
      list.style.scrollSnapType = '';
    };
  }, [syncToScroll]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    let frame = 0;
    const handleScroll = () => {
      if (frame !== 0) {
        return;
      }

      frame = requestAnimationFrame(() => {
        frame = 0;
        syncToScroll();
      });
    };

    list.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      list.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(frame);
    };
  }, [syncToScroll]);

  const scrollToIndex = useCallback(
    (index: number) => {
      listRef.current?.scrollTo({
        top: index * BIRTHDAY_WHEEL_ROW_HEIGHT,
        behavior: reducedMotion ? 'auto' : 'smooth'
      });
    },
    [reducedMotion]
  );

  const handleRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const targetIndex = getKeyboardTargetIndex(event.key, index, lastIndex);
    if (targetIndex === null) {
      return;
    }

    event.preventDefault();
    rowRefs.current[targetIndex]?.focus({ preventScroll: true });
    scrollToIndex(targetIndex);
  };

  return (
    <div className='absolute inset-0'>
      <div
        aria-hidden
        data-testid='birthday-wheel-band'
        className={cn(
          'pointer-events-none absolute inset-x-0 top-1/2 h-16 -translate-y-1/2 rounded-lg border',
          tone === 'today' ? 'bg-card border-primary/25' : 'bg-muted'
        )}
      />
      <ul
        ref={listRef}
        data-testid='birthday-wheel'
        data-ready={aligned ? 'true' : 'false'}
        aria-label={label}
        className={cn(
          // 터치 기기(pointer: coarse): 손가락 스와이프가 페이지를 스크롤하도록 목록 자체 스크롤을 막고
          // 위/아래 버튼·줄 탭으로 이동 (마우스·트랙패드 휠은 그대로)
          'absolute inset-0 snap-y snap-mandatory overflow-y-auto pointer-coarse:overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'before:block before:h-[calc(50%-32px)] after:block after:h-[calc(50%-32px)]',
          BIRTHDAY_WHEEL_MASK_CLASS,
          !aligned && 'invisible'
        )}
      >
        {celebrants.map((celebrant, index) => (
          <li key={celebrant.user_id} className='h-16 snap-center'>
            <BirthdayWheelRow
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
              celebrant={celebrant}
              isCenter={index === activeIndex}
              showAffiliation={showAffiliation}
              reducedMotion={reducedMotion}
              onClick={() => scrollToIndex(index)}
              onKeyDown={(event) => handleRowKeyDown(event, index)}
            />
          </li>
        ))}
      </ul>
      {lastIndex > 0 ? (
        <>
          <Button
            type='button'
            variant='outline'
            size='icon'
            aria-label='이전 생일'
            data-testid='birthday-wheel-prev'
            disabled={activeIndex <= 0}
            onClick={() => scrollToIndex(activeIndex - 1)}
            // 보이는 크기 32px · 투명 ::after로 44px 터치 영역
            className='text-muted-foreground absolute top-1 left-1/2 z-10 hidden size-8 -translate-x-1/2 rounded-full pointer-coarse:inline-flex after:absolute after:-inset-1.5'
          >
            <Icons.chevronUp className='size-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            aria-label='다음 생일'
            data-testid='birthday-wheel-next'
            disabled={activeIndex >= lastIndex}
            onClick={() => scrollToIndex(activeIndex + 1)}
            className='text-muted-foreground absolute bottom-1 left-1/2 z-10 hidden size-8 -translate-x-1/2 rounded-full pointer-coarse:inline-flex after:absolute after:-inset-1.5'
          >
            <Icons.chevronDown className='size-4' />
          </Button>
        </>
      ) : null}
    </div>
  );
}
