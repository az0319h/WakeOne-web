import { NextRequest } from 'next/server';
import { requireOfficeSnacksSession } from '@/features/auth/api/session.server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { submitOfficeSnackVote } from '@/features/office-snacks/api/service.server';
import { officeSnackVoteSubmitSchema } from '@/features/office-snacks/api/validators';
import {
  logOfficeSnackAuthFailure,
  logOfficeSnackValidationError,
  newOfficeSnackRequestId,
  officeSnackActionTargetLabel
} from '../../../_utils';

type Params = { params: Promise<{ id: string }> };

function parseSessionId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = newOfficeSnackRequestId();
  const { id } = await params;
  const sessionId = parseSessionId(id);
  const httpPath = `/api/office-snacks/sessions/${id}/votes`;

  const session = await requireOfficeSnacksSession();
  if (!session.ok) {
    return logOfficeSnackAuthFailure({
      requestId,
      action: 'office_snack.vote_submit',
      httpMethod: 'POST',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(id),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);
  if (!sessionId) {
    return logOfficeSnackValidationError({
      requestId,
      actor,
      action: 'office_snack.vote_submit',
      httpMethod: 'POST',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(id),
      targetUserId: session.userId,
      message: '회차 ID가 올바르지 않습니다.'
    });
  }

  try {
    const body = await request.json();
    const parsed = officeSnackVoteSubmitSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
      return logOfficeSnackValidationError({
        requestId,
        actor,
        action: 'office_snack.vote_submit',
        httpMethod: 'POST',
        httpPath,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        targetUserId: session.userId,
        message
      });
    }

    const vote = await submitOfficeSnackVote({
      sessionId,
      userId: session.userId,
      payload: parsed.data
    });

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.vote_submit',
        targetType: 'office_snack',
        targetUserId: session.userId,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        httpMethod: 'POST',
        httpPath,
        metadata: {}
      },
      { success: true, message: '투표를 제출했습니다.', vote },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '투표 제출 중 오류가 발생했습니다.';
    const lower = message.toLowerCase();
    const isDuplicate = lower.includes('duplicate') || lower.includes('unique');
    const isClientError =
      message === 'SESSION_NOT_FOUND' ||
      message === 'VOTING_CLOSED' ||
      message === 'INVALID_CANDIDATES' ||
      isDuplicate;

    const resolvedMessage =
      message === 'SESSION_NOT_FOUND'
        ? '회차를 찾을 수 없습니다.'
        : message === 'VOTING_CLOSED'
          ? '투표 가능한 기간이 아닙니다.'
          : message === 'INVALID_CANDIDATES'
            ? '해당 회차 후보만 선택할 수 있습니다.'
            : isDuplicate
              ? '투표는 회차당 1회만 제출할 수 있습니다.'
              : message;

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.vote_submit',
        targetType: 'office_snack',
        targetUserId: session.userId,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', resolvedMessage)
      },
      { success: false, message: resolvedMessage },
      isClientError ? 400 : 500
    );
  }
}
