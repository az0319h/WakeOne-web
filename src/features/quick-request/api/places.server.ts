import 'server-only';

import {
  createFixedWindowRateLimiter,
  createKakaoMockFetcher,
  parseKakaoKeywordResponse,
  resolvePlaceSearchConfigured,
  searchPlacesWithReverseRetry,
  type KakaoKeywordFetcher,
  type KakaoPlacesMockFixture,
  type PlaceSearchResult
} from '@/features/quick-request/lib/place-search';
import {
  QUICK_PLACE_FETCH_TIMEOUT_MS,
  QUICK_PLACE_PAGE_SIZE,
  QUICK_PLACE_RATE_LIMIT_PER_MINUTE
} from '@/features/quick-request/schemas/quick-request-place';

/**
 * plan 99 — 카카오 로컬 키워드 검색 서버 프록시 (키는 서버 env 전용 · 브라우저 노출 금지).
 * - 실호출: `GET https://dapi.kakao.com/v2/local/search/keyword.json` · `Authorization: KakaoAK {key}` · timeout 4초
 * - mock: `E2E_KAKAO_PLACES_MOCK=1` → 외부 fetch 계층만 `e2e/fixtures/kakao-places.json`으로 대체 (재검색·정규화는 동일 경로)
 * - 미설정 강제: `E2E_KAKAO_PLACES_UNCONFIGURED=1`
 * 검색어·키는 로그에 남기지 않는다 (실패 시 status만).
 */

const KAKAO_KEYWORD_ENDPOINT = 'https://dapi.kakao.com/v2/local/search/keyword.json';

function isMockMode(): boolean {
  return process.env.E2E_KAKAO_PLACES_MOCK === '1';
}

function readApiKey(): string | undefined {
  return process.env.KAKAO_REST_API_KEY?.trim() || undefined;
}

/** 요청 페이지 서버 컴포넌트(탭 노출)와 Route(503)가 같이 쓴다 */
export function isPlaceSearchConfigured(): boolean {
  return resolvePlaceSearchConfigured({
    forceUnconfigured: process.env.E2E_KAKAO_PLACES_UNCONFIGURED === '1',
    mock: isMockMode(),
    apiKey: process.env.KAKAO_REST_API_KEY
  });
}

/** 사용자당 분당 30회 (모듈 메모리 · 서버리스 인스턴스별 근사치) */
const placeSearchRateLimiter = createFixedWindowRateLimiter({
  limit: QUICK_PLACE_RATE_LIMIT_PER_MINUTE,
  windowMs: 60_000
});

/** 허용이면 true. Route 요청 1회 = 1회 (내부 재검색은 세지 않는다) */
export function consumePlaceSearchQuota(userId: string): boolean {
  return placeSearchRateLimiter.consume(userId);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

const fetchKakaoKeyword: KakaoKeywordFetcher = async (query, page, size) => {
  const apiKey = readApiKey();
  if (!apiKey) return { ok: false, status: 'invalid_response' };

  const params = new URLSearchParams({ query, page: String(page), size: String(size) });
  let response: Response;
  try {
    response = await fetch(`${KAKAO_KEYWORD_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(QUICK_PLACE_FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    return { ok: false, status: isAbortError(error) ? 'timeout' : 'network' };
  }

  if (!response.ok) {
    // 본문은 읽지 않는다 (오류 본문에 검색어가 섞일 수 있어 로그 대상 아님)
    response.body?.cancel().catch(() => undefined);
    return { ok: false, status: response.status };
  }

  try {
    const parsed = parseKakaoKeywordResponse(await response.json());
    return parsed ? { ok: true, data: parsed } : { ok: false, status: 'invalid_response' };
  } catch (error) {
    return { ok: false, status: isAbortError(error) ? 'timeout' : 'invalid_response' };
  }
};

let mockFetcherPromise: Promise<KakaoKeywordFetcher> | null = null;

function getMockFetcher(): Promise<KakaoKeywordFetcher> {
  mockFetcherPromise ??= import('../../../../e2e/fixtures/kakao-places.json').then((mod) =>
    createKakaoMockFetcher((mod.default ?? mod) as KakaoPlacesMockFixture)
  );
  return mockFetcherPromise;
}

/**
 * 검색 1회 (0건 + 단어 2개 이상이면 뒤집어 같은 page 1회 재검색 포함).
 * 실패(HTTP 4xx/5xx·429·timeout·형식 오류)는 `{ok:false, status}` → Route가 502.
 */
export async function searchQuickRequestPlaces(query: string, page: number): Promise<PlaceSearchResult> {
  const fetcher = isMockMode() ? await getMockFetcher() : fetchKakaoKeyword;
  return searchPlacesWithReverseRetry(fetcher, query, page, QUICK_PLACE_PAGE_SIZE);
}
