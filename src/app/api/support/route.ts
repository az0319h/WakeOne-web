import { NextRequest } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { buildSupportFilters } from '@/features/support/api/filter-utils';
import {
  insertSupportAdminNotifications
} from '@/features/notifications/api/fan-out.server';
import {
  createSupportRequest,
  listSupportRequests,
  truncateSupportTitle
} from '@/features/support/api/service.server';
import {
  isSupportValidationErrorMessage,
  logSupportAuthFailure,
  newSupportRequestId,
  supportTargetLabel
} from './_utils';

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = request.nextUrl;
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const isAdmin = session.profile.system_role === 'admin';
  const submittedByParam = searchParams.get('submitted_by');

  if (submittedByParam && !isAdmin) {
    return Response.json(
      { success: false, message: '해당 필터를 사용할 권한이 없습니다.' },
      { status: 403 }
    );
  }

  try {
    const data = await listSupportRequests(
      buildSupportFilters({
        limit: Number.isFinite(limit) ? limit : undefined,
        cursor: searchParams.get('cursor') ?? undefined,
        search: searchParams.get('search'),
        status: searchParams.get('status'),
        submitted_by: isAdmin ? (submittedByParam ?? undefined) : undefined
      })
    );

    return Response.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '문의 목록을 불러오지 못했습니다.';
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = newSupportRequestId();
  const httpPath = '/api/support';

  const session = await requireSession();
  if (!session.ok) {
    return logSupportAuthFailure({
      requestId,
      action: 'support.create',
      httpMethod: 'POST',
      httpPath,
      targetLabel: supportTargetLabel({}),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  try {
    const body = (await request.json()) as { title?: string; body?: string };

    if (typeof body.title !== 'string' || typeof body.body !== 'string') {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.create',
          targetType: 'support_request',
          targetUserId: session.userId,
          targetLabel: supportTargetLabel({ title: body.title }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '제목과 본문이 필요합니다.')
        },
        { success: false, message: '제목과 본문이 필요합니다.' },
        400
      );
    }

    const created = await createSupportRequest({
      payload: { title: body.title, body: body.body },
      profile: session.profile
    });

    try {
      await insertSupportAdminNotifications({
        actorUserId: session.userId,
        supportRequestId: created.id,
        title: truncateSupportTitle(created.title),
        preview: created.body,
        type: 'support.created'
      });
    } catch (notificationError) {
      const message =
        notificationError instanceof Error ? notificationError.message : 'Unknown error';
      console.error('[support] create notification fan-out failed:', message);
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.create',
        targetType: 'support_request',
        targetUserId: session.userId,
        targetLabel: supportTargetLabel({ id: created.id, title: created.title }),
        httpMethod: 'POST',
        httpPath,
        metadata: {
          support_request_id: created.id,
          title: truncateSupportTitle(created.title),
          body_length: created.body.trim().length
        }
      },
      {
        success: true,
        message: '문의가 접수되었습니다.',
        request: created
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '문의 등록 중 오류가 발생했습니다.';
    const status = isSupportValidationErrorMessage(message) ? 400 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.create',
        targetType: 'support_request',
        targetUserId: session.userId,
        targetLabel: supportTargetLabel({}),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(status === 400 ? 'validation' : 'internal_error', message)
      },
      { success: false, message },
      status
    );
  }
}
