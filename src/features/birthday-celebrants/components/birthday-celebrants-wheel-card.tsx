'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import { getAffiliationLabel } from '@/features/users/constants/organization';
import { formatBirthdayMonthDay } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import type { BirthdayCelebrantsResponse } from '../api/types';
import { usePrefersReducedMotion } from '../hooks/use-prefers-reduced-motion';
import { BIRTHDAY_CARD_HEIGHT_CLASS } from '../lib/birthday-card-styles';
import {
  BIRTHDAY_TAB_ALL,
  buildTodayBirthdayHeadline,
  filterCelebrantsByTab,
  getBirthdayConfettiStorageKey,
  isStaleBirthdayConfettiStorageKey,
  shouldFireBirthdayConfetti,
  type BirthdayTabValue
} from '../lib/birthday-order';
import { fireBirthdayConfetti } from '../lib/confetti';
import { BirthdayWheel } from './birthday-wheel';

/** D-8 — 탭 순서: 전체 · 웨이크 · 산스 · 산스파운드리 [r3] */
const BIRTHDAY_TABS = [
  BIRTHDAY_TAB_ALL,
  'wake',
  'sans',
  'sans_foundry'
] as const satisfies readonly BirthdayTabValue[];

function getBirthdayTabLabel(tab: BirthdayTabValue): string {
  return tab === BIRTHDAY_TAB_ALL ? '전체' : (getAffiliationLabel(tab) ?? tab);
}

function isBirthdayTabValue(value: string): value is BirthdayTabValue {
  return (BIRTHDAY_TABS as readonly string[]).includes(value);
}

/**
 * D-5 — 이 브라우저에서 오늘 컨페티를 처음 보는지 확인하고 표시를 남긴다.
 * 새로 남겼으면 true. 다른 날짜 키는 함께 지운다.
 * `localStorage`가 막혀 있으면(사생활 보호 모드 등) true — 호출부가 마운트당 1번만 부른다.
 */
function claimDailyBirthdayConfetti(referenceDate: string): boolean {
  const storageKey = getBirthdayConfettiStorageKey(referenceDate);

  try {
    const storage = window.localStorage;
    if (storage.getItem(storageKey) !== null) {
      return false;
    }

    storage.setItem(storageKey, '1');

    const staleKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && isStaleBirthdayConfettiStorageKey(key, referenceDate)) {
        staleKeys.push(key);
      }
    }
    staleKeys.forEach((key) => storage.removeItem(key));
  } catch {
    // 저장소 접근 실패 → 이번 마운트에서 1번만 발사
  }

  return true;
}

interface BirthdayCelebrantsWheelCardProps {
  /** 회사 전체 목록 (1명 이상 · 서버 정렬 완료) */
  data: BirthdayCelebrantsResponse;
}

/**
 * plan 102 — overview 생일 카드 (A안 · 가운데 줄 강조 휠 목록).
 * 헤더·탭·휠·컨페티. 오늘 생일 여부(`hasToday`)와 컨페티는 탭과 무관하게 회사 전체 목록 기준.
 */
export function BirthdayCelebrantsWheelCard({ data }: BirthdayCelebrantsWheelCardProps) {
  const { celebrants, referenceDate } = data;
  const reducedMotion = usePrefersReducedMotion();
  const [tab, setTab] = useState<BirthdayTabValue>(BIRTHDAY_TAB_ALL);
  const [confettiFired, setConfettiFired] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Strict Mode 이중 effect에서도 저장소 확인·쓰기는 마운트당 1번 */
  const confettiClaimedRef = useRef(false);

  const hasToday = shouldFireBirthdayConfetti(celebrants);
  const todayHeadline = buildTodayBirthdayHeadline(celebrants);
  const visibleCelebrants = filterCelebrantsByTab(celebrants, tab);
  const referenceLabel = formatBirthdayMonthDay(referenceDate) ?? referenceDate;

  useEffect(() => {
    // D-14 — 움직임 줄이기면 발사도, 저장 키 쓰기도 하지 않는다
    if (!hasToday || reducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (!confettiClaimedRef.current) {
      if (!claimDailyBirthdayConfetti(referenceDate)) {
        return;
      }

      confettiClaimedRef.current = true;
      setConfettiFired(true);
    }

    // Strict Mode(dev)의 가짜 언마운트 cleanup이 첫 발사를 지우면 두 번째 실행에서 다시 쏜다.
    // 실제 재마운트는 ref가 새로 생기고 저장 키가 있어 발사하지 않는다.
    return fireBirthdayConfetti(canvas);
  }, [hasToday, reducedMotion, referenceDate]);

  return (
    <Card
      role='region'
      aria-label={hasToday ? '오늘 생일 축하' : '다가오는 생일 축하'}
      data-testid='birthday-celebrants-card'
      data-confetti-fired={confettiFired ? 'true' : 'false'}
      className={cn(
        'relative gap-0 overflow-hidden py-0',
        BIRTHDAY_CARD_HEIGHT_CLASS,
        hasToday && 'border-primary/30 bg-primary/5'
      )}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        data-testid='birthday-confetti-canvas'
        className='pointer-events-none absolute inset-0 z-[1] size-full'
      />

      <CardContent className='relative z-[2] flex h-full min-h-0 flex-col px-4 py-5 sm:px-6'>
        <div className='flex min-h-5.5 items-center justify-between gap-2'>
          {todayHeadline ? (
            <>
              <Badge data-testid='birthday-header-badge'>
                <Icons.sparkles />
                D-DAY!
              </Badge>
              <p
                data-testid='birthday-header-meta'
                title={todayHeadline}
                className='text-foreground min-w-0 truncate text-sm font-semibold'
              >
                {todayHeadline}
              </p>
            </>
          ) : (
            <>
              <Badge variant='outline' data-testid='birthday-header-badge'>
                <Icons.sparkles className='text-muted-foreground' />
                다가오는 생일
              </Badge>
              <p
                data-testid='birthday-header-meta'
                className='text-muted-foreground min-w-0 truncate text-xs tabular-nums'
              >
                오늘 {referenceLabel} · 생일 등록 {visibleCelebrants.length}명
              </p>
            </>
          )}
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (isBirthdayTabValue(value)) {
              setTab(value);
            }
          }}
          className='mt-3 min-h-0 flex-1 gap-3'
        >
          <TabsList
            aria-label='소속'
            data-testid='birthday-tabs'
            className='w-full shrink-0 max-md:h-auto'
          >
            {BIRTHDAY_TABS.map((value) => (
              <TabsTrigger key={value} value={value} className='px-1.5 max-md:h-11 sm:px-2'>
                {getBirthdayTabLabel(value)}
              </TabsTrigger>
            ))}
          </TabsList>

          {BIRTHDAY_TABS.map((value) => (
            <TabsContent
              key={value}
              value={value}
              tabIndex={-1}
              className='relative min-h-0 flex-1'
            >
              {value !== tab ? null : visibleCelebrants.length === 0 ? (
                <div
                  data-testid='birthday-wheel-empty'
                  className='text-muted-foreground absolute inset-0 flex items-center justify-center text-sm'
                >
                  생일이 등록된 사람이 없어요.
                </div>
              ) : (
                <BirthdayWheel
                  key={`${referenceDate}:${visibleCelebrants.length}`}
                  celebrants={visibleCelebrants}
                  label={`${getBirthdayTabLabel(value)} 생일 목록`}
                  showAffiliation={value === BIRTHDAY_TAB_ALL}
                  tone={hasToday ? 'today' : 'upcoming'}
                  reducedMotion={reducedMotion}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
