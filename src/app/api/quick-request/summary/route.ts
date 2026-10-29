import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { getQuickRequestSummaryForViewer } from '@/features/quick-request/api/workflow.server';
import { parseQuickRange } from '@/features/quick-request/lib/quick-request-range';
import { QUICK_REQUEST_MESSAGES } from '@/features/quick-request/schemas/quick-request-workflow';
import { quickErrorBody } from '../_utils';

/**
 * Read — 대시보드 카드 숫자 (designer K5 · plan 97 D-4). 목록과 같은 기간(`range`·`from`·`to`)·조회 범위, status·search 무시.
 * 잘못된 `range`는 7d로 정정(200) · custom `from > to`는 400 「기간을 확인해 주세요.」
 * 정적 세그먼트라 `[requestNo]`보다 우선한다.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const url = new URL(request.url);
  const parsedRange = parseQuickRange({
    range: url.searchParams.get('range'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to')
  });
  if (!parsedRange.ok) {
    return NextResponse.json(quickErrorBody(parsedRange.message), { status: 400 });
  }

  try {
    const data = await getQuickRequestSummaryForViewer(session.profile, parsedRange.range);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request/summary] failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_REQUEST_MESSAGES.internalError), {
      status: 500
    });
  }
}
