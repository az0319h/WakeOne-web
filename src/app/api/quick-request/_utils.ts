import 'server-only';

import type { NextResponse } from 'next/server';
import type * as z from 'zod';
import {
  buildErrorMetadata,
  finishWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type { ActivityAction, ActivityTargetType } from '@/features/activity-logs/api/types';

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
