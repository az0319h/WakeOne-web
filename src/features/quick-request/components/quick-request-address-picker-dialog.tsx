'use client';

import { useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import { formatPhoneDisplay } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { quickRequestRecentAddressesInfiniteQueryOptions } from '../api/queries';
import type {
  QuickRequestPlace,
  QuickRequestRecentAddress,
  QuickRequestRecentAddressDirection
} from '../api/types';
import { QuickInfiniteSentinel } from './quick-infinite-sentinel';
import { QuickRequestDaumPostcodeEmbed } from './quick-request-daum-postcode-embed';
import { QuickRequestPlaceSearchTab } from './quick-request-place-search-tab';
import { QuickRequestQueryBoundary } from './quick-request-query-boundary';

const DESCRIPTION_ID = 'quick-request-address-picker-description';

/** plan 97 U-5 · designer K5 — 방향별 힌트·빈 상태 보조문장 (헤드라인 「최근 이용 내역이 없습니다.」는 유지) */
const RECENT_ADDRESS_TEXT: Record<
  QuickRequestRecentAddressDirection,
  { hint: string; emptyHint: string }
> = {
  origin: {
    hint: '출발지에서 쓴 주소',
    emptyHint: '출발지로 등록한 주소가 여기에 저장됩니다.'
  },
  destination: {
    hint: '도착지·경유지에서 쓴 주소',
    emptyHint: '도착지·경유지로 등록한 주소가 여기에 저장됩니다.'
  }
};

const RECENT_ADDRESS_END_MESSAGE = '더 이상 주소가 없습니다';

/** 페이지 평탄화 + id dedupe (등록 직후 invalidate로 페이지 경계가 밀려도 같은 행이 두 번 안 나온다) */
function flattenRecentAddresses(
  pages: ReadonlyArray<{ addresses: QuickRequestRecentAddress[] }>
): QuickRequestRecentAddress[] {
  const seen = new Set<number>();
  const result: QuickRequestRecentAddress[] = [];
  for (const page of pages) {
    for (const address of page.addresses) {
      if (seen.has(address.id)) continue;
      seen.add(address.id);
      result.push(address);
    }
  }
  return result;
}

type QuickRequestRecentAddressListProps = {
  direction: QuickRequestRecentAddressDirection;
  onSelect: (address: QuickRequestRecentAddress) => void;
};

/** plan 97 D-9 — direction별 커서 무한 목록(10건) + 센티널. 행 testid는 페이지를 넘어도 연속 index */
function QuickRequestRecentAddressList({ direction, onSelect }: QuickRequestRecentAddressListProps) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    quickRequestRecentAddressesInfiniteQueryOptions(direction)
  );
  const addresses = useMemo(() => flattenRecentAddresses(data.pages), [data.pages]);
  const text = RECENT_ADDRESS_TEXT[direction];

  if (addresses.length === 0) {
    return (
      <div className='flex flex-col items-center gap-2 py-12 text-center'>
        <span className='flex size-12 items-center justify-center rounded-full bg-muted'>
          <Icons.clock className='size-6 text-muted-foreground' aria-hidden />
        </span>
        <p className='text-sm font-medium text-foreground'>최근 이용 내역이 없습니다.</p>
        <p className='text-xs text-muted-foreground'>{text.emptyHint}</p>
      </div>
    );
  }

  return (
    <>
      <ul aria-label='최근 이용 주소' className='divide-y overflow-hidden rounded-lg border bg-card'>
        {addresses.map((address, index) => (
          <li key={address.id}>
            <Button
              type='button'
              variant='ghost'
              data-testid={`quick-request-recent-address-${index}`}
              className='h-auto min-h-11 w-full flex-col items-start gap-0.5 rounded-none px-3 py-3 text-left font-normal whitespace-normal'
              onClick={() => onSelect(address)}
            >
              <span className='w-full text-sm font-medium wrap-break-word text-foreground'>
                {address.roadAddress}
              </span>
              <span className='line-clamp-2 w-full text-sm wrap-break-word text-foreground'>
                {address.detailAddress}
              </span>
              <span className='w-full truncate text-xs text-muted-foreground'>
                {address.contactName} ·{' '}
                {formatPhoneDisplay(address.contactPhone) ?? address.contactPhone}
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <QuickInfiniteSentinel
        testIdPrefix='quick-request-recent-address'
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
        endMessage={RECENT_ADDRESS_END_MESSAGE}
        showEnd={data.pages.length > 1}
      />
    </>
  );
}

/** 3탭이면 375에서 trigger 약 112px — 320 이하에서는 「최근 이용 내역」이 줄바꿈 (designer K11) */
const TAB_TRIGGER_CLASS = 'min-h-11 px-1 leading-tight whitespace-normal sm:px-2';

type QuickRequestAddressPickerTabsProps = {
  onRoadSelect: (roadAddress: string) => void;
  onRecentSelect: (address: QuickRequestRecentAddress) => void;
  recentDirection: QuickRequestRecentAddressDirection;
  /** 있으면 「장소 검색」 탭을 그린다 (plan 99 · `placeSearchEnabled`일 때만 전달) */
  onPlaceSelect?: (place: QuickRequestPlace) => void;
};

/**
 * 탭 영역 — Dialog Content 안쪽이라 닫히면 언마운트(검색어 초기화).
 * 장소 탭은 forceMount하지 않으므로 검색어(`placeQuery`)만 여기 올려 탭을 오가도 유지한다 (designer K4).
 */
function QuickRequestAddressPickerTabs({
  onRoadSelect,
  onRecentSelect,
  recentDirection,
  onPlaceSelect
}: QuickRequestAddressPickerTabsProps) {
  const [placeQuery, setPlaceQuery] = useState('');
  const placeInputRef = useRef<HTMLInputElement>(null);
  const showPlace = onPlaceSelect != null;

  return (
    <Tabs defaultValue='search' className='flex min-h-0 flex-1 flex-col gap-0'>
      <TabsList
        className={cn(
          'mx-4 mt-3 grid h-auto w-auto lg:mx-6',
          showPlace ? 'grid-cols-3' : 'grid-cols-2'
        )}
      >
        <TabsTrigger value='search' className={TAB_TRIGGER_CLASS}>
          주소 검색
        </TabsTrigger>
        {showPlace ? (
          <TabsTrigger
            value='place'
            className={TAB_TRIGGER_CLASS}
            data-testid='quick-request-address-picker-tab-place'
            // autoFocus는 탭 화살표 이동 중 포커스를 빼앗는다 — 클릭·Enter·Space에서만 입력으로 (designer K5)
            onClick={() => requestAnimationFrame(() => placeInputRef.current?.focus())}
          >
            장소 검색
          </TabsTrigger>
        ) : null}
        <TabsTrigger value='recent' className={TAB_TRIGGER_CLASS}>
          최근 이용 내역
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value='search'
        forceMount
        className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 data-[state=inactive]:hidden lg:px-6'
      >
        <QuickRequestDaumPostcodeEmbed onComplete={onRoadSelect} />
      </TabsContent>
      {showPlace ? (
        <TabsContent
          value='place'
          className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 lg:px-6'
        >
          <QuickRequestPlaceSearchTab
            query={placeQuery}
            onQueryChange={setPlaceQuery}
            inputRef={placeInputRef}
            onSelect={onPlaceSelect}
          />
        </TabsContent>
      ) : null}
      <TabsContent
        value='recent'
        className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 lg:px-6'
      >
        <p
          data-testid='quick-request-recent-address-hint'
          className='mb-2 text-xs text-muted-foreground'
        >
          {RECENT_ADDRESS_TEXT[recentDirection].hint}
        </p>
        <QuickRequestQueryBoundary errorMessage='최근 이용 내역을 불러오지 못했습니다.'>
          <QuickRequestRecentAddressList direction={recentDirection} onSelect={onRecentSelect} />
        </QuickRequestQueryBoundary>
      </TabsContent>
    </Tabs>
  );
}

type QuickRequestAddressPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoadSelect: (roadAddress: string) => void;
  onRecentSelect: (address: QuickRequestRecentAddress) => void;
  /** 닫힌 뒤 포커스를 보낼 요소 (상세 주소 입력) */
  getReturnFocusElement?: () => HTMLElement | null;
  /**
   * 「최근 이용 내역」 탭 표시 (기본 true). plan 89 수정 Sheet는 false —
   * recent-addresses는 본인 주소라 동방·admin에게 의미가 없다 (designer K8)
   */
  showRecent?: boolean;
  /** plan 97 D-8 — 출발 칸 `origin` · 경유·도착 칸 `destination` (기본 destination) */
  recentDirection?: QuickRequestRecentAddressDirection;
  /**
   * plan 99 — 「장소 검색」 탭 (기본 false). 서버 `isPlaceSearchConfigured()` 결과를 요청 페이지에서 내려받는다.
   * `showRecent=false`(수정 Sheet) 분기에는 탭이 없으므로 무시된다 (designer K2)
   */
  placeSearchEnabled?: boolean;
  onPlaceSelect?: (place: QuickRequestPlace) => void;
  /**
   * plan 106 D-10 ② · U-6 — 있으면 아래 고정 「주소 직접 입력」(탈출구)을 그린다.
   * 요청 폼 휴대폰(주소 칸 readonly)에서만 전달 — 수정 Sheet·PC는 전달하지 않아 지금 그대로.
   */
  onManualEntry?: () => void;
};

/** 주소 검색 Dialog — lg 미만 전체화면 · lg↑ 가운데 (plan 87 D3) */
export function QuickRequestAddressPickerDialog({
  open,
  onOpenChange,
  onRoadSelect,
  onRecentSelect,
  getReturnFocusElement,
  showRecent = true,
  recentDirection = 'destination',
  placeSearchEnabled = false,
  onPlaceSelect,
  onManualEntry
}: QuickRequestAddressPickerDialogProps) {
  const showPlace = showRecent && placeSearchEnabled && onPlaceSelect != null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-testid='quick-request-address-picker'
          data-recent-direction={showRecent ? recentDirection : undefined}
          aria-describedby={DESCRIPTION_ID}
          onCloseAutoFocus={(event) => {
            const target = getReturnFocusElement?.();
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          className={cn(
            'fixed inset-0 z-50 flex h-dvh w-full max-w-none flex-col gap-0 rounded-none border-0 bg-background p-0 shadow-lg outline-none',
            'lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-[min(44rem,calc(100dvh-4rem))] lg:max-w-xl',
            'lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-lg lg:border',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
          )}
        >
          {/* plan 106 D-3 — viewport-fit=cover 설치 앱에서 상단 상태 표시줄 아래로 (inset 0이면 지금과 같음) */}
          <header className='flex shrink-0 items-start gap-3 border-b px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:px-6 lg:py-4'>
            <div className='min-w-0 flex-1 space-y-1'>
              <DialogTitle className='text-base font-semibold'>주소 검색</DialogTitle>
              <DialogDescription id={DESCRIPTION_ID} className='text-sm text-muted-foreground'>
                {showPlace
                  ? '주소·가게 이름으로 검색하거나 최근 이용 내역에서 선택하세요.'
                  : showRecent
                    ? '도로명·건물명·지번으로 검색하거나 최근 이용 내역에서 선택하세요.'
                    : '도로명·건물명·지번으로 검색하세요.'}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-11 shrink-0'
                aria-label='닫기'
              >
                <Icons.close className='size-5' aria-hidden />
              </Button>
            </DialogClose>
          </header>

          {showRecent ? null : (
            <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 lg:px-6'>
              <QuickRequestDaumPostcodeEmbed onComplete={onRoadSelect} />
            </div>
          )}
          {showRecent ? (
            <QuickRequestAddressPickerTabs
              onRoadSelect={onRoadSelect}
              onRecentSelect={onRecentSelect}
              recentDirection={recentDirection}
              onPlaceSelect={showPlace ? onPlaceSelect : undefined}
            />
          ) : null}
          {onManualEntry ? (
            <footer className='flex shrink-0 items-center justify-between gap-3 border-t px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:px-6'>
              <p className='min-w-0 text-sm text-muted-foreground'>찾는 주소가 없나요?</p>
              <Button
                type='button'
                variant='ghost'
                className='h-11 shrink-0 gap-1 px-3'
                data-testid='quick-request-address-picker-manual'
                onClick={onManualEntry}
              >
                주소 직접 입력
                <Icons.chevronRight className='size-4' aria-hidden />
              </Button>
            </footer>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
