import 'server-only';

import type { NextResponse } from 'next/server';
import type * as z from 'zod';
import {
  actorFromProfile,
  buildErrorMetadata,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type {
  ActivityAction,
  ActivityLogMetadata,
  ActivityTargetType
} from '@/features/activity-logs/api/types';
import type { AuthProfile } from '@/features/auth/api/types';
import {
  canViewQuickRequest,
  getQuickRequestByNo,
  isQuickRequestLocked,
  type QuickRequestRow
} from '@/features/quick-request/api/workflow.server';
import {
  isQuickRequestNo,
  QUICK_REQUEST_MESSAGES
} from '@/features/quick-request/schemas/quick-request-workflow';

export const QUICK_REQUEST_NOTE_TARGET: ActivityTargetType = 'quick_request_note';
export const QUICK_REQUEST_ADDRESS_TARGET: ActivityTargetType = 'quick_request_address';

/** `requireSession` 실패(401·403·500) 응답에 activity log + `x-request-id`를 붙인다 */
export async function logQuickRequestAuthFailure(params: {
  requestId: string;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetLabel: string;
  httpMethod: string;
  httpPath: string;
  response: NextResponse;
}): Promise<NextResponse> {
  const status = params.response.status;
  const actor = await resolveLoggingActor(status);
  const errorCode =
    status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal_error';

  return finishWithActivityLog(
    params.requestId,
    {
      ...actor,
      action: params.action,
      targetType: params.targetType,
      targetUserId: null,
      targetLabel: params.targetLabel,
      httpMethod: params.httpMethod,
      httpPath: params.httpPath,
      metadata: buildErrorMetadata(errorCode)
    },
    params.response
  );
}

export async function readJsonBody(
  request: Request
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

export function zodIssuesToValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

/** `/notes/[id]` path segment → 양의 정수 id (아니면 null → 404) */
export function parseQuickRequestNoteId(raw: string): number | null {
  if (!/^\d{1,15}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// ---------------------------------------------------------------------------
// plan 89 — 퀵 업무 Route 공용 (모든 return 분기에 activity log + x-request-id)
// ---------------------------------------------------------------------------

export const QUICK_REQUEST_TARGET: ActivityTargetType = 'quick_request';

export type QuickRouteLogger = {
  /** 모든 응답은 이 함수를 거친다 → `jsonWithActivityLog` */
  respond: (
    body: unknown,
    status: number,
    options?: {
      targetLabel?: string;
      metadata?: ActivityLogMetadata;
      targetUserId?: string | null;
      action?: ActivityAction;
    }
  ) => Promise<NextResponse>;
};

export function createQuickRouteLogger(params: {
  requestId: string;
  action: ActivityAction;
  httpMethod: string;
  httpPath: string;
  profile: AuthProfile;
  defaultTargetLabel: string;
}): QuickRouteLogger {
  return {
    respond: (body, status, options = {}) =>
      jsonWithActivityLog(
        params.requestId,
        {
          ...actorFromProfile(params.profile),
          action: options.action ?? params.action,
          targetType: QUICK_REQUEST_TARGET,
          targetUserId: options.targetUserId ?? null,
          targetLabel: options.targetLabel ?? params.defaultTargetLabel,
          httpMethod: params.httpMethod,
          httpPath: params.httpPath,
          metadata: options.metadata
        },
        body,
        status
      )
  };
}

export function quickErrorBody(message: string) {
  return { success: false as const, message };
}

/** `[requestNo]` 세그먼트 → 형식 검증 (`YYYY-NN`). 디코딩 실패·형식 불일치는 null → 404 */
export function parseQuickRequestNoParam(raw: string): string | null {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return isQuickRequestNo(value) ? value : null;
}

export type LoadedQuickRequest =
  | { ok: true; row: QuickRequestRow; requestNo: string }
  | { ok: false; response: NextResponse };

/**
 * `[requestNo]` 공통: 형식 404 → 조회(500) → 미존재 404 → 조회 권한 없음 404 (권한 없음과 미존재를 구분하지 않는다, AC-29).
 * 모든 실패 분기는 logger.respond로 기록된다.
 */
export async function loadQuickRequestForMutation(params: {
  rawRequestNo: string;
  profile: AuthProfile;
  logger: QuickRouteLogger;
}): Promise<LoadedQuickRequest> {
  const requestNo = parseQuickRequestNoParam(params.rawRequestNo);
  if (!requestNo) {
    return {
      ok: false,
      response: await params.logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.notFound), 404, {
        metadata: buildErrorMetadata('not_found', undefined, { attempted_target: params.rawRequestNo })
      })
    };
  }

  let row: QuickRequestRow | null;
  try {
    row = await getQuickRequestByNo(requestNo);
  } catch (error) {
    console.error('[quick-request] load failed:', error);
    return {
      ok: false,
      response: await params.logger.respond(
        quickErrorBody(QUICK_REQUEST_MESSAGES.internalError),
        500,
        { targetLabel: requestNo, metadata: buildErrorMetadata('internal_error') }
      )
    };
  }

  if (!row || !canViewQuickRequest(params.profile, row)) {
    return {
      ok: false,
      response: await params.logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.notFound), 404, {
        targetLabel: requestNo,
        metadata: buildErrorMetadata('not_found', undefined, { attempted_target: requestNo })
      })
    };
  }

  return { ok: true, row, requestNo };
}

/** 상태 전이 실패(0행) 후 원인 판정: 잠금이면 locked, 아니면 stale */
export async function resolveTransitionConflictMessage(requestNo: string): Promise<string> {
  try {
    const latest = await getQuickRequestByNo(requestNo);
    if (latest && isQuickRequestLocked(latest.status)) {
      return QUICK_REQUEST_MESSAGES.locked;
    }
  } catch {
    // stale로 처리
  }
  return QUICK_REQUEST_MESSAGES.stale;
}

/** 감사 로그 metadata 공통 (주소·연락처·기사 정보·금액은 남기지 않는다) */
export function quickLogMetadata(
  requestNo: string,
  extra: ActivityLogMetadata = {}
): ActivityLogMetadata {
  return { quick_request_no: requestNo, ...extra };
}
