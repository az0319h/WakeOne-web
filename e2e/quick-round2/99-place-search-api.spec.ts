import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test';
import { createActiveTestUser, signInWithSupabasePassword } from '../helpers/supabase-direct-auth';
import { AUTH, BASE_URL } from '../quick-workflow/helpers';
import { expectPlacesMockServer, ikseonDocs, isUnconfiguredRun, lastCategory, PLACE_TEXT, PLACES_PATH } from './99-helpers';

/**
 * plan 99 — 「장소 검색」 Route API (AC-08 · AC-09)
 * docs/plans/99_quick-place-keyword-search-plan.md
 * - `GET /api/quick-request/places?q=&page=` · 서버 `E2E_KAKAO_PLACES_MOCK=1`
 * - AC-08: user.json · 비로그인 · dongbang.json(setup-dongbang이 매 run 재생성)
 *   401·동방 403은 proxy가 Route보다 먼저 응답 → `x-request-id`는 Route까지 오는 200/400에만 단언(BE handoff §2)
 * - AC-09: 분당 30회 제한은 사용자·서버 메모리 단위 → 매 run 새 일회용 계정(example.com · `E2E ` 이름 → cleanup 삭제)으로
 *   「정확히 31번째 429」를 단언한다 (같은 user.json을 쓰는 다른 spec과 창이 겹치지 않게)
 */
type PlacesBody = {
  success?: boolean;
  message?: string;
  data?: {
    places: { id: string; name: string; roadAddress: string | null; address: string; phone: string | null; category: string | null }[];
    isEnd: boolean;
    total: number;
    page: number;
    matchedQuery: string | null;
  };
};

async function getPlaces(api: APIRequestContext, query: string) {
  const response = await api.get(`${PLACES_PATH}${query}`);
  const text = await response.text();
  let body: PlacesBody = {};
  try {
    body = JSON.parse(text) as PlacesBody;
  } catch {
    body = { message: text };
  }
  return { status: response.status(), body, requestId: response.headers()['x-request-id'] };
}

const q = (value: string, page?: string) =>
  `?q=${encodeURIComponent(value)}${page === undefined ? '' : `&page=${encodeURIComponent(page)}`}`;

test.describe('plan 99 B. 장소 검색 Route API', () => {
  test.skip(isUnconfiguredRun(), '미설정 서버 run에서는 99-place-search-unconfigured.spec.ts만 판정');
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    await expectPlacesMockServer();
  });

  test('AC-08: user.json — q=익선 200 {places:[2], isEnd, total} · x-request-id · 정규화(도로명 null·전화 null·카테고리 끝)', async () => {
    const [road, jibun] = ikseonDocs();
    const api = await playwrightRequest.newContext({ baseURL: BASE_URL, storageState: AUTH.user });
    try {
      const result = await getPlaces(api, q('익선'));
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.requestId).toBeTruthy();
      expect(result.body.success).toBe(true);
      const data = result.body.data!;
      expect(data.places).toHaveLength(2);
      expect(data.isEnd).toBe(true);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
      expect(data.matchedQuery).toBeNull();
      expect(data.places[0]).toEqual({
        id: road.id,
        name: road.place_name,
        roadAddress: road.road_address_name,
        address: road.address_name,
        phone: road.phone,
        category: lastCategory(road.category_name)
      });
      expect(data.places[1]).toEqual({
        id: jibun.id,
        name: jibun.place_name,
        roadAddress: null,
        address: jibun.address_name,
        phone: null,
        category: lastCategory(jibun.category_name)
      });
    } finally {
      await api.dispose();
    }
  });

  test('AC-08: user.json — q 빈값·누락·공백 400 「검색어를 입력해 주세요.」 · 51자 400 「검색어는 50자 이내로…」 · page=4/0/1.5 400 · x-request-id', async () => {
    const api = await playwrightRequest.newContext({ baseURL: BASE_URL, storageState: AUTH.user });
    try {
      for (const query of ['?q=', '', `?q=${encodeURIComponent('   ')}`]) {
        const result = await getPlaces(api, query);
        expect(result.status, `${PLACES_PATH}${query}`).toBe(400);
        expect(result.body).toEqual({ success: false, message: PLACE_TEXT.queryRequired });
        expect(result.requestId, `${query} x-request-id`).toBeTruthy();
      }

      const tooLong = await getPlaces(api, q('가'.repeat(51)));
      expect(tooLong.status).toBe(400);
      expect(tooLong.body.message).toBe(PLACE_TEXT.queryTooLong);
      expect(tooLong.body.message!.startsWith('검색어는 50자 이내로')).toBe(true);
      expect(tooLong.requestId).toBeTruthy();

      // 50자는 허용 (경계) — fixture에 없는 검색어 → 200 · 0건
      const fifty = await getPlaces(api, q('가'.repeat(50)));
      expect(fifty.status).toBe(200);
      expect(fifty.body.data?.places).toEqual([]);

      for (const page of ['4', '0', '1.5', 'abc']) {
        const result = await getPlaces(api, q('익선', page));
        expect(result.status, `page=${page}`).toBe(400);
        expect(result.body.success).toBe(false);
        expect(result.body.message, `page=${page}`).toBe(PLACE_TEXT.invalidRequest);
        expect(result.requestId).toBeTruthy();
      }
    } finally {
      await api.dispose();
    }
  });

  test('AC-08: 비로그인 401 · dongbang.json 403 「접근 권한이 없습니다.」(proxy allowlist)', async () => {
    // project `use.storageState`(user.json)를 물려받지 않도록 빈 storageState를 명시한다
    const anonymous = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      storageState: { cookies: [], origins: [] }
    });
    try {
      const result = await getPlaces(anonymous, q('익선'));
      expect(result.status).toBe(401);
      expect(result.body.success).toBe(false);
      expect(result.body.message).toBe(PLACE_TEXT.unauthorized);
    } finally {
      await anonymous.dispose();
    }

    const dongbang = await playwrightRequest.newContext({ baseURL: BASE_URL, storageState: AUTH.dongbang });
    try {
      // 동방 세션이 살아 있는지 먼저 확인 (만료면 401로 오판하지 않게) — 동방 허용 API
      const me = await dongbang.get('/api/quick-request/unread-total');
      expect(me.status(), 'dongbang 세션 (setup-dongbang) · 동방 허용 API').toBe(200);

      const result = await getPlaces(dongbang, q('익선'));
      expect(result.status, JSON.stringify(result.body)).toBe(403);
      expect(result.body.success).toBe(false);
      expect(result.body.message).toBe(PLACE_TEXT.forbidden);
    } finally {
      await dongbang.dispose();
    }
  });

  test('AC-09: 같은 세션 1분 안 31회 호출 → 1~30번째 200 · 31번째 429 「잠시 후 다시 시도해 주세요.」 (400은 세지 않음)', async () => {
    const fresh = await createActiveTestUser('quick-p99-ac09', { fullName: `E2E 장소검색제한 ${Date.now()}` });
    const { storageState } = await signInWithSupabasePassword(fresh.email, fresh.password);
    const api = await playwrightRequest.newContext({ baseURL: BASE_URL, storageState });
    try {
      // 검증 실패(400)는 한도에 들어가지 않는다 (BE: 검증 뒤에 센다)
      const invalid = await getPlaces(api, '?q=');
      expect(invalid.status).toBe(400);

      const startedAt = Date.now();
      const statuses: number[] = [];
      for (let i = 1; i <= 30; i += 1) {
        const result = await getPlaces(api, q('없는장소'));
        statuses.push(result.status);
      }
      expect(statuses, '1~30번째').toEqual(Array.from({ length: 30 }, () => 200));

      const thirtyFirst = await getPlaces(api, q('없는장소'));
      const elapsed = Date.now() - startedAt;
      expect(elapsed, '31회가 1분 창 안에서 끝나야 한다').toBeLessThan(60_000);
      expect(thirtyFirst.status, '31번째').toBe(429);
      expect(thirtyFirst.body).toEqual({ success: false, message: PLACE_TEXT.rateLimited });
      expect(thirtyFirst.requestId).toBeTruthy();

      // 창이 끝나기 전에는 계속 429
      const thirtySecond = await getPlaces(api, q('익선'));
      expect(thirtySecond.status, '32번째').toBe(429);
    } finally {
      await api.dispose();
    }
  });
});
