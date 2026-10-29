'use client';

import { useMemo, useState, type KeyboardEvent, type RefObject } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Icons } from '@/components/icons';
import { notifyError } from '@/lib/notify';
import { quickRequestPlacesInfiniteQueryOptions } from '../api/queries';
import type { QuickRequestPlace, QuickRequestPlacesPage } from '../api/types';
import { QUICK_PLACE_MESSAGES, QUICK_PLACE_QUERY_MAX_LENGTH } from '../schemas/quick-request-place';
import { useDebouncedValue } from './chat/use-debounced-value';
import { QuickInfiniteSentinel } from './quick-infinite-sentinel';
import { QuickRequestQueryErrorAlert } from './quick-request-query-boundary';

/** 자동 검색 최소 글자 수 (trim 후 · D-3) */
export const QUICK_PLACE_SEARCH_MIN_LENGTH = 2;
/** 입력이 멈춘 뒤 자동 검색까지 (D-3) */
export const QUICK_PLACE_SEARCH_DEBOUNCE_MS = 400;

/** plan 99 U-2~U-4 · designer §1-2 — 장소 탭 문구 (spec import용) */
export const QUICK_PLACE_SEARCH_TEXT = {
  inputLabel: '장소 이름 검색',
  placeholder: '가게·건물 이름으로 검색 (예: 익선 산스)…',
  hint: '가게·건물 이름으로 찾습니다. 주소를 아시면 「주소 검색」 탭을 이용하세요.',
  idle: '가게·건물 이름을 2자 이상 입력하세요.',
  empty: '검색 결과가 없습니다.',
  emptyHint: '띄어쓰기나 지점명을 바꿔 다시 검색해 보세요.',
  failed: QUICK_PLACE_MESSAGES.upstreamFailed,
  jibunBadge: '지번',
  /** D-4 — 도로명 없는 장소 선택 시 toast (location-section) */
  jibunFallback: '도로명 주소가 없어 지번 주소를 넣었습니다.',
  resultsLabel: '장소 검색 결과',
  listLabel: '장소 검색 결과 목록',
  endMessage: '더 이상 결과가 없습니다',
  tooManyMessage: '결과가 많습니다. 검색어를 더 구체적으로 입력해 주세요.',
  loadMoreRetry: '다시 불러오기'
} as const;

const HINT_ID = 'quick-request-place-hint';
const countFormatter = new Intl.NumberFormat('ko-KR');

export function formatQuickPlaceTotal(total: number): string {
  return `검색 결과 ${countFormatter.format(total)}건`;
}

export function formatQuickPlaceMatchedQuery(matchedQuery: string): string {
  return `‘${matchedQuery}’(으)로 찾은 결과`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : QUICK_PLACE_SEARCH_TEXT.failed;
}

/** 페이지 평탄화 + id dedupe (외부 페이지 경계에서 같은 장소가 두 번 오면 key 충돌) */
function flattenPlaces(pages: ReadonlyArray<QuickRequestPlacesPage>): QuickRequestPlace[] {
  const seen = new Set<string>();
  const result: QuickRequestPlace[] = [];
  for (const page of pages) {
    for (const place of page.places) {
      if (seen.has(place.id)) continue;
      seen.add(place.id);
      result.push(place);
    }
  }
  return result;
}

/**
 * 검색어 확정값 — 입력이 400ms 멈추면 그 값, Enter면 즉시 현재 값(designer K6).
 * Enter 뒤 debounce가 같은 값으로 따라오면 queryKey가 같아 중복 요청이 없다.
 * 탭 재진입(재마운트) 시에는 보관된 검색어로 바로 시작한다(60초 캐시 hit).
 */
function usePlaceSearchTerm(query: string) {
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, QUICK_PLACE_SEARCH_DEBOUNCE_MS);
  const [term, setTerm] = useState(trimmed);
  const [lastDebounced, setLastDebounced] = useState(debounced);

  // debounce 값이 바뀐 렌더에서만 확정값을 맞춘다 (effect 없이 파생 · Enter로 앞당긴 값은 유지)
  if (debounced !== lastDebounced) {
    setLastDebounced(debounced);
    setTerm(debounced);
  }

  return { term, commitNow: () => setTerm(trimmed) };
}

type QuickPlaceSearchStateProps = {
  title: string;
  description?: string;
  testId: string;
};

/** 입력 전·빈 결과 — 97 최근 내역 빈 상태와 같은 모양 */
function QuickPlaceSearchState({ title, description, testId }: QuickPlaceSearchStateProps) {
  return (
    <div data-testid={testId} className='flex flex-col items-center gap-2 py-12 text-center'>
      <span className='flex size-12 items-center justify-center rounded-full bg-muted'>
        <Icons.search className='size-6 text-muted-foreground' aria-hidden />
      </span>
      <p className='text-sm font-medium text-foreground'>{title}</p>
      {description ? <p className='text-xs text-muted-foreground'>{description}</p> : null}
    </div>
  );
}

type QuickPlaceResultRowProps = {
  place: QuickRequestPlace;
  index: number;
  onSelect: (place: QuickRequestPlace) => void;
};

function QuickPlaceResultRow({ place, index, onSelect }: QuickPlaceResultRowProps) {
  const testId = `quick-request-place-${index}`;
  const isJibunOnly = place.roadAddress == null;

  return (
    <li>
      <Button
        type='button'
        variant='ghost'
        data-testid={testId}
        className='h-auto min-h-11 w-full flex-col items-stretch gap-0.5 rounded-none px-3 py-3 text-left font-normal whitespace-normal'
        onClick={() => onSelect(place)}
      >
        <span className='flex min-w-0 items-baseline gap-2'>
          <span
            data-testid={`${testId}-name`}
            className='min-w-0 flex-1 truncate text-sm font-medium text-foreground'
          >
            {place.name}
          </span>
          {place.category ? (
            <span className='max-w-[40%] shrink-0 truncate text-xs text-muted-foreground'>
              {place.category}
            </span>
          ) : null}
        </span>
        <span className='flex min-w-0 items-start gap-1.5'>
          {isJibunOnly ? (
            <Badge
              variant='outline'
              data-testid={`${testId}-jibun`}
              className='shrink-0 px-1.5 text-[11px]'
            >
              {QUICK_PLACE_SEARCH_TEXT.jibunBadge}
            </Badge>
          ) : null}
          <span
            data-testid={`${testId}-address`}
            className='min-w-0 text-sm wrap-break-word text-foreground'
          >
            {place.roadAddress ?? place.address}
          </span>
        </span>
        {place.phone ? (
          <span className='text-xs text-muted-foreground tabular-nums'>{place.phone}</span>
        ) : null}
      </Button>
    </li>
  );
}

type QuickRequestPlaceSearchTabProps = {
  /** 입력값 — Dialog 안쪽(`QuickRequestAddressPickerTabs`)이 보관해 탭을 오가도 유지 (designer K4) */
  query: string;
  onQueryChange: (query: string) => void;
  /** 「장소 검색」 탭 클릭 시 포커스 대상 (designer K5 · autoFocus 미사용) */
  inputRef: RefObject<HTMLInputElement | null>;
  onSelect: (place: QuickRequestPlace) => void;
};

/**
 * plan 99 D-3 — 「장소 검색」 탭 본문. 2자 이상 · 400ms debounce · Enter 즉시(한글 조합 중 Enter 무시).
 * 상태 5종(입력 전·로딩·오류·빈 결과·결과) · 결과 행 선택은 `onSelect`만 호출(채움은 location-section).
 */
export function QuickRequestPlaceSearchTab({
  query,
  onQueryChange,
  inputRef,
  onSelect
}: QuickRequestPlaceSearchTabProps) {
  const { term, commitNow } = usePlaceSearchTerm(query);
  const enabled = term.length >= QUICK_PLACE_SEARCH_MIN_LENGTH;

  const {
    data,
    error,
    isError,
    isPending,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({ ...quickRequestPlacesInfiniteQueryOptions(term), enabled });

  const places = useMemo(() => (data ? flattenPlaces(data.pages) : []), [data]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    // 한글 조합 중 Enter를 처리하면 마지막 글자가 빠진 검색어로 요청된다 (designer K6)
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    commitNow();
  }

  // 센티널 자동 호출·「다시 불러오기」 공용 — 다음 페이지 실패는 toast 1회 + 수동 재시도 버튼(designer K9)
  async function handleLoadMore() {
    const result = await fetchNextPage();
    if (result.isFetchNextPageError) {
      notifyError(getErrorMessage(result.error));
    }
  }

  function renderResults() {
    if (!enabled) {
      return <QuickPlaceSearchState testId='quick-request-place-idle' title={QUICK_PLACE_SEARCH_TEXT.idle} />;
    }
    if (isError && !data) {
      return (
        <div data-testid='quick-request-place-error'>
          <QuickRequestQueryErrorAlert message={getErrorMessage(error)} onRetry={() => void refetch()} />
        </div>
      );
    }
    if (isPending || !data) {
      return <PageLoadingSpinner variant='compact' data-testid='quick-request-place-loading' />;
    }
    if (places.length === 0) {
      return (
        <QuickPlaceSearchState
          testId='quick-request-place-empty'
          title={QUICK_PLACE_SEARCH_TEXT.empty}
          description={QUICK_PLACE_SEARCH_TEXT.emptyHint}
        />
      );
    }

    const firstPage = data.pages[0];
    const lastPage = data.pages[data.pages.length - 1];

    return (
      <>
        <div className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
          <span className='tabular-nums' data-testid='quick-request-place-total'>
            {formatQuickPlaceTotal(firstPage?.total ?? places.length)}
          </span>
          {firstPage?.matchedQuery ? (
            <span data-testid='quick-request-place-matched' className='min-w-0 truncate'>
              {formatQuickPlaceMatchedQuery(firstPage.matchedQuery)}
            </span>
          ) : null}
        </div>
        <ul
          aria-label={QUICK_PLACE_SEARCH_TEXT.listLabel}
          className='divide-y overflow-hidden rounded-lg border bg-card'
        >
          {places.map((place, index) => (
            <QuickPlaceResultRow key={place.id} place={place} index={index} onSelect={onSelect} />
          ))}
        </ul>
        {isFetchNextPageError ? (
          <Button
            type='button'
            variant='outline'
            className='h-11 w-full'
            data-testid='quick-request-place-load-more-retry'
            onClick={() => void handleLoadMore()}
          >
            {QUICK_PLACE_SEARCH_TEXT.loadMoreRetry}
          </Button>
        ) : (
          <QuickInfiniteSentinel
            testIdPrefix='quick-request-place'
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => void handleLoadMore()}
            endMessage={
              lastPage?.isEnd === false
                ? QUICK_PLACE_SEARCH_TEXT.tooManyMessage
                : QUICK_PLACE_SEARCH_TEXT.endMessage
            }
            showEnd={data.pages.length > 1}
          />
        )}
      </>
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='space-y-1.5'>
        <InputGroup className='h-11 bg-muted/50'>
          <InputGroupAddon>
            <Icons.search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            type='search'
            name='quick-place-query'
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={QUICK_PLACE_SEARCH_TEXT.placeholder}
            aria-label={QUICK_PLACE_SEARCH_TEXT.inputLabel}
            aria-describedby={HINT_ID}
            autoComplete='off'
            spellCheck={false}
            enterKeyHint='search'
            maxLength={QUICK_PLACE_QUERY_MAX_LENGTH}
            className='h-full'
            data-testid='quick-request-place-input'
          />
        </InputGroup>
        <p id={HINT_ID} data-testid='quick-request-place-hint' className='text-xs text-muted-foreground'>
          {QUICK_PLACE_SEARCH_TEXT.hint}
        </p>
      </div>
      <section
        aria-label={QUICK_PLACE_SEARCH_TEXT.resultsLabel}
        aria-live='polite'
        aria-busy={enabled && isFetching}
        className='flex flex-col gap-2'
      >
        {renderResults()}
      </section>
    </div>
  );
}
