import { NextResponse } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  markQuickChatNotificationsRead,
  markQuickRequestMessagesRead,
  messageBelongsToRequest
} from '@/features/quick-request/api/messages.server';
import { canViewQuickRequest, getQuickRequestByNo } from '@/features/quick-request/api/workflow.server';
import {
  QUICK_CHAT_MESSAGES,
  quickChatMarkReadBodySchema
} from '@/features/quick-request/schemas/quick-request-chat';
import { parseQuickRequestNoParam, quickErrorBody, readJsonBody } from '../../../_utils';

type Params = { params: Promise<{ requestNo: string }> };

/**
 * plan 93 — 읽음 위치 갱신 (`mark_quick_request_messages_read` · greatest · 뒤로 가지 않음)
 * + C-21 그 건의 `quick_request.chat_message` 알림 중 본인·unread → read.
 *
 * **activity log Out (plan 93 §활동 감사 로그 · core-conventions 「모든 CUD 기록」의 명시적 예외):**
 * 화면에 메시지가 보이면 자동 호출되는 표시용 상태라 사용자 결정 행위가 아니고, 대화를 볼 때마다 호출되어 감사 로그가
 * 노이즈로 가득 찬다. 「누가 언제 읽었는지」는 `quick_request_message_reads.last_read_at`에 남는다.
 * 같은 이유로 알림 자동 읽음도 `notification.read` action을 쓰지 않는다.
 */
export async function PUT(request: Request, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { requestNo: rawRequestNo } = await params;
  const requestNo = parseQuickRequestNoParam(rawRequestNo);
  if (!requestNo) {
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
  }

  const json = await readJsonBody(request);
  if (!json.ok) {
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.invalidBody), { status: 400 });
  }

  const parsed = quickChatMarkReadBodySchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.invalidBody), { status: 400 });
  }

  try {
    const row = await getQuickRequestByNo(requestNo);
    if (!row || !canViewQuickRequest(session.profile, row)) {
      return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
    }

    const { lastMessageId } = parsed.data;
    if (lastMessageId > 0 && !(await messageBelongsToRequest(row.id, lastMessageId))) {
      return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.messageNotFound), { status: 404 });
    }

    const lastReadMessageId = await markQuickRequestMessagesRead(session.userId, row.id, lastMessageId);
    const notificationsMarkedRead = await markQuickChatNotificationsRead(session.userId, row.id);

    return NextResponse.json({ success: true, data: { lastReadMessageId, notificationsMarkedRead } });
  } catch (error) {
    console.error('[quick-request/messages/read] failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), { status: 500 });
  }
}
