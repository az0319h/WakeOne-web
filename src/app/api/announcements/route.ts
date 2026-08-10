import { NextRequest } from 'next/server';
import { actorFromProfile, buildErrorMetadata, jsonWithActivityLog } from '@/features/activity-logs/api/log.server';
import { requireAdminSession, requireSession } from '@/features/auth/api/session.server';
import { buildAnnouncementsFilters } from '@/features/announcements/api/filter-utils';
import { createAnnouncement, listAnnouncements } from '@/features/announcements/api/service.server';
import { ANNOUNCEMENT_PRIORITIES } from '@/features/announcements/api/types';
import {
  announcementTargetLabel,
  isValidationErrorMessage,
  logAnnouncementAuthFailure,
  newAnnouncementRequestId
} from './_utils';

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = request.nextUrl;
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const data = await listAnnouncements(
      buildAnnouncementsFilters({
        limit: Number.isFinite(limit) ? limit : undefined,
        cursor: searchParams.get('cursor') ?? undefined,
        search: searchParams.get('search'),
        priority: searchParams.get('priority'),
        pinned: searchParams.get('pinned')
      })
    );

    return Response.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지 목록을 불러오지 못했습니다.';
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = newAnnouncementRequestId();
  const httpPath = '/api/announcements';

  const session = await requireAdminSession();
  if (!session.ok) {
    return logAnnouncementAuthFailure({
      requestId,
      action: 'announcement.create',
      httpMethod: 'POST',
      httpPath,
      targetLabel: announcementTargetLabel({}),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  try {
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      priority?: string;
      is_pinned?: boolean;
      defer_notify?: boolean;
    };

    if (typeof body.title !== 'string' || typeof body.body !== 'string') {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'announcement.create',
          targetType: 'announcement',
          targetUserId: null,
          targetLabel: announcementTargetLabel({ title: body.title }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '제목과 본문이 필요합니다.')
        },
        { success: false, message: '제목과 본문이 필요합니다.' },
        400
      );
    }

    if (body.priority && !ANNOUNCEMENT_PRIORITIES.includes(body.priority as (typeof ANNOUNCEMENT_PRIORITIES)[number])) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'announcement.create',
          targetType: 'announcement',
          targetUserId: null,
          targetLabel: announcementTargetLabel({ title: body.title }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '우선순위 값이 올바르지 않습니다.')
        },
        { success: false, message: '우선순위 값이 올바르지 않습니다.' },
        400
      );
    }

    const result = await createAnnouncement({
      payload: {
        title: body.title,
        body: body.body,
        priority: body.priority as (typeof ANNOUNCEMENT_PRIORITIES)[number] | undefined,
        is_pinned: body.is_pinned,
        defer_notify: body.defer_notify
      },
      actorUserId: session.userId
    });

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.create',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({
          id: result.announcement.id,
          title: result.announcement.title
        }),
        httpMethod: 'POST',
        httpPath,
        metadata: {
          announcement_id: result.announcement.id,
          status: result.fanOutCompleted ? 'notified' : 'notify_deferred'
        }
      },
      {
        success: true,
        message: '공지가 등록되었습니다.',
        announcement: result.announcement
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지 등록 중 오류가 발생했습니다.';
    const status = isValidationErrorMessage(message) ? 400 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'announcement.create',
        targetType: 'announcement',
        targetUserId: null,
        targetLabel: announcementTargetLabel({}),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(status === 400 ? 'validation' : 'internal_error', message)
      },
      { success: false, message },
      status
    );
  }
}
