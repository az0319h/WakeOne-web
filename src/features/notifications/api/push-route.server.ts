import 'server-only';

import type { NextResponse } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type { ActivityAction, ActivityLogMetadata } from '@/features/activity-logs/api/types';
import type { AuthProfile } from '@/features/auth/api/types';
import type { SessionResult } from '@/features/auth/api/session.server';

/**
 * plan 91 — `/api/notifications/push/**` mutation Route 공용 로그 헬퍼.
 * target은 항상 `user` · 본인. 전 응답 분기(401/403/400/404/409/503/2xx/500)에 1건 append.
 */

export const PUSH_NOT_CONFIGURED_MESSAGE = '휴대폰 알림 서버 설정이 아직 준비되지 않았습니다.';
export const PUSH_INVALID_SUBSCRIPTION_MESSAGE = '구독 정보가 올바르지 않습니다.';
export const PUSH_DEVICE_NOT_FOUND_MESSAGE = '등록된 기기를 찾을 수 없습니다.';
export const PUSH_INVALID_GROUP_MESSAGE = '알림 종류가 올바르지 않습니다.';
export const PUSH_NO_DEVICE_MESSAGE = '등록된 기기가 없습니다. 먼저 알림을 켜 주세요.';
export const PUSH_TEST_TITLE = 'WakeOne 테스트 알림';
export const PUSH_TEST_BODY = '휴대폰 알림이 정상적으로 연결되었어요.';

export function profileTargetLabel(profile: Pick<AuthProfile, 'email' | 'full_name'>): string {
  const name = profile.full_name?.trim() ?? '';
  return name ? `${name} (${profile.email})` : profile.email;
}

export type PushRouteContext = {
  requestId: string;
  action: ActivityAction;
  httpMethod: 'POST' | 'PUT' | 'DELETE';
  httpPath: string;
};

/** 세션 실패(401/403/500) 응답을 로그와 함께 돌려준다 */
export async function finishSessionFailure(
  ctx: PushRouteContext,
  response: NextResponse
): Promise<NextResponse> {
  const status = response.status;
  const actor = await resolveLoggingActor(status);
  return finishWithActivityLog(
    ctx.requestId,
    {
      ...actor,
      action: ctx.action,
      targetType: 'user',
      targetUserId: actor.actorUserId,
      targetLabel: actor.actorEmail,
      httpMethod: ctx.httpMethod,
      httpPath: ctx.httpPath,
      metadata: buildErrorMetadata(
        status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal_error'
      )
    },
    response
  );
}

export type PushRouteSession = Extract<SessionResult, { ok: true }>;

export function respondWithLog(
  ctx: PushRouteContext,
  session: PushRouteSession,
  body: unknown,
  status: number,
  metadata: ActivityLogMetadata
): Promise<NextResponse> {
  return jsonWithActivityLog(
    ctx.requestId,
    {
      ...actorFromProfile(session.profile),
      action: ctx.action,
      targetType: 'user',
      targetUserId: session.userId,
      targetLabel: profileTargetLabel(session.profile),
      httpMethod: ctx.httpMethod,
      httpPath: ctx.httpPath,
      metadata
    },
    body,
    status
  );
}

export function failWithLog(
  ctx: PushRouteContext,
  session: PushRouteSession,
  status: number,
  message: string,
  errorCode: Parameters<typeof buildErrorMetadata>[0],
  extra?: ActivityLogMetadata
): Promise<NextResponse> {
  return respondWithLog(
    ctx,
    session,
    { success: false, message },
    status,
    buildErrorMetadata(errorCode, message, extra)
  );
}

export function internalErrorWithLog(
  ctx: PushRouteContext,
  session: PushRouteSession,
  error: unknown
): Promise<NextResponse> {
  const message = error instanceof Error ? error.message : 'Unknown server error';
  return failWithLog(ctx, session, 500, message, 'internal_error');
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
