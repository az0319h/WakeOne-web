import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { createGoogleTask, listGoogleTasks } from '@/features/google-tasks/api/service.server';
import {
  googleTasksActorEmail,
  googleTasksMutationErrorResponse,
  googleTasksReadErrorResponse,
  googleTasksTargetLabel,
  logGoogleTasksAuthFailure,
  newGoogleTasksRequestId
} from '../../../_utils';

type Params = { params: Promise<{ tasklistId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { tasklistId } = await params;
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const showCompleted = request.nextUrl.searchParams.get('showCompleted') !== 'false';

  try {
    const { tasks } = await listGoogleTasks(
      session.userId,
      googleTasksActorEmail(session.profile),
      tasklistId,
      showCompleted
    );
    return Response.json({
      success: true,
      message: '할 일을 불러왔습니다.',
      tasks
    });
  } catch (error) {
    return googleTasksReadErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = newGoogleTasksRequestId();
  const { tasklistId } = await params;
  const httpPath = `/api/google-tasks/tasklists/${tasklistId}/tasks`;
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.task.create',
      httpMethod: 'POST',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);
  let body: { title?: string; notes?: string; parent?: string; due?: string };
  try {
    body = (await request.json()) as {
      title?: string;
      notes?: string;
      parent?: string;
      due?: string;
    };
  } catch {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.create',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', '요청 형식이 올바르지 않습니다.', {
          tasklist_id: tasklistId
        })
      },
      { success: false, message: '요청 형식이 올바르지 않습니다.' },
      400
    );
  }

  const title = body.title?.trim() ?? '';
  if (!title) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.create',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', '할 일 제목을 입력해 주세요.', {
          tasklist_id: tasklistId
        })
      },
      { success: false, message: '할 일 제목을 입력해 주세요.' },
      400
    );
  }

  try {
    const { task } = await createGoogleTask(
      session.userId,
      googleTasksActorEmail(session.profile),
      tasklistId,
      {
        title,
        notes: body.notes?.trim() || undefined,
        parent: body.parent?.trim() || undefined,
        due: body.due?.trim() || undefined
      }
    );
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.task.create',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId, taskId: task.id, title: task.title }),
        httpMethod: 'POST',
        httpPath,
        metadata: {
          tasklist_id: tasklistId,
          task_id: task.id,
          parent_task_id: body.parent,
          title: task.title
        }
      },
      { success: true, message: '할 일을 추가했습니다.', task },
      201
    );
  } catch (error) {
    return googleTasksMutationErrorResponse({
      requestId,
      action: 'google_tasks.task.create',
      actor,
      httpMethod: 'POST',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId }),
      error,
      metadata: { tasklist_id: tasklistId }
    });
  }
}
