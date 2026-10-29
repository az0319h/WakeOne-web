import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { decodeConversationCursor } from '@/features/quick-request/api/cursor.server';
import { listQuickRequestConversations } from '@/features/quick-request/api/messages.server';
import { parseQuickRange } from '@/features/quick-request/lib/quick-request-range';
import {
  isQuickChatConversationTab,
  QUICK_CHAT_MESSAGES
} from '@/features/quick-request/schemas/quick-request-chat';
import { quickErrorBody } from '../_utils';

const SEARCH_MAX_LENGTH = 100;

function parsePositiveInt(value: string | null): number | undefined {
  if (!value || !/^\d{1,6}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}

/**
 * plan 93/97 — 「퀵 대화」 목록 (Read · activity log Out).
 * 범위 = 선택 기간(`range`·`from`·`to` · 기본 7d) + 그 밖에 내가 안 읽은 메시지가 있는 건(90일 · 기간 무관) · 조회 범위(본인 | viewer-all).
 * `cursor`(opaque) · `limit`(기본 20 · ≤50) → `{conversations, nextCursor, totals?(첫 페이지)}`.
 * 잘못된 cursor는 400 「요청 형식이 올바르지 않습니다.」 · custom `from > to`는 400 「기간을 확인해 주세요.」
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

  const parsedRange = parseQuickRange({
    range: url.searchParams.get('range'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to')
  });
  if (!parsedRange.ok) {
    return NextResponse.json(quickErrorBody(parsedRange.message), { status: 400 });
  }

  const cursorParam = url.searchParams.get('cursor');
  const cursor = cursorParam ? decodeConversationCursor(cursorParam) : null;
  if (cursorParam && !cursor) {
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.invalidBody), { status: 400 });
  }

  try {
    const data = await listQuickRequestConversations(session.profile, {
      q: q || null,
      tab: isQuickChatConversationTab(tabParam) ? tabParam : 'all',
      range: parsedRange.range,
      cursor,
      limit: parsePositiveInt(url.searchParams.get('limit'))
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request/conversations] list failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), { status: 500 });
  }
}
