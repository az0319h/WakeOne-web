import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { listQuickRequestConversations } from '@/features/quick-request/api/messages.server';
import {
  isQuickChatConversationTab,
  QUICK_CHAT_MESSAGES
} from '@/features/quick-request/schemas/quick-request-chat';
import { quickErrorBody } from '../_utils';

const SEARCH_MAX_LENGTH = 100;

/**
 * plan 93 — 「퀵 대화」 목록 (Read · activity log Out).
 * 범위 = 대시보드와 같은 최근 7일 + 그 밖에 내가 안 읽은 메시지가 있는 건(90일) · 조회 범위(본인 | viewer-all) · 최대 100.
 * 정적 세그먼트 `conversations`가 동적 `[requestNo]`보다 우선한다.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, SEARCH_MAX_LENGTH);
  const tabParam = url.searchParams.get('tab');

  try {
    const data = await listQuickRequestConversations(session.profile, {
      q: q || null,
      tab: isQuickChatConversationTab(tabParam) ? tabParam : 'all'
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request/conversations] list failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), { status: 500 });
  }
}
