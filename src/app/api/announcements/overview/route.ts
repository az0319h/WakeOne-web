import { requireSession } from '@/features/auth/api/session.server';
import { listAnnouncementsOverview } from '@/features/announcements/api/service.server';

export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const announcements = await listAnnouncementsOverview();
    return Response.json({ success: true, data: { announcements } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지 요약을 불러오지 못했습니다.';
    return Response.json({ success: false, message }, { status: 500 });
  }
}
