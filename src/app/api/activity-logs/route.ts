import { NextRequest, NextResponse } from 'next/server';
import { listActivityLogs } from '@/features/activity-logs/api/service.server';
import { requireSession } from '@/features/auth/api/session.server';

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const { searchParams } = request.nextUrl;
    const isAdmin = session.profile.system_role === 'admin';

    const page = Number(searchParams.get('page') ?? 1);
    const limit = Number(searchParams.get('limit') ?? 10);
    const sort = searchParams.get('sort') ?? undefined;
    const action = isAdmin ? (searchParams.get('action') ?? undefined) : undefined;
    const actorSearch = isAdmin ? (searchParams.get('actor_search') ?? undefined) : undefined;
    const search = isAdmin ? (searchParams.get('search') ?? undefined) : undefined;

    const data = await listActivityLogs(session.userId, isAdmin, {
      page,
      limit,
      sort,
      action,
      actor_search: actorSearch,
      search
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
