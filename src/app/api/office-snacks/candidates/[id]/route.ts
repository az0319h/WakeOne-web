import { NextRequest } from 'next/server';
import { requireOfficeSnacksSession } from '@/features/auth/api/session.server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import {
  deleteOfficeSnackCandidate,
  updateOfficeSnackCandidate
} from '@/features/office-snacks/api/service.server';
import { officeSnackCandidateUpdateSchema } from '@/features/office-snacks/api/validators';
import {
  logOfficeSnackAuthFailure,
  logOfficeSnackValidationError,
  newOfficeSnackRequestId,
  officeSnackActionTargetLabel
} from '../../_utils';

type Params = { params: Promise<{ id: string }> };

function parseCandidateId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = newOfficeSnackRequestId();
  const { id } = await params;
  const candidateId = parseCandidateId(id);
  const httpPath = `/api/office-snacks/candidates/${id}`;

  const session = await requireOfficeSnacksSession();
  if (!session.ok) {
    return logOfficeSnackAuthFailure({
      requestId,
      action: 'office_snack.candidate_update',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(undefined, id),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);
  if (!candidateId) {
    return logOfficeSnackValidationError({
      requestId,
      actor,
      action: 'office_snack.candidate_update',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(undefined, id),
      targetUserId: session.userId,
      message: '후보 ID가 올바르지 않습니다.'
    });
  }

  try {
    const body = await request.json();
    const parsed = officeSnackCandidateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
      return logOfficeSnackValidationError({
        requestId,
        actor,
        action: 'office_snack.candidate_update',
        httpMethod: 'PATCH',
        httpPath,
        targetLabel: officeSnackActionTargetLabel(undefined, candidateId),
        targetUserId: session.userId,
        message
      });
    }

    const candidate = await updateOfficeSnackCandidate({
      candidateId,
      userId: session.userId,
      isAdmin: session.profile.system_role === 'admin',
      payload: parsed.data
    });

    if (!candidate) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'office_snack.candidate_update',
          targetType: 'office_snack',
          targetUserId: session.userId,
          targetLabel: officeSnackActionTargetLabel(undefined, candidateId),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '후보를 찾을 수 없습니다.')
        },
        { success: false, message: '후보를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.candidate_update',
        targetType: 'office_snack',
        targetUserId: session.userId,
        targetLabel: officeSnackActionTargetLabel(candidate.session_id, candidate.id),
        httpMethod: 'PATCH',
        httpPath,
        metadata: { changed_fields: Object.keys(parsed.data) }
      },
      { success: true, message: '후보를 수정했습니다.', candidate },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '후보 수정 중 오류가 발생했습니다.';
    const isClientError =
      message === 'FORBIDDEN_CANDIDATE' ||
      message === 'REGISTRATION_CLOSED' ||
      message === 'SESSION_NOT_FOUND' ||
      message === 'INVALID_URL' ||
      message === 'INVALID_DOMAIN';
    const resolvedMessage =
      message === 'FORBIDDEN_CANDIDATE'
        ? '본인 후보만 수정할 수 있습니다.'
        : message === 'REGISTRATION_CLOSED'
          ? '등록 가능한 기간이 아닙니다.'
          : message === 'SESSION_NOT_FOUND'
            ? '회차를 찾을 수 없습니다.'
            : message === 'INVALID_URL'
              ? '올바른 URL을 입력해 주세요.'
            : message === 'INVALID_DOMAIN'
              ? '쿠팡 링크만 등록할 수 있습니다.'
            : message;

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.candidate_update',
        targetType: 'office_snack',
        targetUserId: session.userId,
        targetLabel: officeSnackActionTargetLabel(undefined, candidateId),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata(
          isClientError ? (message === 'FORBIDDEN_CANDIDATE' ? 'forbidden' : 'validation') : 'internal_error',
          resolvedMessage
        )
      },
      { success: false, message: resolvedMessage },
      isClientError ? (message === 'FORBIDDEN_CANDIDATE' ? 403 : 400) : 500
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = newOfficeSnackRequestId();
  const { id } = await params;
  const candidateId = parseCandidateId(id);
  const httpPath = `/api/office-snacks/candidates/${id}`;

  const session = await requireOfficeSnacksSession();
  if (!session.ok) {
    return logOfficeSnackAuthFailure({
      requestId,
      action: 'office_snack.candidate_delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(undefined, id),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);
  if (!candidateId) {
    return logOfficeSnackValidationError({
      requestId,
      actor,
      action: 'office_snack.candidate_delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(undefined, id),
      targetUserId: session.userId,
      message: '후보 ID가 올바르지 않습니다.'
    });
  }

  try {
    const candidate = await deleteOfficeSnackCandidate({
      candidateId,
      userId: session.userId,
      isAdmin: session.profile.system_role === 'admin'
    });

    if (!candidate) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'office_snack.candidate_delete',
          targetType: 'office_snack',
          targetUserId: session.userId,
          targetLabel: officeSnackActionTargetLabel(undefined, candidateId),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '후보를 찾을 수 없습니다.')
        },
        { success: false, message: '후보를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.candidate_delete',
        targetType: 'office_snack',
        targetUserId: session.userId,
        targetLabel: officeSnackActionTargetLabel(candidate.session_id, candidate.id),
        httpMethod: 'DELETE',
        httpPath,
        metadata: {}
      },
      { success: true, message: '후보를 삭제했습니다.', candidate },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '후보 삭제 중 오류가 발생했습니다.';
    const isClientError =
      message === 'FORBIDDEN_CANDIDATE' ||
      message === 'REGISTRATION_CLOSED' ||
      message === 'SESSION_NOT_FOUND';
    const resolvedMessage =
      message === 'FORBIDDEN_CANDIDATE'
        ? '본인 후보만 삭제할 수 있습니다.'
        : message === 'REGISTRATION_CLOSED'
          ? '등록 가능한 기간이 아닙니다.'
          : message === 'SESSION_NOT_FOUND'
            ? '회차를 찾을 수 없습니다.'
            : message;

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.candidate_delete',
        targetType: 'office_snack',
        targetUserId: session.userId,
        targetLabel: officeSnackActionTargetLabel(undefined, candidateId),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata(
          isClientError ? (message === 'FORBIDDEN_CANDIDATE' ? 'forbidden' : 'validation') : 'internal_error',
          resolvedMessage
        )
      },
      { success: false, message: resolvedMessage },
      isClientError ? (message === 'FORBIDDEN_CANDIDATE' ? 403 : 400) : 500
    );
  }
}
