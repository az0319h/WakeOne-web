import { NextRequest } from 'next/server';
import { actorFromProfile, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { clearCompletedGoogleTasks } from '@/features/google-tasks/api/service.server';
import {
  googleTasksActorEmail,
  googleTasksMutationErrorResponse,
  googleTasksTargetLabel,
  logGoogleTasksAuthFailure,
  newGoogleTasksRequestId
} from '../../../_utils';

type Params = { params: Promise<{ tasklistId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const requestId = newGoogleTasksRequestId();
  const { tasklistId } = await params;
  const httpPath = `/api/google-tasks/tasklists/${tasklistId}/clear-completed`;
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.tasklist.clear_completed',
      httpMethod: 'POST',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  try {
    const { deletedCount } = await clearCompletedGoogleTasks(
      session.userId,
      googleTasksActorEmail(session.profile),
      tasklistId
    );
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.tasklist.clear_completed',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId }),
        httpMethod: 'POST',
        httpPath,
        metadata: { tasklist_id: tasklistId, deleted_count: deletedCount }
      },
      { success: true, message: '완료된 할 일을 삭제했습니다.' },
      200
    );
  } catch (error) {
    return googleTasksMutationErrorResponse({
      requestId,
      action: 'google_tasks.tasklist.clear_completed',
      actor,
      httpMethod: 'POST',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId }),
      error,
      metadata: { tasklist_id: tasklistId }
    });
  }
}
