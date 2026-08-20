import { NextResponse } from 'next/server';
import {
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type { ActivityAction } from '@/features/activity-logs/api/types';
import type { ActivityTargetType } from '@/features/activity-logs/api/types';

export type SupportAction = Extract<ActivityAction, `support.${string}`>;

export function newSupportRequestId() {
  return createRequestId();
}

export function parseSupportId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function supportTargetLabel(input: {
  id?: number | string | null;
  title?: string | null;
}): string {
  const id = input.id ?? 'unknown';
  const title = input.title?.trim() || 'unknown';
  return `support:${id}:${title}`;
}

export function supportCommentTargetLabel(input: {
  supportRequestId?: number | string | null;
  commentId?: number | string | null;
}): string {
  const supportRequestId = input.supportRequestId ?? 'unknown';
  const commentId = input.commentId ?? 'unknown';
  return `support-comment:${supportRequestId}:${commentId}`;
}

export async function logSupportAuthFailure(input: {
  requestId: string;
  action: SupportAction;
  targetType?: ActivityTargetType;
  httpMethod: string;
  httpPath: string;
  targetLabel: string;
  response: NextResponse;
}): Promise<NextResponse> {
  const status = input.response.status;
  const actor = await resolveLoggingActor(status);
  return finishWithActivityLog(
    input.requestId,
    {
      ...actor,
      action: input.action,
      targetType: input.targetType ?? 'support_request',
      targetUserId: null,
      targetLabel: input.targetLabel,
      httpMethod: input.httpMethod,
      httpPath: input.httpPath,
      metadata: buildErrorMetadata(
        status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal_error'
      )
    },
    input.response
  );
}

export function isSupportValidationErrorMessage(message: string): boolean {
  return (
    message.includes('제목') ||
    message.includes('본문') ||
    message.includes('상태') ||
    message.includes('댓글')
  );
}

export function isSupportForbiddenError(message: string): boolean {
  return message === 'FORBIDDEN';
}
