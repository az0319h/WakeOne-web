import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { listSystemEmailLogRuns } from '@/features/system-email-logs/api/service.server';

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const { searchParams } = request.nextUrl;
    const page = Number(searchParams.get('page') ?? 1);
    const limit = Number(searchParams.get('limit') ?? 10);
    const sort = searchParams.get('sort') ?? undefined;

    const data = await listSystemEmailLogRuns({
      page,
      limit,
      sort
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
