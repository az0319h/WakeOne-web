import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  createGoogleTasklist,
  listGoogleTasklists
} from '@/features/google-tasks/api/service.server';
import {
  googleTasksActorEmail,
  googleTasksReadErrorResponse,
  googleTasksMutationErrorResponse,
  googleTasksTargetLabel,
  logGoogleTasksAuthFailure,
  newGoogleTasksRequestId
} from '../_utils';

const HTTP_PATH = '/api/google-tasks/tasklists';

export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const { tasklists } = await listGoogleTasklists(
      session.userId,
      googleTasksActorEmail(session.profile)
    );
    return Response.json({
      success: true,
      message: '목록을 불러왔습니다.',
      tasklists
    });
  } catch (error) {
    return googleTasksReadErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const requestId = newGoogleTasksRequestId();
  const session = await requireSession();
  if (!session.ok) {
    return logGoogleTasksAuthFailure({
      requestId,
      action: 'google_tasks.tasklist.create',
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      targetLabel: googleTasksTargetLabel({}),
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
        action: 'google_tasks.tasklist.create',
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

  const title = body.title?.trim() ?? '';
  if (!title) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.tasklist.create',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({}),
        httpMethod: 'POST',
        httpPath: HTTP_PATH,
        metadata: buildErrorMetadata('validation', '목록 제목을 입력해 주세요.')
      },
      { success: false, message: '목록 제목을 입력해 주세요.' },
      400
    );
  }

  try {
    const { tasklist } = await createGoogleTasklist(
      session.userId,
      googleTasksActorEmail(session.profile),
      title
    );
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'google_tasks.tasklist.create',
        targetType: 'google_tasks',
        targetUserId: session.userId,
        targetLabel: googleTasksTargetLabel({ tasklistId: tasklist.id, title: tasklist.title }),
        httpMethod: 'POST',
        httpPath: HTTP_PATH,
        metadata: { tasklist_id: tasklist.id, title: tasklist.title }
      },
      { success: true, message: '목록을 만들었습니다.', tasklist },
      201
    );
  } catch (error) {
    return googleTasksMutationErrorResponse({
      requestId,
      action: 'google_tasks.tasklist.create',
      actor,
      httpMethod: 'POST',
      httpPath: HTTP_PATH,
      targetLabel: googleTasksTargetLabel({ title }),
      error
    });
  }
}
