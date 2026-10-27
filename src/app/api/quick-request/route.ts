import { NextResponse } from 'next/server';
import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { canCreateQuickRequest } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  insertQuickRequestVendorNotifications,
  safeNotify
} from '@/features/quick-request/api/notifications.server';
import { recordQuickRequestRecentAddresses } from '@/features/quick-request/api/service.server';
import {
  createQuickRequestRecord,
  listQuickRequestsForViewer,
  QuickRequestRequesterForbiddenError,
  toQuickOpenchatSource
} from '@/features/quick-request/api/workflow.server';
import { dispatchQuickOpenchatEvent } from '@/features/quick-request/lib/openchat-webhook.server';
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

/** Read — activity log Out. 최근 7일(KST) + 조회 범위(본인 | viewer-all) */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const search = (url.searchParams.get('search') ?? '').trim().slice(0, SEARCH_MAX_LENGTH);

  try {
    const data = await listQuickRequestsForViewer(session.profile, {
      status: isQuickRequestStatus(statusParam) ? statusParam : null,
      search: search || null,
      page: parsePositiveInt(url.searchParams.get('page')),
      limit: parsePositiveInt(url.searchParams.get('limit'))
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
 * 등록 — RPC 번호 발급 → 최근 주소 서버 기록(D-12) → webhook `created` → 동방특송 인앱 알림.
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

  // D-12 — 등록 성공 직후 서버에서 최근 주소 기록 (실패해도 등록은 성공)
  let recentAddressesRecorded = true;
  try {
    await recordQuickRequestRecentAddresses(session.userId, [
      parsed.data.origin,
      ...parsed.data.stopovers,
      parsed.data.destination
    ]);
  } catch (error) {
    recentAddressesRecorded = false;
    console.error('[quick-request] recent addresses record failed:', error);
  }

  const openchat = await dispatchQuickOpenchatEvent(toQuickOpenchatSource(row), 'created');

  const actorName = profile.full_name?.trim() || profile.email;
  await safeNotify('vendor created', () =>
    insertQuickRequestVendorNotifications({
      row,
      event: 'created',
      actorUserId: session.userId,
      actorName
    })
  );

  return logger.respond(
    {
      success: true,
      message: `${QUICK_REQUEST_MESSAGES.created} (요청번호 ${row.request_no})`,
      data: {
        requestNo: row.request_no,
        id: row.id,
        openchat: { status: openchat.status }
      }
    },
    201,
    {
      targetLabel: row.request_no,
      targetUserId: session.userId,
      metadata: quickLogMetadata(row.request_no, {
        recentAddressesRecorded,
        openchat
      })
    }
  );
}
