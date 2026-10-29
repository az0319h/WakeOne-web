import { NextResponse } from 'next/server';
import { DONGBANG_FORBIDDEN_JSON } from '@/config/dongbang-routes';
import { createRequestId, withRequestId } from '@/features/activity-logs/api/log.server';
import { isDongbang } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  consumePlaceSearchQuota,
  isPlaceSearchConfigured,
  searchQuickRequestPlaces
} from '@/features/quick-request/api/places.server';
import {
  parseQuickPlaceSearchParams,
  QUICK_PLACE_MESSAGES
} from '@/features/quick-request/schemas/quick-request-place';
import { quickErrorBody } from '../_utils';

/**
 * plan 99 — 「장소 검색」 `GET ?q=&page=` (외부 장소 키워드 검색 서버 프록시 · Read → activity log Out · plan D-6).
 * 순서: 인증(active · 401/403) → 동방 403(proxy allowlist 1차 · 여기 2차) → 미설정 503 → q/page 400 → 분당 30회 429 → 검색 → 200.
 * 외부 실패(4xx/5xx·429·timeout)는 502 + `console.error('[quick-places]', status)`만 — 검색어·키는 로그 금지.
 * 모든 응답에 `x-request-id`.
 */
export async function GET(request: Request) {
  const requestId = createRequestId();
  const respond = (body: unknown, status: number) =>
    NextResponse.json(body, { status, headers: { 'x-request-id': requestId } });

  const session = await requireSession();
  if (!session.ok) {
    return withRequestId(session.response, requestId);
  }

  if (isDongbang(session.profile)) {
    return respond(DONGBANG_FORBIDDEN_JSON, 403);
  }

  if (!isPlaceSearchConfigured()) {
    return respond(quickErrorBody(QUICK_PLACE_MESSAGES.notConfigured), 503);
  }

  const parsed = parseQuickPlaceSearchParams(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return respond(quickErrorBody(parsed.message), 400);
  }

  if (!consumePlaceSearchQuota(session.userId)) {
    return respond(quickErrorBody(QUICK_PLACE_MESSAGES.rateLimited), 429);
  }

  try {
    const result = await searchQuickRequestPlaces(parsed.data.q, parsed.data.page);
    if (!result.ok) {
      console.error('[quick-places]', result.status);
      return respond(quickErrorBody(QUICK_PLACE_MESSAGES.upstreamFailed), 502);
    }
    return respond({ success: true, data: result.data }, 200);
  } catch {
    console.error('[quick-places]', 'unexpected');
    return respond(quickErrorBody(QUICK_PLACE_MESSAGES.upstreamFailed), 502);
  }
}
