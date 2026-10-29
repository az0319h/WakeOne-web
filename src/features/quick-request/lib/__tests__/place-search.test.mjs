import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fixture from '../../../../../e2e/fixtures/kakao-places.json' with { type: 'json' };
import {
  buildReversedQuery,
  createFixedWindowRateLimiter,
  createKakaoMockFetcher,
  lastCategorySegment,
  normalizeKakaoPlace,
  parseKakaoKeywordResponse,
  resolvePlaceSearchConfigured,
  searchPlacesWithReverseRetry
} from '../place-search.ts';
import {
  parseQuickPlaceSearchParams,
  QUICK_PLACE_MESSAGES
} from '../../schemas/quick-request-place.ts';

/**
 * plan 99 — 실행: `node --test src/features/quick-request/lib/__tests__/place-search.test.mjs`
 */

const doc = (overrides = {}) => ({
  id: '1',
  place_name: '산스',
  road_address_name: '서울 종로구 수표로28길 30',
  address_name: '서울 종로구 익선동 40',
  phone: '070-7779-1806',
  category_name: '음식점 > 카페',
  ...overrides
});

const ok = (documents, total = documents.length) => ({
  ok: true,
  data: { documents, meta: { total_count: total, pageable_count: Math.min(total, 45), is_end: true } }
});

describe('정규화', () => {
  it('카테고리 마지막 세그먼트 · 빈값 null', () => {
    assert.equal(lastCategorySegment('음식점 > 카페 > 커피전문점'), '커피전문점');
    assert.equal(lastCategorySegment('카페'), '카페');
    assert.equal(lastCategorySegment(''), null);
    assert.equal(lastCategorySegment(' > '), null);
  });

  it('도로명·전화 빈 문자열 → null', () => {
    assert.deepEqual(normalizeKakaoPlace(doc({ road_address_name: '', phone: '' })), {
      id: '1',
      name: '산스',
      roadAddress: null,
      address: '서울 종로구 익선동 40',
      phone: null,
      category: '카페'
    });
  });

  it('정상 행', () => {
    const place = normalizeKakaoPlace(doc());
    assert.equal(place.roadAddress, '서울 종로구 수표로28길 30');
    assert.equal(place.phone, '070-7779-1806');
  });

  it('응답 파싱 — 형식 오류 null · 주소 없는 행 제외 · pageable 누락 시 total', () => {
    assert.equal(parseKakaoKeywordResponse(null), null);
    assert.equal(parseKakaoKeywordResponse({ documents: [] }), null);
    assert.equal(parseKakaoKeywordResponse({ documents: [], meta: { is_end: true } }), null);
    const parsed = parseKakaoKeywordResponse({
      documents: [doc(), doc({ id: '2', road_address_name: '', address_name: '' }), 'x'],
      meta: { total_count: 2, is_end: true }
    });
    assert.equal(parsed.documents.length, 1);
    assert.equal(parsed.meta.pageable_count, 2);
  });
});

describe('단어 순서 재검색', () => {
  it('buildReversedQuery', () => {
    assert.equal(buildReversedQuery('익선 산스'), '산스 익선');
    assert.equal(buildReversedQuery('  a   b  c '), 'c b a');
    assert.equal(buildReversedQuery('익선'), null);
    assert.equal(buildReversedQuery('a a'), null);
  });

  it('0건 + 2단어 → 뒤집어 같은 page 1회 · matchedQuery', async () => {
    const calls = [];
    const fetcher = async (q, page, size) => {
      calls.push([q, page, size]);
      return q === '산스 익선' ? ok([doc()]) : ok([]);
    };
    const result = await searchPlacesWithReverseRetry(fetcher, '익선 산스', 2, 15);
    assert.deepEqual(calls, [
      ['익선 산스', 2, 15],
      ['산스 익선', 2, 15]
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.data.matchedQuery, '산스 익선');
    assert.equal(result.data.page, 2);
    assert.equal(result.data.places[0].name, '산스');
  });

  it('재검색도 0건 → 빈 결과 · matchedQuery null', async () => {
    let count = 0;
    const result = await searchPlacesWithReverseRetry(async () => (count++, ok([])), '없는 장소', 1, 15);
    assert.equal(count, 2);
    assert.deepEqual(result, {
      ok: true,
      data: { places: [], isEnd: true, total: 0, page: 1, matchedQuery: null }
    });
  });

  it('1단어 0건 · 1건 이상이면 재검색 없음', async () => {
    let count = 0;
    await searchPlacesWithReverseRetry(async () => (count++, ok([])), '없는장소', 1, 15);
    assert.equal(count, 1);
    count = 0;
    const result = await searchPlacesWithReverseRetry(async () => (count++, ok([doc()])), '산스 익선', 1, 15);
    assert.equal(count, 1);
    assert.equal(result.data.matchedQuery, null);
  });

  it('1차 실패 → 재검색 없이 실패 · 재검색 실패도 실패', async () => {
    let count = 0;
    const failed = await searchPlacesWithReverseRetry(
      async () => (count++, { ok: false, status: 'timeout' }),
      '익선 산스',
      1,
      15
    );
    assert.equal(count, 1);
    assert.deepEqual(failed, { ok: false, status: 'timeout' });

    const second = await searchPlacesWithReverseRetry(
      async (q) => (q === '익선 산스' ? ok([]) : { ok: false, status: 429 }),
      '익선 산스',
      1,
      15
    );
    assert.deepEqual(second, { ok: false, status: 429 });
  });
});

describe('설정 우선순위', () => {
  it('미설정 강제 > mock > 키', () => {
    assert.equal(resolvePlaceSearchConfigured({ forceUnconfigured: true, mock: true, apiKey: 'k' }), false);
    assert.equal(resolvePlaceSearchConfigured({ forceUnconfigured: false, mock: true, apiKey: undefined }), true);
    assert.equal(resolvePlaceSearchConfigured({ forceUnconfigured: false, mock: false, apiKey: 'k' }), true);
    assert.equal(resolvePlaceSearchConfigured({ forceUnconfigured: false, mock: false, apiKey: '  ' }), false);
    assert.equal(resolvePlaceSearchConfigured({ forceUnconfigured: false, mock: false, apiKey: undefined }), false);
  });
});

describe('분당 제한', () => {
  it('30회 허용 · 31번째 거부 · 창이 지나면 초기화 · 사용자별', () => {
    let now = 0;
    const limiter = createFixedWindowRateLimiter({ limit: 30, windowMs: 60_000, now: () => now });
    for (let i = 0; i < 30; i++) assert.equal(limiter.consume('u1'), true);
    assert.equal(limiter.consume('u1'), false);
    assert.equal(limiter.consume('u2'), true);
    now = 59_999;
    assert.equal(limiter.consume('u1'), false);
    now = 60_000;
    assert.equal(limiter.consume('u1'), true);
  });

  it('만료 창 정리', () => {
    let now = 0;
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 1_000, now: () => now, pruneThreshold: 2 });
    limiter.consume('a');
    limiter.consume('b');
    now = 5_000;
    limiter.consume('c');
    assert.equal(limiter.size(), 1);
  });
});

describe('mock fixture (e2e/fixtures/kakao-places.json)', () => {
  const fetcher = createKakaoMockFetcher(fixture);

  it('익선 2건 · [1] 도로명 없음', async () => {
    const result = await searchPlacesWithReverseRetry(fetcher, '익선', 1, 15);
    assert.equal(result.data.places.length, 2);
    assert.equal(result.data.places[1].roadAddress, null);
    assert.equal(result.data.places[1].phone, null);
    assert.equal(result.data.isEnd, true);
  });

  it('익선 산스 → 산스 익선 재검색', async () => {
    const result = await searchPlacesWithReverseRetry(fetcher, ' 익선 산스 ', 1, 15);
    assert.equal(result.data.matchedQuery, '산스 익선');
    assert.equal(result.data.places[0].roadAddress, '서울 종로구 수표로28길 30');
  });

  it('없는장소 0건 · 에러 실패 · 그 외 0건', async () => {
    assert.equal((await searchPlacesWithReverseRetry(fetcher, '없는장소', 1, 15)).data.places.length, 0);
    assert.deepEqual(await searchPlacesWithReverseRetry(fetcher, '에러', 1, 15), { ok: false, status: 500 });
    assert.equal((await searchPlacesWithReverseRetry(fetcher, 'constructor', 1, 15)).data.total, 0);
  });

  it('많은 — page 1~3 각 15건 · page 3도 isEnd false', async () => {
    for (const page of [1, 2, 3]) {
      const result = await searchPlacesWithReverseRetry(fetcher, '많은', page, 15);
      assert.equal(result.data.places.length, 15);
      assert.equal(result.data.isEnd, false);
      assert.equal(result.data.page, page);
    }
  });
});

describe('검색 파라미터', () => {
  const parse = (query) => parseQuickPlaceSearchParams(new URLSearchParams(query));

  it('정상 · page 기본 1 · trim', () => {
    assert.deepEqual(parse('q=%20익선%20'), { ok: true, data: { q: '익선', page: 1 } });
    assert.deepEqual(parse('q=익선&page=3'), { ok: true, data: { q: '익선', page: 3 } });
    assert.deepEqual(parse('q=익'), { ok: true, data: { q: '익', page: 1 } });
  });

  it('400 문구', () => {
    assert.deepEqual(parse(''), { ok: false, message: QUICK_PLACE_MESSAGES.queryRequired });
    assert.deepEqual(parse('q=%20%20'), { ok: false, message: QUICK_PLACE_MESSAGES.queryRequired });
    assert.deepEqual(parse(`q=${'가'.repeat(51)}`), { ok: false, message: QUICK_PLACE_MESSAGES.queryTooLong });
    assert.equal(parse(`q=${'가'.repeat(50)}`).ok, true);
    for (const page of ['0', '4', '1.5', 'a', '', '01']) {
      assert.deepEqual(parse(`q=익선&page=${page}`), { ok: false, message: QUICK_PLACE_MESSAGES.invalidRequest });
    }
  });
});
