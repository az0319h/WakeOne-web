import { NextRequest } from 'next/server';
import { requireOfficeSnacksSession } from '@/features/auth/api/session.server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { createOfficeSnackCandidate } from '@/features/office-snacks/api/service.server';
import { officeSnackCandidateCreateSchema } from '@/features/office-snacks/api/validators';
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
  const httpPath = `/api/office-snacks/sessions/${id}/candidates`;

  const session = await requireOfficeSnacksSession();
  if (!session.ok) {
    return logOfficeSnackAuthFailure({
      requestId,
      action: 'office_snack.candidate_create',
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
      action: 'office_snack.candidate_create',
      httpMethod: 'POST',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(id),
      targetUserId: session.userId,
      message: '회차 ID가 올바르지 않습니다.'
    });
  }

  try {
    const body = await request.json();
    const parsed = officeSnackCandidateCreateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
      return logOfficeSnackValidationError({
        requestId,
        actor,
        action: 'office_snack.candidate_create',
        httpMethod: 'POST',
        httpPath,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        targetUserId: session.userId,
        message
      });
    }

    const candidate = await createOfficeSnackCandidate({
      sessionId,
      userId: session.userId,
      payload: parsed.data
    });

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.candidate_create',
        targetType: 'office_snack',
        targetUserId: session.userId,
        targetLabel: officeSnackActionTargetLabel(sessionId, candidate.id),
        httpMethod: 'POST',
        httpPath,
        metadata: {}
      },
      { success: true, message: '후보를 등록했습니다.', candidate },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '후보 등록 중 오류가 발생했습니다.';
    const lower = message.toLowerCase();
    const isClientError =
      message === 'SESSION_NOT_FOUND' ||
      message === 'REGISTRATION_CLOSED' ||
      message === 'INVALID_DOMAIN' ||
      message === 'INVALID_URL' ||
      lower.includes('duplicate') ||
      lower.includes('unique');

    const resolvedMessage =
      message === 'SESSION_NOT_FOUND'
        ? '회차를 찾을 수 없습니다.'
        : message === 'REGISTRATION_CLOSED'
          ? '등록 가능한 기간이 아닙니다.'
          : message === 'INVALID_DOMAIN'
            ? '쿠팡 링크만 등록할 수 있습니다.'
            : message === 'INVALID_URL'
              ? '올바른 URL을 입력해 주세요.'
          : lower.includes('duplicate') || lower.includes('unique')
            ? '회차당 간식은 1개만 등록할 수 있습니다.'
            : message;

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.candidate_create',
        targetType: 'office_snack',
        targetUserId: session.userId,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(isClientError ? 'validation' : 'internal_error', resolvedMessage)
      },
      { success: false, message: resolvedMessage },
      isClientError ? 400 : 500
    );
  }
}
