import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  deleteGoogleTasklist,
  updateGoogleTasklist
} from '@/features/google-tasks/api/service.server';
import {
  googleTasksActorEmail,
  googleTasksMutationErrorResponse,
  googleTasksTargetLabel,
  logGoogleTasksAuthFailure,
  newGoogleTasksRequestId
} from '../../_utils';

type Params = { params: Promise<{ tasklistId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = newGoogleTasksRequestId();
  const { tasklistId } = await params;
  const httpPath = `/api/google-tasks/tasklists/${tasklistId}`;
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.tasklist.update',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);
  let body: { title?: string };
  try {
    body = (await request.json()) as { title?: string };
  } catch {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.tasklist.update',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId }),
        httpMethod: 'PATCH',
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
        action: 'google_tasks.tasklist.update',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('validation', '목록 제목을 입력해 주세요.', {
          tasklist_id: tasklistId
        })
      },
      { success: false, message: '목록 제목을 입력해 주세요.' },
      400
    );
  }

  try {
    const { tasklist } = await updateGoogleTasklist(
      session.userId,
      googleTasksActorEmail(session.profile),
      tasklistId,
      title
    );
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.tasklist.update',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId: tasklist.id, title: tasklist.title }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: { tasklist_id: tasklist.id, title: tasklist.title }
      },
      { success: true, message: '목록을 수정했습니다.', tasklist },
      200
    );
  } catch (error) {
    return googleTasksMutationErrorResponse({
      requestId,
      action: 'google_tasks.tasklist.update',
      actor,
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId }),
      error,
      metadata: { tasklist_id: tasklistId }
    });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = newGoogleTasksRequestId();
  const { tasklistId: rawTasklistId } = await params;
  const tasklistId = decodeURIComponent(rawTasklistId).trim();
  const httpPath = `/api/google-tasks/tasklists/${tasklistId}`;
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.tasklist.delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

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
        httpMethod: 'DELETE',
        httpPath,
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
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: googleTasksTargetLabel({ tasklistId }),
      error,
      metadata: { tasklist_id: tasklistId }
    });
  }
}
