import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { getQuickRequestSummaryForViewer } from '@/features/quick-request/api/workflow.server';
import { QUICK_REQUEST_MESSAGES } from '@/features/quick-request/schemas/quick-request-workflow';
import { quickErrorBody } from '../_utils';

/**
 * Read — 대시보드 카드 숫자 (designer K5). 목록과 같은 7일·조회 범위, status·search 무시.
 * 정적 세그먼트라 `[requestNo]`보다 우선한다.
 */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const data = await getQuickRequestSummaryForViewer(session.profile);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request/summary] failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_REQUEST_MESSAGES.internalError), {
      status: 500
    });
  }
}
