import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { moveGoogleTask } from '@/features/google-tasks/api/service.server';
import {
  googleTasksActorEmail,
  googleTasksMutationErrorResponse,
  googleTasksTargetLabel,
  logGoogleTasksAuthFailure,
  newGoogleTasksRequestId
} from '../../_utils';

const HTTP_PATH = '/api/google-tasks/tasks/move';

export async function POST(request: NextRequest) {
  const requestId = newGoogleTasksRequestId();
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.task.move',
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      targetLabel: googleTasksTargetLabel({}),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);
  let body: {
    tasklistId?: string;
    taskId?: string;
    destinationTasklistId?: string;
    previous?: string;
    parent?: string;
  };
  try {
    body = (await request.json()) as {
      tasklistId?: string;
      taskId?: string;
      destinationTasklistId?: string;
      previous?: string;
      parent?: string;
    };
  } catch {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.move',
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

  const tasklistId = body.tasklistId?.trim();
  const taskId = body.taskId?.trim();
  if (!tasklistId || !taskId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.move',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ taskId, tasklistId }),
        httpMethod: 'POST',
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('validation', 'tasklistId와 taskId가 필요합니다.', {
          tasklist_id: tasklistId,
          task_id: taskId
        })
      },
      { success: false, message: 'tasklistId와 taskId가 필요합니다.' },
      400
    );
  }

  const destinationTasklistId = body.destinationTasklistId?.trim();

  try {
    const { task } = await moveGoogleTask(
      session.userId,
      googleTasksActorEmail(session.profile),
      {
        tasklistId,
        taskId,
        destinationTasklistId: destinationTasklistId || undefined,
        previous: body.previous?.trim() || undefined,
        parent: body.parent?.trim() || undefined
      }
    );
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.move',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({
          tasklistId: destinationTasklistId ?? tasklistId,
          taskId: task.id
        }),
        httpMethod: 'POST',
        httpPath: HTTP_PATH,
        metadata: {
          tasklist_id: destinationTasklistId ?? tasklistId,
          task_id: task.id,
          previous_tasklist_id: destinationTasklistId ? tasklistId : undefined,
          parent_task_id: body.parent
        }
      },
      { success: true, message: '할 일을 이동했습니다.', task },
      200
    );
  } catch (error) {
    return googleTasksMutationErrorResponse({
      requestId,
      action: 'google_tasks.task.move',
      actor,
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      targetLabel: googleTasksTargetLabel({ tasklistId, taskId }),
      error,
      metadata: {
        tasklist_id: tasklistId,
        task_id: taskId,
        previous_tasklist_id: destinationTasklistId ? tasklistId : undefined
      }
    });
  }
}
