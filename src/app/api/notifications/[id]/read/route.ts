import { NextRequest } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  getNotificationById,
  markNotificationRead
} from '@/features/notifications/api/service.server';

type Params = { params: Promise<{ id: string }> };

function profileTargetLabel(profile: {
  email: string;
  full_name: string | null;
}): string {
  const name = profile.full_name?.trim() ?? '';
  return name ? `${name} (${profile.email})` : profile.email;
}

export async function PATCH(_request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  const { id: idParam } = await params;
  const httpPath = `/api/notifications/${idParam}/read`;
  const notificationId = Number(idParam);

  const session = await requireSession();
  if (!session.ok) {
    const status = session.response.status;
    const actor = await resolveLoggingActor(status);
    return finishWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'notification.read',
        targetType: 'user',
        targetUserId: actor.actorUserId,
        targetLabel: actor.actorEmail,
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata(
          status === 401 ? 'unauthenticated' : 'forbidden'
        )
      },
      session.response
    );
  }

  const actor = actorFromProfile(session.profile);
  const targetLabel = profileTargetLabel(session.profile);

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'notification.read',
        targetType: 'user',
        targetUserId: session.userId,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('not_found', '알림을 찾을 수 없습니다.')
      },
      { success: false, message: '알림을 찾을 수 없습니다.' },
      404
    );
  }

  try {
    const existing = await getNotificationById(notificationId);

    if (!existing) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'notification.read',
          targetType: 'user',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '알림을 찾을 수 없습니다.')
        },
        { success: false, message: '알림을 찾을 수 없습니다.' },
        404
      );
    }

    if (existing.recipient_user_id !== session.userId) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'notification.read',
          targetType: 'user',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('forbidden', '본인 알림만 읽음 처리할 수 있습니다.')
        },
        { success: false, message: '본인 알림만 읽음 처리할 수 있습니다.' },
        403
      );
    }

    const updated = await markNotificationRead(notificationId, session.userId);

    if (!updated) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'notification.read',
          targetType: 'user',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '알림을 찾을 수 없습니다.')
        },
        { success: false, message: '알림을 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'notification.read',
        targetType: 'user',
        targetUserId: session.userId,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath,
        metadata: { notification_id: notificationId }
      },
      {
        success: true,
        data: {
          notification: {
            id: updated.id,
            type: updated.type,
            title: updated.title,
            body: updated.body,
            status: updated.status,
            created_at: updated.created_at,
            read_at: updated.read_at,
            metadata: updated.metadata
          }
        }
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'notification.read',
        targetType: 'user',
        targetUserId: session.userId,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}
