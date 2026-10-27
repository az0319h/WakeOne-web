import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { fetchQuickRequestUnreadTotal } from '@/features/quick-request/api/messages.server';
import { QUICK_CHAT_MESSAGES } from '@/features/quick-request/schemas/quick-request-chat';
import { quickErrorBody } from '../_utils';

/**
 * plan 93 C-22 — 사이드바 「퀵 대화」 배지: 내가 볼 수 있는 모든 퀵 건의 안 읽은 메시지 합계 (90일 상한 · RPC 1회).
 * Read · activity log Out.
 */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  try {
    const total = await fetchQuickRequestUnreadTotal(session.userId);
    return NextResponse.json({ success: true, data: { total } });
  } catch (error) {
    console.error('[quick-request/unread-total] failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), { status: 500 });
  }
}
