import { NextResponse } from 'next/server';
import {
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type { ActivityAction, ActivityLogMetadata } from '@/features/activity-logs/api/types';
import type { AuthProfile } from '@/features/auth/api/types';
import { GoogleTasksConnectionError } from '@/features/google-tasks/api/service.server';
import { GoogleTasksApiError } from '@/lib/google-tasks/types';

export type GoogleTasksMutationAction = Extract<ActivityAction, `google_tasks.${string}`>;

export function newGoogleTasksRequestId() {
  return createRequestId();
}

export function googleTasksActorEmail(profile: AuthProfile): string {
  return profile.google_email?.trim() || profile.email;
}

export function googleTasksTargetLabel(parts: {
  tasklistId?: string;
  taskId?: string;
  title?: string;
}): string {
  if (parts.taskId && parts.tasklistId) {
    return `task:${parts.tasklistId}:${parts.taskId}`;
  }
  if (parts.tasklistId) {
    return `tasklist:${parts.tasklistId}`;
  }
  return parts.title?.trim() || 'google_tasks';
}

export async function logGoogleTasksAuthFailure(input: {
  requestId: string;
  action: GoogleTasksMutationAction;
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
      targetType: 'google_tasks',
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

export function googleTasksHttpStatusFromError(error: unknown): number {
  if (error instanceof GoogleTasksConnectionError) {
    return 403;
  }
  if (error instanceof GoogleTasksApiError) {
    if (error.status === 404) {
      return 404;
    }
    if (error.status >= 400 && error.status < 500) {
      return error.status;
    }
    return 502;
  }
  return 500;
}

export function googleTasksErrorMessage(error: unknown): string {
  if (error instanceof GoogleTasksConnectionError) {
    return error.message;
  }
  if (error instanceof GoogleTasksApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Google Tasks 처리 중 오류가 발생했습니다.';
}

export function googleTasksErrorCode(error: unknown): NonNullable<ActivityLogMetadata['error_code']> {
  if (error instanceof GoogleTasksConnectionError) {
    return 'forbidden';
  }
  if (error instanceof GoogleTasksApiError) {
    if (error.status === 404) {
      return 'not_found';
    }
    if (error.status >= 400 && error.status < 500) {
      return 'validation';
    }
    return 'internal_error';
  }
  return 'internal_error';
}

export async function googleTasksMutationErrorResponse(input: {
  requestId: string;
  action: GoogleTasksMutationAction;
  actor: { actorUserId: string; actorEmail: string; actorDisplayName: string | null };
  httpMethod: string;
  httpPath: string;
  targetLabel: string;
  error: unknown;
  metadata?: ActivityLogMetadata;
}) {
  const status = googleTasksHttpStatusFromError(input.error);
  const message = googleTasksErrorMessage(input.error);
  return jsonWithActivityLog(
    input.requestId,
    {
      ...input.actor,
      action: input.action,
      targetType: 'google_tasks',
      targetUserId: input.actor.actorUserId,
      targetLabel: input.targetLabel,
      httpMethod: input.httpMethod,
      httpPath: input.httpPath,
      metadata: buildErrorMetadata(googleTasksErrorCode(input.error), message, {
        ...input.metadata,
        message
      })
    },
    { success: false, message },
    status
  );
}

export async function googleTasksReadErrorResponse(error: unknown) {
  const status = googleTasksHttpStatusFromError(error);
  const message = googleTasksErrorMessage(error);
  return NextResponse.json({ success: false, message }, { status });
}
