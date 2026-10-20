import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { deleteGoogleTasklist } from '@/features/google-tasks/api/service.server';
import {
  googleTasksActorEmail,
  googleTasksMutationErrorResponse,
  googleTasksTargetLabel,
  logGoogleTasksAuthFailure,
  newGoogleTasksRequestId
} from '../../_utils';

const HTTP_PATH = '/api/google-tasks/tasklists/delete';

export async function POST(request: NextRequest) {
  const requestId = newGoogleTasksRequestId();
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.tasklist.delete',
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      targetLabel: googleTasksTargetLabel({}),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);
  let body: { tasklistId?: string };
  try {
    body = (await request.json()) as { tasklistId?: string };
  } catch {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.tasklist.delete',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({}),
        httpMethod: 'POST',
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('validation', '요청 형식이 올바르지 않습니다.')
      },
      { success: false, message: '요청 형식이 올바르지 않습니다.' },
      400
    );
  }

  const tasklistId = body.tasklistId?.trim() ?? '';
  if (!tasklistId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.tasklist.delete',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({}),
        httpMethod: 'POST',
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('validation', 'tasklistId가 필요합니다.')
      },
      { success: false, message: 'tasklistId가 필요합니다.' },
      400
    );
  }

  try {
    await deleteGoogleTasklist(
      session.userId,
      googleTasksActorEmail(session.profile),
      tasklistId
    );
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.tasklist.delete',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId }),
        httpMethod: 'POST',
        httpPath: HTTP_PATH,
        metadata: { tasklist_id: tasklistId }
      },
      { success: true, message: '목록을 삭제했습니다.' },
      200
    );
  } catch (error) {
    return googleTasksMutationErrorResponse({
      requestId,
      action: 'google_tasks.tasklist.delete',
      actor,
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      targetLabel: googleTasksTargetLabel({ tasklistId }),
      error,
      metadata: { tasklist_id: tasklistId }
    });
  }
}
