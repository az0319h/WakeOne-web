import { NextRequest } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { notifyAnnouncementPublished } from '@/features/announcements/api/service.server';
import { parseAnnouncementId } from '../../_utils';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await requireAdminSession();
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const parsedId = parseAnnouncementId(id);
  if (!parsedId) {
    return Response.json({ success: false, message: '공지 ID가 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const result = await notifyAnnouncementPublished(parsedId);
    if (!result.announcement) {
      return Response.json({ success: false, message: '공지를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: result.notified ? '공지 알림이 발송되었습니다.' : '이미 알림이 발송된 공지입니다.',
      notified: result.notified,
      announcement_id: parsedId,
      announcement: result.announcement
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지 알림 발송 중 오류가 발생했습니다.';
    return Response.json({ success: false, message }, { status: 500 });
  }
}
