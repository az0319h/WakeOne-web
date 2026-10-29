/**
 * plan 99 — 「장소 검색」 순수 로직 (외부 장소 키워드 검색 응답 정규화 · 단어 순서 재검색 · 설정 우선순위 · 분당 제한 · mock fetcher).
 * 실제 HTTP 호출·키·`server-only`는 `api/places.server.ts`에만 있다 (plan AC-11 grep 대상 아님).
 * 이 파일은 path alias(`@/…`)·런타임 상대 import를 쓰지 않는다 — `node --test`에서 직접 불러 쓰기 위함.
 */

import type { QuickRequestPlace, QuickRequestPlacesPage } from '../api/types';

// ---------------------------------------------------------------------------
// 외부 응답 형태 (카카오 로컬 키워드 검색)
// ---------------------------------------------------------------------------

export type KakaoKeywordDocument = {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  phone: string;
  category_name: string;
};

export type KakaoKeywordMeta = {
  total_count: number;
  pageable_count: number;
  is_end: boolean;
};

export type KakaoKeywordResponse = {
  documents: KakaoKeywordDocument[];
  meta: KakaoKeywordMeta;
};

/** 외부 호출 1회 결과. 실패 status: HTTP 코드 · `timeout` · `network` · `invalid_response` */
export type KakaoKeywordFetchResult =
  | { ok: true; data: KakaoKeywordResponse }
  | { ok: false; status: number | 'timeout' | 'network' | 'invalid_response' };

/** (검색어, page, size) → 결과. 실호출·mock이 같은 인터페이스를 쓴다 */
export type KakaoKeywordFetcher = (query: string, page: number, size: number) => Promise<KakaoKeywordFetchResult>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/** JSON 본문 → 외부 응답 형태. documents/meta가 없으면 null(→ 502) */
export function parseKakaoKeywordResponse(body: unknown): KakaoKeywordResponse | null {
  if (!isRecord(body) || !Array.isArray(body.documents) || !isRecord(body.meta)) return null;
  const meta = body.meta;
  if (typeof meta.total_count !== 'number' || typeof meta.is_end !== 'boolean') return null;

  const documents: KakaoKeywordDocument[] = [];
  for (const raw of body.documents) {
    if (!isRecord(raw)) continue;
    const id = asString(raw.id);
    const placeName = asString(raw.place_name).trim();
    const addressName = asString(raw.address_name).trim();
    const roadAddressName = asString(raw.road_address_name).trim();
    // 주소가 하나도 없는 행은 고를 수 없으므로 버린다
    if (!id || !placeName || (!addressName && !roadAddressName)) continue;
    documents.push({
      id,
      place_name: placeName,
      road_address_name: roadAddressName,
      address_name: addressName,
      phone: asString(raw.phone).trim(),
      category_name: asString(raw.category_name)
    });
  }

  return {
    documents,
    meta: {
      total_count: meta.total_count,
      pageable_count: typeof meta.pageable_count === 'number' ? meta.pageable_count : meta.total_count,
      is_end: meta.is_end
    }
  };
}

// ---------------------------------------------------------------------------
// 정규화
// ---------------------------------------------------------------------------

/** `음식점 > 카페 > 커피전문점` → `커피전문점` · 빈값 null */
export function lastCategorySegment(categoryName: string): string | null {
  const segments = categoryName
    .split('>')
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.at(-1) ?? null;
}

export function normalizeKakaoPlace(document: KakaoKeywordDocument): QuickRequestPlace {
  const roadAddress = document.road_address_name.trim() || null;
  return {
    id: document.id,
    name: document.place_name.trim(),
    roadAddress,
    // 지번이 비어 있는 드문 경우 도로명으로 채워 `address`는 항상 문자열
    address: document.address_name.trim() || roadAddress || '',
    phone: document.phone.trim() || null,
    category: lastCategorySegment(document.category_name)
  };
}

export function toQuickRequestPlacesPage(
  response: KakaoKeywordResponse,
  page: number,
  matchedQuery: string | null
): QuickRequestPlacesPage {
  return {
    places: response.documents.map(normalizeKakaoPlace),
    isEnd: response.meta.is_end,
    total: response.meta.pageable_count,
    page,
    matchedQuery
  };
}

// ---------------------------------------------------------------------------
// 0건 → 단어 순서 뒤집어 1회 재검색 (designer K10 · §5-2)
// ---------------------------------------------------------------------------

/** 띄어쓰기 단위 2개 이상이면 순서를 뒤집은 검색어 · 아니면(또는 뒤집어도 같으면) null */
export function buildReversedQuery(query: string): string | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const reversed = [...tokens].reverse().join(' ');
  return reversed === tokens.join(' ') ? null : reversed;
}

export type PlaceSearchResult =
  | { ok: true; data: QuickRequestPlacesPage }
  | { ok: false; status: Exclude<KakaoKeywordFetchResult, { ok: true }>['status'] };

/**
 * 1차 검색 → `meta.total_count === 0`이고 단어 2개 이상이면 뒤집은 검색어로 **같은 page**를 1회 재호출.
 * 재호출에서 1건 이상이면 그 결과 + `matchedQuery`. 0건이면 빈 결과 + `matchedQuery: null`.
 * 1차가 실패(timeout·HTTP 오류)면 재호출 없이 실패. 재호출 실패도 실패(→ 502).
 */
export async function searchPlacesWithReverseRetry(
  fetcher: KakaoKeywordFetcher,
  query: string,
  page: number,
  size: number
): Promise<PlaceSearchResult> {
  const first = await fetcher(query, page, size);
  if (!first.ok) return first;

  if (first.data.meta.total_count === 0) {
    const reversed = buildReversedQuery(query);
    if (reversed) {
      const second = await fetcher(reversed, page, size);
      if (!second.ok) return second;
      if (second.data.meta.total_count > 0) {
        return { ok: true, data: toQuickRequestPlacesPage(second.data, page, reversed) };
      }
    }
  }

  return { ok: true, data: toQuickRequestPlacesPage(first.data, page, null) };
}

// ---------------------------------------------------------------------------
// 설정 우선순위 (designer §5-3)
// ---------------------------------------------------------------------------

/** ① 미설정 강제(E2E) → false ② mock → true(키 없어도) ③ 키(trim) 존재 여부 */
export function resolvePlaceSearchConfigured(input: {
  forceUnconfigured: boolean;
  mock: boolean;
  apiKey: string | undefined;
}): boolean {
  if (input.forceUnconfigured) return false;
  if (input.mock) return true;
  return Boolean(input.apiKey?.trim());
}

// ---------------------------------------------------------------------------
// 사용자당 분당 제한 (고정 창 · 모듈 메모리 · 서버 인스턴스별 근사치)
// ---------------------------------------------------------------------------

export type FixedWindowRateLimiter = {
  /** 허용이면 true(카운트 +1) · 초과면 false(카운트 변화 없음) */
  consume: (key: string) => boolean;
  /** 테스트용 */
  size: () => number;
};

export function createFixedWindowRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
  /** 이 개수를 넘으면 만료된 창을 정리한다 */
  pruneThreshold?: number;
}): FixedWindowRateLimiter {
  const now = options.now ?? Date.now;
  const pruneThreshold = options.pruneThreshold ?? 1_000;
  const windows = new Map<string, { count: number; windowStart: number }>();

  function prune(current: number) {
    for (const [key, entry] of windows) {
      if (current - entry.windowStart >= options.windowMs) windows.delete(key);
    }
  }

  return {
    consume(key) {
      const current = now();
      const entry = windows.get(key);
      if (!entry || current - entry.windowStart >= options.windowMs) {
        if (!entry && windows.size >= pruneThreshold) prune(current);
        windows.set(key, { count: 1, windowStart: current });
        return true;
      }
      if (entry.count >= options.limit) return false;
      entry.count += 1;
      return true;
    },
    size: () => windows.size
  };
}

// ---------------------------------------------------------------------------
// E2E mock fetcher (`e2e/fixtures/kakao-places.json` · 외부 fetch 계층만 대체)
// ---------------------------------------------------------------------------

type MockDocumentInput = Partial<KakaoKeywordDocument> & { id: string; place_name: string };

export type KakaoPlacesMockEntry =
  | { status: number }
  | {
      documents?: MockDocumentInput[];
      /** 같은 모양의 행을 n건 만든다 (「많은」) */
      generate?: { count: number; namePrefix: string };
      /** meta 덮어쓰기 (기본: total = 문서 수 · pageable = min(total, 45)) */
      meta?: Partial<Pick<KakaoKeywordMeta, 'total_count' | 'pageable_count'>>;
    };

export type KakaoPlacesMockFixture = { queries: Record<string, KakaoPlacesMockEntry> };

const MOCK_PAGEABLE_CAP = 45;

function toMockDocument(input: MockDocumentInput): KakaoKeywordDocument {
  return {
    id: input.id,
    place_name: input.place_name,
    road_address_name: input.road_address_name ?? '',
    address_name: input.address_name ?? '',
    phone: input.phone ?? '',
    category_name: input.category_name ?? ''
  };
}

function generateMockDocuments(count: number, namePrefix: string): KakaoKeywordDocument[] {
  return Array.from({ length: count }, (_, index) => {
    const no = index + 1;
    return {
      id: `mock-many-${no}`,
      place_name: `${namePrefix} ${no}`,
      road_address_name: `서울 종로구 테스트로 ${no}`,
      address_name: `서울 종로구 테스트동 ${no}`,
      phone: '',
      category_name: '음식점 > 카페'
    };
  });
}

/**
 * fixture 키는 **trim 후 정확 일치**. 없는 검색어는 0건. `{status}` 항목은 그 HTTP 코드로 실패(→ Route 502).
 * page/size로 잘라 외부 API처럼 `is_end = page*size >= pageable_count`.
 */
export function createKakaoMockFetcher(fixture: KakaoPlacesMockFixture): KakaoKeywordFetcher {
  return async (query, page, size) => {
    const entry = Object.hasOwn(fixture.queries, query.trim()) ? fixture.queries[query.trim()] : undefined;
    if (entry && 'status' in entry) {
      return { ok: false, status: entry.status };
    }

    const all = [
      ...(entry?.documents ?? []).map(toMockDocument),
      ...(entry?.generate ? generateMockDocuments(entry.generate.count, entry.generate.namePrefix) : [])
    ];
    const totalCount = entry?.meta?.total_count ?? all.length;
    const pageableCount = entry?.meta?.pageable_count ?? Math.min(totalCount, MOCK_PAGEABLE_CAP);
    const start = (page - 1) * size;

    return {
      ok: true,
      data: {
        documents: all.slice(start, start + size),
        meta: { total_count: totalCount, pageable_count: pageableCount, is_end: page * size >= pageableCount }
      }
    };
  };
}
