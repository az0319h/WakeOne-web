import { NextResponse } from 'next/server';
import type { ActivityAction } from '@/features/activity-logs/api/types';
import {
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';

type LogFailureInput = {
  requestId: string;
  action: ActivityAction;
  httpMethod: string;
  httpPath: string;
  targetLabel: string;
  targetUserId?: string | null;
  response: NextResponse;
};

export async function logOfficeSnackAuthFailure(input: LogFailureInput): Promise<NextResponse> {
  const status = input.response.status;
  const actor = await resolveLoggingActor(status);
  return finishWithActivityLog(
    input.requestId,
    {
      ...actor,
      action: input.action,
      targetType: 'office_snack',
      targetUserId: input.targetUserId ?? null,
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

export function officeSnackActionTargetLabel(sessionId?: number | string, candidateId?: number | string): string {
  if (candidateId !== undefined) {
    return `session:${sessionId ?? 'unknown'}:candidate:${candidateId}`;
  }
  if (sessionId !== undefined) {
    return `session:${sessionId}`;
  }
  return 'office_snack';
}

export async function logOfficeSnackValidationError(input: {
  requestId: string;
  actor: { actorUserId: string; actorEmail: string; actorDisplayName: string | null };
  action: ActivityAction;
  httpMethod: string;
  httpPath: string;
  targetLabel: string;
  targetUserId?: string | null;
  message: string;
  status?: number;
}) {
  return jsonWithActivityLog(
    input.requestId,
    {
      ...input.actor,
      action: input.action,
      targetType: 'office_snack',
      targetUserId: input.targetUserId ?? null,
      targetLabel: input.targetLabel,
      httpMethod: input.httpMethod,
      httpPath: input.httpPath,
      metadata: buildErrorMetadata('validation', input.message)
    },
    { success: false, message: input.message },
    input.status ?? 400
  );
}

export function newOfficeSnackRequestId() {
  return createRequestId();
}
