import { NextRequest, NextResponse } from 'next/server';
import { listNotifications } from '@/features/notifications/api/service.server';
import { requireSession } from '@/features/auth/api/session.server';

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const { searchParams } = request.nextUrl;
    const isAdmin = session.profile.system_role === 'admin';
    const limit = Number(searchParams.get('limit') ?? 10);
    const cursor = searchParams.get('cursor') ?? undefined;
    const notifUser = isAdmin ? (searchParams.get('notif_user') ?? 'self') : undefined;

    const data = await listNotifications(session.userId, isAdmin, {
      limit,
      cursor,
      notif_user: notifUser
    });

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
