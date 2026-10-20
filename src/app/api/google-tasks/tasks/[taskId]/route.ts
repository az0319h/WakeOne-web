import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { deleteGoogleTask, updateGoogleTask } from '@/features/google-tasks/api/service.server';
import {
  googleTasksActorEmail,
  googleTasksMutationErrorResponse,
  googleTasksTargetLabel,
  logGoogleTasksAuthFailure,
  newGoogleTasksRequestId
} from '../../_utils';

type Params = { params: Promise<{ taskId: string }> };

function parseTasklistId(body: { tasklistId?: string }): string | null {
  const value = body.tasklistId?.trim();
  return value ? value : null;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = newGoogleTasksRequestId();
  const { taskId } = await params;
  const httpPath = `/api/google-tasks/tasks/${taskId}`;
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.task.update',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: googleTasksTargetLabel({ taskId }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);
  let body: { tasklistId?: string; title?: string; notes?: string; due?: string | null };
  try {
    body = (await request.json()) as {
      tasklistId?: string;
      title?: string;
      notes?: string;
      due?: string | null;
    };
  } catch {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.update',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ taskId }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('validation', '요청 형식이 올바르지 않습니다.', {
          task_id: taskId
        })
      },
      { success: false, message: '요청 형식이 올바르지 않습니다.' },
      400
    );
  }

  const tasklistId = parseTasklistId(body);
  if (!tasklistId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.update',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ taskId }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('validation', 'tasklistId가 필요합니다.', { task_id: taskId })
      },
      { success: false, message: 'tasklistId가 필요합니다.' },
      400
    );
  }

  try {
    const { task } = await updateGoogleTask(
      session.userId,
      googleTasksActorEmail(session.profile),
      tasklistId,
      taskId,
      {
        title: body.title?.trim(),
        notes: body.notes?.trim(),
        due: body.due ?? undefined
      }
    );
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.update',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId, taskId: task.id }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: { tasklist_id: tasklistId, task_id: task.id }
      },
      { success: true, message: '할 일을 수정했습니다.', task },
      200
    );
  } catch (error) {
    return googleTasksMutationErrorResponse({
      requestId,
      action: 'google_tasks.task.update',
      actor,
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId, taskId }),
      error,
      metadata: { tasklist_id: tasklistId, task_id: taskId }
    });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const requestId = newGoogleTasksRequestId();
  const { taskId } = await params;
  const httpPath = `/api/google-tasks/tasks/${taskId}`;
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.task.delete',
      httpMethod: 'DELETE',
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
        action: 'google_tasks.task.delete',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ taskId }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('validation', '요청 형식이 올바르지 않습니다.', {
          task_id: taskId
        })
      },
      { success: false, message: '요청 형식이 올바르지 않습니다.' },
      400
    );
  }

  const tasklistId = parseTasklistId(body);
  if (!tasklistId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.delete',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ taskId }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('validation', 'tasklistId가 필요합니다.', { task_id: taskId })
      },
      { success: false, message: 'tasklistId가 필요합니다.' },
      400
    );
  }

  try {
    await deleteGoogleTask(
      session.userId,
      googleTasksActorEmail(session.profile),
      tasklistId,
      taskId
    );
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.delete',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId, taskId }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: { tasklist_id: tasklistId, task_id: taskId }
      },
      { success: true, message: '할 일을 삭제했습니다.' },
      200
    );
  } catch (error) {
    return googleTasksMutationErrorResponse({
      requestId,
      action: 'google_tasks.task.delete',
      actor,
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId, taskId }),
      error,
      metadata: { tasklist_id: tasklistId, task_id: taskId }
    });
  }
}
