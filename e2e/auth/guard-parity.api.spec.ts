import { expect, test, request as playwrightRequest } from '@playwright/test';
import { e2eBaseURL } from '../helpers/auth-request';

/**
 * plan 92 AC-27 (dev 측) — 루트 가드 `src/proxy.ts` 통합 후 `npm run dev`에서 3값이 운영 빌드와 같은지.
 * `next start` 측 3값은 verifier가 CLI(curl)로 같은 값을 확인한다.
 * - (1) 쿠키 없이 GET /api/zzz-none → 401 (404 아님: 가드가 Route보다 먼저 막는다)
 * - (2) user.json GET /dashboard/users (redirect 미추적) → 307
 * - (3) dongbang.json GET /api/users → 403 DONGBANG_FORBIDDEN_JSON
 * project `guard-parity-api`(setup-user · setup-dongbang 의존)
 */
const DONGBANG_FORBIDDEN_JSON = { success: false, message: '접근 권한이 없습니다.' };

test.describe('plan 92 E. 가드 parity (dev)', () => {
  test('AC-27 (1): 쿠키 없음 GET /api/zzz-none → 401', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: e2eBaseURL,
      storageState: { cookies: [], origins: [] }
    });
    try {
      const response = await api.get('/api/zzz-none');
      expect(response.status()).toBe(401);
    } finally {
      await api.dispose();
    }
  });

  test('AC-27 (2): user.json GET /dashboard/users → 307 (200 아님)', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: e2eBaseURL,
      storageState: 'e2e/.auth/user.json'
    });
    try {
      const response = await api.get('/dashboard/users', { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers().location, 'redirect 대상').toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test('AC-27 (3): dongbang.json GET /api/users → 403 DONGBANG_FORBIDDEN_JSON', async () => {
    const api = await playwrightRequest.newContext({
      baseURL: e2eBaseURL,
      storageState: 'e2e/.auth/dongbang.json'
    });
    try {
      const response = await api.get('/api/users');
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual(DONGBANG_FORBIDDEN_JSON);
    } finally {
      await api.dispose();
    }
  });
});
