import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { completeGoogleTask } from '@/features/google-tasks/api/service.server';
import {
  googleTasksActorEmail,
  googleTasksMutationErrorResponse,
  googleTasksTargetLabel,
  logGoogleTasksAuthFailure,
  newGoogleTasksRequestId
} from '../../../_utils';

type Params = { params: Promise<{ taskId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = newGoogleTasksRequestId();
  const { taskId } = await params;
  const httpPath = `/api/google-tasks/tasks/${taskId}/complete`;
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.task.complete',
      httpMethod: 'POST',
      httpPath,
      targetLabel: googleTasksTargetLabel({ taskId }),
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
        action: 'google_tasks.task.complete',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ taskId }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', '요청 형식이 올바르지 않습니다.', {
          task_id: taskId
        })
      },
      { success: false, message: '요청 형식이 올바르지 않습니다.' },
      400
    );
  }

  const tasklistId = body.tasklistId?.trim();
  if (!tasklistId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.complete',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ taskId }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', 'tasklistId가 필요합니다.', { task_id: taskId })
      },
      { success: false, message: 'tasklistId가 필요합니다.' },
      400
    );
  }

  try {
    const { task } = await completeGoogleTask(
      session.userId,
      googleTasksActorEmail(session.profile),
      tasklistId,
      taskId
    );
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.complete',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId, taskId: task.id }),
        httpMethod: 'POST',
        httpPath,
        metadata: { tasklist_id: tasklistId, task_id: task.id }
      },
      { success: true, message: '할 일을 완료했습니다.', task },
      200
    );
  } catch (error) {
    return googleTasksMutationErrorResponse({
      requestId,
      action: 'google_tasks.task.complete',
      actor,
      httpMethod: 'POST',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId, taskId }),
      error,
      metadata: { tasklist_id: tasklistId, task_id: taskId }
    });
  }
}
