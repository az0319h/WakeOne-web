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
import { markAllNotificationsRead } from '@/features/notifications/api/service.server';

function profileTargetLabel(profile: {
  email: string;
  full_name: string | null;
}): string {
  const name = profile.full_name?.trim() ?? '';
  return name ? `${name} (${profile.email})` : profile.email;
}

export async function PATCH(_request: NextRequest) {
  const requestId = createRequestId();
  const httpPath = '/api/notifications/read-all';

  const session = await requireSession();
  if (!session.ok) {
    const status = session.response.status;
    const actor = await resolveLoggingActor(status);
    return finishWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'notification.read_all',
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

  try {
    const count = await markAllNotificationsRead(session.userId);

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'notification.read_all',
        targetType: 'user',
        targetUserId: session.userId,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath,
        metadata: { count }
      },
      { success: true, data: { count } },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'notification.read_all',
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
