import { expect, test } from '@playwright/test';
import {
  buildCreateBody,
  callAs,
  createAs,
  findActivityLog,
  seedQuickRequest,
  uniqueTag,
  withApi
} from '../quick-workflow/helpers';
import { TEXT, withPage } from './helpers';

/**
 * plan 106 §C AC-27(API · 등록 날짜 검사) · §F AC-52(활동 로그) — docs/plans/106_quick-mobile-restructure-plan.md
 * 등록 성공 건은 담당자 `E2E 출발담당`(buildCreateBody) 표식 → scripts/cleanup-e2e-mock-data.mjs가 지운다.
 */
type ValidationError = { path: string; message: string };

function isoAfter(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function normalizeErrors(raw: unknown): ValidationError[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      const row = item as { path?: string | string[]; field?: string; message?: string };
      const path = Array.isArray(row.path) ? row.path.join('.') : (row.path ?? row.field ?? '');
      return { path, message: row.message ?? '' };
    });
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).flatMap(([path, value]) =>
      (Array.isArray(value) ? value : [value]).map((message) => ({ path, message: String(message) }))
    );
  }
  return [];
}

function scheduledBody(tag: string, origin: string | null, destination: string | null) {
  const base = buildCreateBody(tag);
  return {
    ...base,
    origin: { ...base.origin, schedule: origin ? { mode: 'scheduled', datetimeIso: origin } : { mode: 'immediate' } },
    destination: {
      ...base.destination,
      schedule: destination ? { mode: 'scheduled', datetimeIso: destination } : { mode: 'asap' }
    }
  };
}

test.describe('plan 106 AC-27 · AC-52 등록 날짜 검사 API · 활동 로그', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  const state = { pastRequestId: '', pastMessage: '', cancelledNo: '' };

  test('AC-27: ① 픽업 과거 400 origin.schedule ② 도착 < 픽업 400 destination.schedule ③ 픽업 −3분 201 ④ dongbang PATCH 과거 200', async () => {
    const tag = uniqueTag('E2E106B');

    // ①
    const past = await callAs('user', (api) =>
      api.post('/api/quick-request', { data: scheduledBody(tag, isoAfter(-60), null) })
    );
    expect(past.status, JSON.stringify(past.body)).toBe(400);
    expect(past.headers['x-request-id']).toBeTruthy();
    state.pastRequestId = past.headers['x-request-id'];
    state.pastMessage = String(past.body.message ?? '');
    expect(state.pastMessage).toMatch(/입력값|확인/);
    const pastErrors = normalizeErrors(past.body.errors);
    expect(pastErrors, JSON.stringify(past.body)).toContainEqual({ path: 'origin.schedule', message: TEXT.originPast });

    // ②
    const order = await callAs('user', (api) =>
      api.post('/api/quick-request', { data: scheduledBody(tag, isoAfter(120), isoAfter(60)) })
    );
    expect(order.status, JSON.stringify(order.body)).toBe(400);
    expect(order.headers['x-request-id']).toBeTruthy();
    expect(normalizeErrors(order.body.errors), JSON.stringify(order.body)).toContainEqual({
      path: 'destination.schedule',
      message: TEXT.destinationBeforeOrigin
    });

    // 도착만 과거 (D-11 ③ 서버 문구)
    const destPast = await callAs('user', (api) =>
      api.post('/api/quick-request', { data: scheduledBody(tag, null, isoAfter(-60)) })
    );
    expect(destPast.status).toBe(400);
    expect(normalizeErrors(destPast.body.errors)).toContainEqual({ path: 'destination.schedule', message: TEXT.destinationPast });

    // ③ 5분 여유 안
    const grace = await callAs('user', (api) =>
      api.post('/api/quick-request', { data: scheduledBody(tag, isoAfter(-3), null) })
    );
    expect(grace.status, JSON.stringify(grace.body)).toBe(201);
    expect(grace.headers['x-request-id']).toBeTruthy();

    // ④ 수정은 지난 시각 허용
    const target = await seedQuickRequest('dispatching', 'user', tag);
    const base = buildCreateBody(tag);
    const patch = await callAs('dongbang', (api) =>
      api.patch(`/api/quick-request/${target.requestNo}`, {
        data: { origin: { ...base.origin, schedule: { mode: 'scheduled', datetimeIso: isoAfter(-24 * 60) } } }
      })
    );
    expect(patch.status, JSON.stringify(patch.body)).toBe(200);
    expect(patch.headers['x-request-id']).toBeTruthy();
  });

  test('AC-52: 활동 로그 — 「퀵 요청 등록」 400 행(validation · schedule 경로) · 「퀵 요청 취소」 성공 행 · /dashboard/logs 표시 · 신규 action 0', async ({
    browser
  }) => {
    test.skip(!state.pastRequestId, 'AC-27 ① 선행 필요');
    const failed = await findActivityLog(
      'quick_request.create',
      (item) => item.request_id === state.pastRequestId && item.http_status === 400,
      `quick_request.create 400 ${state.pastRequestId}`
    );
    const metadata = failed.metadata ?? {};
    expect(metadata.error_code, JSON.stringify(metadata)).toBe('validation');
    expect(JSON.stringify(metadata.validation_errors ?? metadata), 'validation_errors에 schedule 경로').toContain('origin.schedule');

    // AC-49와 같은 취소 흐름(API) → 성공 행
    const created = await createAs('user', uniqueTag('E2E106L'));
    state.cancelledNo = created.requestNo;
    let cancelRequestId = '';
    await withApi('user', async (api) => {
      const response = await api.post(`/api/quick-request/${created.requestNo}/cancel`, { data: {} });
      expect(response.status()).toBe(200);
      cancelRequestId = response.headers()['x-request-id'] ?? '';
    });
    expect(cancelRequestId).toBeTruthy();
    const cancelled = await findActivityLog(
      'quick_request.cancel',
      (item) => item.request_id === cancelRequestId && item.http_status === 200,
      `quick_request.cancel 200 ${created.requestNo}`
    );
    expect(cancelled.target_label).toBe(created.requestNo);

    await withPage(browser, 'admin', 'D1280', async (page) => {
      await page.goto('/dashboard/logs?log_user=all&action=quick_request.create', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('activity-logs-page')).toBeVisible({ timeout: 30_000 });
      const row = page.getByTestId('activity-log-row').filter({ hasText: '퀵 요청 등록' }).filter({ hasText: '입력 오류' }).first();
      await expect(row).toBeVisible({ timeout: 20_000 });

      await page.goto(
        `/dashboard/logs?log_user=all&action=quick_request.cancel&search=${encodeURIComponent(created.requestNo)}`,
        { waitUntil: 'domcontentloaded' }
      );
      const cancelRow = page.getByTestId('activity-log-row').filter({ hasText: created.requestNo }).filter({ hasText: '퀵 요청 취소' }).first();
      await expect(cancelRow).toBeVisible({ timeout: 20_000 });
      await expect(cancelRow).toContainText('성공');
    });
  });
});
