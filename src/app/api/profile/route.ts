import { NextRequest } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  formatActorDisplayName,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';

function profileTargetLabel(profile: {
  email: string;
  full_name: string;
}): string {
  const name = formatActorDisplayName(profile);
  return name ? `${name} (${profile.email})` : profile.email;
}

export async function PATCH(request: NextRequest) {
  const requestId = createRequestId();
  const httpPath = '/api/profile';

  try {
    const session = await requireSession();
    if (!session.ok) {
      const status = session.response.status;
      const actor = await resolveLoggingActor(status);
      return finishWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.update',
          targetType: 'profile',
          targetUserId: actor.actorUserId,
          targetLabel: actor.actorEmail,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata(
            status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal_error'
          )
        },
        session.response
      );
    }

    const actor = actorFromProfile(session.profile);
    const targetLabel = profileTargetLabel(session.profile);

    // Consume body if present (clients may still send fields)
    try {
      await request.json();
    } catch {
      // empty or invalid JSON is fine — profile self-edit is disabled regardless
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'profile.update',
        targetType: 'profile',
        targetUserId: session.userId,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata(
          'profile_edit_disabled',
          '프로필 정보는 관리자만 수정할 수 있습니다.'
        )
      },
      { success: false, message: '프로필 정보는 관리자만 수정할 수 있습니다.' },
      403
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const actor = await resolveLoggingActor(500);
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'profile.update',
        targetType: 'profile',
        targetUserId: actor.actorUserId,
        targetLabel: actor.actorEmail,
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}
