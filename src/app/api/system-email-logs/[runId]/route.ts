import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/session.server';
import { getSystemEmailLogRunDetail } from '@/features/system-email-logs/api/service.server';

type RouteContext = {
  params: Promise<{ runId: string }>;
};

function parseRunId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await requireAdminSession();
  if (!session.ok) {
    return session.response;
  }

  const { runId: runIdRaw } = await context.params;
  const runId = parseRunId(runIdRaw);
  if (!runId) {
    return NextResponse.json({ success: false, message: '유효하지 않은 run ID입니다.' }, { status: 400 });
  }

  try {
    const run = await getSystemEmailLogRunDetail(runId);
    if (!run) {
      return NextResponse.json({ success: false, message: '시스템 이메일 run을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { run }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
