import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/admin.server';
import { requireOfficeSnacksSession } from '@/features/auth/api/session.server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import {
  createOfficeSnackSession,
  listOfficeSnackSessions
} from '@/features/office-snacks/api/service.server';
import { officeSnackSessionCreateSchema } from '@/features/office-snacks/api/validators';
import {
  logOfficeSnackAuthFailure,
  logOfficeSnackValidationError,
  newOfficeSnackRequestId,
  officeSnackActionTargetLabel
} from '../_utils';

export async function GET() {
  const session = await requireOfficeSnacksSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const sessions = await listOfficeSnackSessions();
    return NextResponse.json({
      success: true,
      message: '회차 목록을 불러왔습니다.',
      sessions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '회차 목록 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = newOfficeSnackRequestId();
  const httpPath = '/api/office-snacks/sessions';

  const adminSession = await requireAdminSession();
  if (!adminSession.ok) {
    return logOfficeSnackAuthFailure({
      requestId,
      action: 'office_snack.session_create',
      httpMethod: 'POST',
      httpPath,
      targetLabel: officeSnackActionTargetLabel(),
      response: adminSession.response
    });
  }

  const actor = actorFromProfile(adminSession.profile);
  try {
    const body = await request.json();
    const parsed = officeSnackSessionCreateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.';
      return logOfficeSnackValidationError({
        requestId,
        actor,
        action: 'office_snack.session_create',
        httpMethod: 'POST',
        httpPath,
        targetLabel: officeSnackActionTargetLabel(),
        message
      });
    }

    const created = await createOfficeSnackSession(parsed.data, adminSession.userId);
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.session_create',
        targetType: 'office_snack',
        targetUserId: adminSession.userId,
        targetLabel: officeSnackActionTargetLabel(created.id),
        httpMethod: 'POST',
        httpPath,
        metadata: {}
      },
      {
        success: true,
        message: '회차를 생성했습니다.',
        session: created
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '회차 생성 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'office_snack.session_create',
        targetType: 'office_snack',
        targetUserId: adminSession.userId,
        targetLabel: officeSnackActionTargetLabel(),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}
