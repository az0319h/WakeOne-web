import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession, requireSession } from '@/features/auth/api/session.server';
import {
  deleteAnnouncement,
  getAnnouncementById,
  updateAnnouncement
} from '@/features/announcements/api/service.server';
import { ANNOUNCEMENT_PRIORITIES } from '@/features/announcements/api/types';
import {
  announcementTargetLabel,
  isValidationErrorMessage,
  logAnnouncementAuthFailure,
  newAnnouncementRequestId,
  parseAnnouncementId
} from '../_utils';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const parsedId = parseAnnouncementId(id);
  if (!parsedId) {
    return Response.json({ success: false, message: '공지 ID가 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const announcement = await getAnnouncementById(parsedId);
    if (!announcement) {
      return Response.json({ success: false, message: '공지를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: '공지를 불러왔습니다.',
      announcement
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지를 불러오지 못했습니다.';
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const requestId = newAnnouncementRequestId();
  const { id } = await params;
  const parsedId = parseAnnouncementId(id);
  const httpPath = `/api/announcements/${id}`;

  const session = await requireAdminSession();
  if (!session.ok) {
    return logAnnouncementAuthFailure({
      requestId,
      action: 'announcement.update',
      httpMethod: 'PUT',
      httpPath,
      targetLabel: announcementTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.update',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id }),
        httpMethod: 'PUT',
        httpPath,
        metadata: buildErrorMetadata('validation', '공지 ID가 올바르지 않습니다.')
      },
      { success: false, message: '공지 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      priority?: string;
      is_pinned?: boolean;
    };

    if (
      body.priority &&
      !ANNOUNCEMENT_PRIORITIES.includes(body.priority as (typeof ANNOUNCEMENT_PRIORITIES)[number])
    ) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'announcement.update',
          targetType: 'announcement',
          targetUserId: null,
          targetLabel: announcementTargetLabel({ id: parsedId }),
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata('validation', '우선순위 값이 올바르지 않습니다.')
        },
        { success: false, message: '우선순위 값이 올바르지 않습니다.' },
        400
      );
    }

    const announcement = await updateAnnouncement({
      id: parsedId,
      payload: {
        title: body.title,
        body: body.body,
        priority: body.priority as (typeof ANNOUNCEMENT_PRIORITIES)[number] | undefined,
        is_pinned: body.is_pinned
      }
    });

    if (!announcement) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'announcement.update',
          targetType: 'announcement',
          targetUserId: null,
          targetLabel: announcementTargetLabel({ id: parsedId }),
          httpMethod: 'PUT',
          httpPath,
          metadata: buildErrorMetadata('not_found', '공지를 찾을 수 없습니다.', {
            announcement_id: parsedId
          })
        },
        { success: false, message: '공지를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.update',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id: announcement.id, title: announcement.title }),
        httpMethod: 'PUT',
        httpPath,
        metadata: { announcement_id: announcement.id }
      },
      {
        success: true,
        message: '공지가 수정되었습니다.',
        announcement
      },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지 수정 중 오류가 발생했습니다.';
    const status = isValidationErrorMessage(message) ? 400 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.update',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id: parsedId }),
        httpMethod: 'PUT',
        httpPath,
        metadata: buildErrorMetadata(status === 400 ? 'validation' : 'internal_error', message, {
          announcement_id: parsedId
        })
      },
      { success: false, message },
      status
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = newAnnouncementRequestId();
  const { id } = await params;
  const parsedId = parseAnnouncementId(id);
  const httpPath = `/api/announcements/${id}`;

  const session = await requireAdminSession();
  if (!session.ok) {
    return logAnnouncementAuthFailure({
      requestId,
      action: 'announcement.delete',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: announcementTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.delete',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('validation', '공지 ID가 올바르지 않습니다.')
      },
      { success: false, message: '공지 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const existing = await getAnnouncementById(parsedId);
    if (!existing) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'announcement.delete',
          targetType: 'announcement',
          targetUserId: null,
          targetLabel: announcementTargetLabel({ id: parsedId }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '공지를 찾을 수 없습니다.', {
            announcement_id: parsedId
          })
        },
        { success: false, message: '공지를 찾을 수 없습니다.' },
        404
      );
    }

    const deleted = await deleteAnnouncement(parsedId);
    if (!deleted) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'announcement.delete',
          targetType: 'announcement',
          targetUserId: null,
          targetLabel: announcementTargetLabel({ id: parsedId, title: existing.title }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '공지를 찾을 수 없습니다.', {
            announcement_id: parsedId
          })
        },
        { success: false, message: '공지를 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.delete',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id: parsedId, title: existing.title }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: { announcement_id: parsedId }
      },
      { success: true, message: '공지가 삭제되었습니다.' },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지 삭제 중 오류가 발생했습니다.';
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.delete',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({ id: parsedId }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message, { announcement_id: parsedId })
      },
      { success: false, message },
      500
    );
  }
}
