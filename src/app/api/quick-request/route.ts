import { after, NextResponse } from 'next/server';
import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { canCreateQuickRequest } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  notifyQuickRequestEvent,
  safeNotify
} from '@/features/quick-request/api/notifications.server';
import { recordQuickRequestRecentAddresses } from '@/features/quick-request/api/service.server';
import {
  createQuickRequestRecord,
  listQuickRequestsForViewer,
  QuickRequestRequesterForbiddenError
} from '@/features/quick-request/api/workflow.server';
import { parseQuickRange } from '@/features/quick-request/lib/quick-request-range';
import {
  isQuickRequestStatus,
  QUICK_REQUEST_MESSAGES,
  quickRequestCreateBodySchema
} from '@/features/quick-request/schemas/quick-request-workflow';
import {
  createQuickRouteLogger,
  logQuickRequestAuthFailure,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata,
  readJsonBody,
  zodIssuesToValidationErrors
} from './_utils';

const HTTP_PATH = '/api/quick-request';
const CREATE_ACTION = 'quick_request.create' as const;
const FALLBACK_TARGET_LABEL = '퀵 요청';
const SEARCH_MAX_LENGTH = 100;

function parsePositiveInt(value: string | null): number | undefined {
  if (!value || !/^\d{1,6}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}

/**
 * Read — activity log Out. plan 97 D-3: 선택 기간(`range`·`from`·`to` · 기본 7d KST) + 조회 범위(본인 | viewer-all)
 * + `status`·`search`·`page`·`limit`(`perPage` 별칭 · 기본 20 · ≤50 클램프)을 DB에서 필터·페이지한다.
 * 잘못된 `range`는 7d로 정정(200) · custom `from > to`는 400 「기간을 확인해 주세요.」
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, SEARCH_MAX_LENGTH);

  const parsedRange = parseQuickRange({
    range: url.searchParams.get('range'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to')
  });
  if (!parsedRange.ok) {
    return NextResponse.json(quickErrorBody(parsedRange.message), { status: 400 });
  }

  try {
    const data = await listQuickRequestsForViewer(session.profile, {
      range: parsedRange.range,
      status: isQuickRequestStatus(statusParam) ? statusParam : null,
      search: search || null,
      page: parsePositiveInt(url.searchParams.get('page')),
      limit:
        parsePositiveInt(url.searchParams.get('limit')) ??
        parsePositiveInt(url.searchParams.get('perPage'))
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request] list failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_REQUEST_MESSAGES.internalError), {
      status: 500
    });
  }
}

/**
 * 등록 — RPC 번호 발급 → 최근 주소 서버 기록(D-12) → 인앱 알림 `created`(동방·admin·구매물류팀 · plan 92).
 * 클라이언트의 `requesterName`·`requestedAtIso`는 무시한다.
 */
export async function POST(request: Request) {
  const requestId = createRequestId();
  const session = await requireSession();

  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action: CREATE_ACTION,
      targetType: QUICK_REQUEST_TARGET,
      targetLabel: FALLBACK_TARGET_LABEL,
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      response: session.response
    });
  }

  const { profile } = session;
  const logger = createQuickRouteLogger({
    requestId,
    action: CREATE_ACTION,
    httpMethod: 'POST',
    httpPath: HTTP_PATH,
    profile,
    defaultTargetLabel: FALLBACK_TARGET_LABEL
  });

  if (!canCreateQuickRequest(profile)) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.forbidden), 403, {
      metadata: buildErrorMetadata('forbidden')
    });
  }

  const json = await readJsonBody(request);
  if (!json.ok) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.invalid), 400, {
      metadata: buildErrorMetadata('validation')
    });
  }

  const parsed = quickRequestCreateBodySchema.safeParse(json.body);
  if (!parsed.success) {
    const validationErrors = zodIssuesToValidationErrors(parsed.error);
    return logger.respond(
      { ...quickErrorBody(QUICK_REQUEST_MESSAGES.invalid), errors: validationErrors },
      400,
      { metadata: buildErrorMetadata('validation', undefined, { validation_errors: validationErrors }) }
    );
  }

  let row;
  try {
    row = await createQuickRequestRecord(session.userId, parsed.data);
  } catch (error) {
    if (error instanceof QuickRequestRequesterForbiddenError) {
      return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.forbidden), 403, {
        metadata: buildErrorMetadata('forbidden')
      });
    }
    console.error('[quick-request] create failed:', error);
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.internalError), 500, {
      metadata: buildErrorMetadata('internal_error')
    });
  }

  // D-12 — 등록 성공 직후 서버에서 최근 주소 기록 (실패해도 등록은 성공). plan 97 D-8: 출발 → origin · 경유·도착 → destination
  let recentAddressesRecorded = true;
  try {
    // RPC는 앞쪽 item일수록 최근(last_used_at) — 도착 → 경유(역순) → 출발 순으로 넘겨 plan 97 AC-12 「destination = [C, B](최근순)」
    await recordQuickRequestRecentAddresses(session.userId, [
      { ...parsed.data.destination, direction: 'destination' },
      ...[...parsed.data.stopovers].reverse().map((stopover) => ({ ...stopover, direction: 'destination' as const })),
      { ...parsed.data.origin, direction: 'origin' }
    ]);
  } catch (error) {
    recentAddressesRecorded = false;
    console.error('[quick-request] recent addresses record failed:', error);
  }

  const actorName = profile.full_name?.trim() || profile.email;
  // plan 94 D-2 — 알림(인앱 insert + 푸시 fan-out)은 응답을 돌려준 뒤 after()에서. 실패는 safeNotify가 console.error만
  after(() =>
    safeNotify('created', () =>
      notifyQuickRequestEvent({ row, event: 'created', actorUserId: session.userId, actorName })
    )
  );

  return logger.respond(
    {
      success: true,
      message: `${QUICK_REQUEST_MESSAGES.created} (요청번호 ${row.request_no})`,
      data: { requestNo: row.request_no, id: row.id }
    },
    201,
    {
      targetLabel: row.request_no,
      targetUserId: session.userId,
      metadata: quickLogMetadata(row.request_no, { recentAddressesRecorded })
    }
  );
}
