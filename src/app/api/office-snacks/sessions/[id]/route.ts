import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/admin.server';
import { requireOfficeSnacksSession } from '@/features/auth/api/session.server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import {
  deleteOfficeSnackSession,
  getOfficeSnackSessionDetail,
  updateOfficeSnackSession
} from '@/features/office-snacks/api/service.server';
import { officeSnackSessionUpdateSchema } from '@/features/office-snacks/api/validators';
import {
  logOfficeSnackAuthFailure,
  logOfficeSnackValidationError,
  newOfficeSnackRequestId,
  officeSnackActionTargetLabel
} from '../../_utils';

type Params = { params: Promise<{ id: string }> };

function parseSessionId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireOfficeSnacksSession();
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const sessionId = parseSessionId(id);
  if (!sessionId) {
    return NextResponse.json({ success: false, message: '회차 ID가 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const detail = await getOfficeSnackSessionDetail({
      sessionId,
      userId: session.userId
    });
    if (!detail) {
      return NextResponse.json({ success: false, message: '회차를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: '회차 상세를 불러왔습니다.',
      ...detail
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '회차 상세 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = newOfficeSnackRequestId();
  const { id } = await params;
  const sessionId = parseSessionId(id);
  const httpPath = `/api/office-snacks/sessions/${id}`;

  const adminSession = await requireAdminSession();
  if (!adminSession.ok) {
    return logOfficeSnackAuthFailure({
      requestId,
      action: 'office_snack.session_update',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(id),
      response: adminSession.response
    });
  }

  const actor = actorFromProfile(adminSession.profile);

  if (!sessionId) {
    return logOfficeSnackValidationError({
      requestId,
      actor,
      action: 'office_snack.session_update',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(id),
      message: '회차 ID가 올바르지 않습니다.'
    });
  }

  try {
    const body = await request.json();
    const parsed = officeSnackSessionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
      return logOfficeSnackValidationError({
        requestId,
        actor,
        action: 'office_snack.session_update',
        httpMethod: 'PATCH',
        httpPath,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        message
      });
    }

    if (Object.keys(parsed.data).length === 0) {
      return logOfficeSnackValidationError({
        requestId,
        actor,
        action: 'office_snack.session_update',
        httpMethod: 'PATCH',
        httpPath,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        message: '수정할 항목이 없습니다.'
      });
    }

    const updated = await updateOfficeSnackSession(sessionId, parsed.data, adminSession.userId);
    if (!updated) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'office_snack.session_update',
          targetType: 'office_snack',
          targetUserId: adminSession.userId,
          targetLabel: officeSnackActionTargetLabel(sessionId),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '회차를 찾을 수 없습니다.')
        },
        { success: false, message: '회차를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.session_update',
        targetType: 'office_snack',
        targetUserId: adminSession.userId,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        httpMethod: 'PATCH',
        httpPath,
        metadata: { changed_fields: Object.keys(parsed.data) }
      },
      { success: true, message: '회차를 수정했습니다.', session: updated },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '회차 수정 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.session_update',
        targetType: 'office_snack',
        targetUserId: adminSession.userId,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = newOfficeSnackRequestId();
  const { id } = await params;
  const sessionId = parseSessionId(id);
  const httpPath = `/api/office-snacks/sessions/${id}`;

  const adminSession = await requireAdminSession();
  if (!adminSession.ok) {
    return logOfficeSnackAuthFailure({
      requestId,
      action: 'office_snack.session_delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(id),
      response: adminSession.response
    });
  }

  const actor = actorFromProfile(adminSession.profile);

  if (!sessionId) {
    return logOfficeSnackValidationError({
      requestId,
      actor,
      action: 'office_snack.session_delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(id),
      message: '회차 ID가 올바르지 않습니다.'
    });
  }

  try {
    const deleted = await deleteOfficeSnackSession(sessionId);

    if (!deleted) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'office_snack.session_delete',
          targetType: 'office_snack',
          targetUserId: adminSession.userId,
          targetLabel: officeSnackActionTargetLabel(sessionId),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '회차를 찾을 수 없습니다.')
        },
        { success: false, message: '회차를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.session_delete',
        targetType: 'office_snack',
        targetUserId: adminSession.userId,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        httpMethod: 'DELETE',
        httpPath,
        metadata: { session_state: deleted.state }
      },
      { success: true, message: '회차를 삭제했습니다.', session: deleted },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '회차 삭제 중 오류가 발생했습니다.';
    const isClientError = message === 'SESSION_DELETE_FORBIDDEN';
    const resolvedMessage =
      message === 'SESSION_DELETE_FORBIDDEN'
        ? '종료된 회차는 삭제할 수 없습니다.'
        : message;

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.session_delete',
        targetType: 'office_snack',
        targetUserId: adminSession.userId,
        targetLabel: officeSnackActionTargetLabel(sessionId),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata(
          isClientError ? 'forbidden' : 'internal_error',
          resolvedMessage
        )
      },
      { success: false, message: resolvedMessage },
      isClientError ? 403 : 500
    );
  }
}
