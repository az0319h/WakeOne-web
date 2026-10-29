import { NextResponse } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { decodeRecentAddressCursor } from '@/features/quick-request/api/cursor.server';
import {
  listQuickRequestRecentAddresses,
  recordQuickRequestRecentAddresses
} from '@/features/quick-request/api/service.server';
import {
  isQuickRequestRecentAddressDirection,
  QUICK_REQUEST_RECENT_ADDRESS_MESSAGES,
  quickRequestRecentAddressBodySchema
} from '@/features/quick-request/schemas/quick-request-recent-address';
import { QUICK_REQUEST_ADDRESS_TARGET, logQuickRequestAuthFailure, readJsonBody } from '../_utils';

const HTTP_PATH = '/api/quick-request/recent-addresses';
const ACTION = 'quick_request.recent_address_record' as const;
const FALLBACK_TARGET_LABEL = '최근 주소';

function parsePositiveInt(value: string | null): number | undefined {
  if (!value || !/^\d{1,6}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}

/**
 * Read — activity log Out (plan 87/97 D-9). `direction=origin|destination`(필수 · 아니면 400 「요청 형식이 올바르지 않습니다.」)
 * · `cursor`(opaque · 불량 400) · `limit`(기본 10 · ≤50) → `{addresses, nextCursor}` · `last_used_at desc, id desc`
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const url = new URL(request.url);
  const direction = url.searchParams.get('direction');
  if (!isQuickRequestRecentAddressDirection(direction)) {
    return NextResponse.json(
      { success: false, message: QUICK_REQUEST_RECENT_ADDRESS_MESSAGES.invalidBody },
      { status: 400 }
    );
  }

  const cursorParam = url.searchParams.get('cursor');
  const cursor = cursorParam ? decodeRecentAddressCursor(cursorParam) : null;
  if (cursorParam && !cursor) {
    return NextResponse.json(
      { success: false, message: QUICK_REQUEST_RECENT_ADDRESS_MESSAGES.invalidBody },
      { status: 400 }
    );
  }

  try {
    const data = await listQuickRequestRecentAddresses(session.userId, {
      direction,
      cursor,
      limit: parsePositiveInt(url.searchParams.get('limit'))
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request/recent-addresses] list failed:', error);
    return NextResponse.json(
      { success: false, message: QUICK_REQUEST_RECENT_ADDRESS_MESSAGES.internalError },
      { status: 500 }
    );
  }
}

/**
 * 확인 시 출발·경유·도착 주소 기록 (plan 97 — item.direction 필수 · 출발 origin · 경유·도착 destination).
 * activity log metadata에는 주소·이름·전화를 남기지 않는다 (`error_code` · `count`만, 87 AC-19 · 97 AC-24).
 */
export async function POST(request: Request) {
  const requestId = createRequestId();
  const session = await requireSession();

  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action: ACTION,
      targetType: QUICK_REQUEST_ADDRESS_TARGET,
      targetLabel: FALLBACK_TARGET_LABEL,
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      response: session.response
    });
  }

  const logBase = {
    ...actorFromProfile(session.profile),
    action: ACTION,
    targetType: QUICK_REQUEST_ADDRESS_TARGET,
    targetUserId: session.userId,
    httpMethod: 'POST',
    httpPath: HTTP_PATH
  };

  const json = await readJsonBody(request);
  if (!json.ok) {
    return jsonWithActivityLog(
      requestId,
      { ...logBase, targetLabel: FALLBACK_TARGET_LABEL, metadata: buildErrorMetadata('validation') },
      { success: false, message: QUICK_REQUEST_RECENT_ADDRESS_MESSAGES.invalidBody },
      400
    );
  }

  const parsed = quickRequestRecentAddressBodySchema.safeParse(json.body);
  if (!parsed.success) {
    return jsonWithActivityLog(
      requestId,
      { ...logBase, targetLabel: FALLBACK_TARGET_LABEL, metadata: buildErrorMetadata('validation') },
      { success: false, message: QUICK_REQUEST_RECENT_ADDRESS_MESSAGES.invalid },
      400
    );
  }

  try {
    const count = await recordQuickRequestRecentAddresses(session.userId, parsed.data.locations);

    return jsonWithActivityLog(
      requestId,
      { ...logBase, targetLabel: `최근 주소 ${count}건`, metadata: { count } },
      { success: true, data: { count } },
      200
    );
  } catch (error) {
    console.error('[quick-request/recent-addresses] record failed:', error);
    return jsonWithActivityLog(
      requestId,
      {
        ...logBase,
        targetLabel: FALLBACK_TARGET_LABEL,
        metadata: buildErrorMetadata('internal_error')
      },
      { success: false, message: QUICK_REQUEST_RECENT_ADDRESS_MESSAGES.internalError },
      500
    );
  }
}
