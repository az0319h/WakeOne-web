import { NextResponse } from 'next/server';
import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  buildChatWriteState,
  buildQuickRequestMessagesPayload,
  createQuickRequestMessage,
  QuickRequestChatLockedError,
  resolveChatAuthorName,
  resolveChatAuthorRole,
  toQuickRequestMessage,
  type QuickRequestMessageRow
} from '@/features/quick-request/api/messages.server';
import { notifyQuickRequestChatMessage } from '@/features/quick-request/api/notifications.server';
import { canViewQuickRequest, getQuickRequestByNo } from '@/features/quick-request/api/workflow.server';
import {
  QUICK_CHAT_MESSAGES,
  quickChatMessageBodySchema
} from '@/features/quick-request/schemas/quick-request-chat';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  parseQuickRequestNoParam,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata,
  readJsonBody
} from '../../_utils';

type Params = { params: Promise<{ requestNo: string }> };

const ACTION = 'quick_request.message_create' as const;
const KNOWN_BODY_MESSAGES = new Set<string>([QUICK_CHAT_MESSAGES.bodyRequired, QUICK_CHAT_MESSAGES.bodyTooLong]);

/**
 * plan 93 — Read: 메시지(오름차순 · 최근 500) + 내 읽음 위치 + 읽음 위치 전원 + 쓰기 가능 여부 + 칩.
 * activity log Out. 권한 없음·미존재는 같은 404 (AC-06).
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { requestNo: rawRequestNo } = await params;
  const requestNo = parseQuickRequestNoParam(rawRequestNo);
  if (!requestNo) {
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
  }

  try {
    const row = await getQuickRequestByNo(requestNo);
    if (!row || !canViewQuickRequest(session.profile, row)) {
      return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
    }

    const data = await buildQuickRequestMessagesPayload(session.profile, row);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request/messages] list failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), { status: 500 });
  }
}

/**
 * plan 93 — 메시지 전송 (요청자 본인·동방특송·admin). 구매물류팀 403 · approved/cancelled 409 · 본문 1~1,000자.
 * 작성과 같은 트랜잭션에서 보낸 사람의 읽음 위치를 올린다(RPC). 알림은 insert 성공 후 `notifyQuickRequestChatMessage`
 * (참여자 − 보낸 사람 − 비활성). 모든 return은 logger.respond → activity log + x-request-id. metadata에 본문 금지.
 */
export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/messages`;
  const session = await requireSession();

  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action: ACTION,
      targetType: QUICK_REQUEST_TARGET,
      targetLabel: rawRequestNo,
      httpMethod: 'POST',
      httpPath,
      response: session.response
    });
  }

  const { profile } = session;
  const logger = createQuickRouteLogger({
    requestId,
    action: ACTION,
    httpMethod: 'POST',
    httpPath,
    profile,
    defaultTargetLabel: rawRequestNo
  });

  const loaded = await loadQuickRequestForMutation({ rawRequestNo, profile, logger });
  if (!loaded.ok) return loaded.response;
  const { row, requestNo } = loaded;

  // 쓰기 역할 (요청자 본인 > 동방 > admin). 구매물류팀은 읽기 전용 — logistics > locked (designer 4.7)
  const authorRole = resolveChatAuthorRole(profile, row);
  if (!authorRole) {
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.logisticsReadOnly), 403, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('forbidden', QUICK_CHAT_MESSAGES.logisticsReadOnly))
    });
  }

  const writeState = buildChatWriteState(profile, row);
  if (!writeState.canWrite) {
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.locked), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', undefined, { status: row.status }))
    });
  }

  const json = await readJsonBody(request);
  if (!json.ok) {
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.invalidBody), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation'))
    });
  }

  const parsed = quickChatMessageBodySchema.safeParse(json.body);
  if (!parsed.success) {
    // 문구는 3종만: 빈 본문 · 1,000자 초과 · 그 밖(객체 아님·body 누락·타입 불일치)은 「요청 형식이 올바르지 않습니다.」
    const issue = parsed.error.issues.find((item) => item.path[0] === 'body');
    const message =
      issue && KNOWN_BODY_MESSAGES.has(issue.message) ? issue.message : QUICK_CHAT_MESSAGES.invalidBody;
    return logger.respond(quickErrorBody(message), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation', message))
    });
  }

  const body = parsed.data.body;
  const authorName = resolveChatAuthorName(profile);

  let created: QuickRequestMessageRow;
  try {
    created = await createQuickRequestMessage({
      requestId: row.id,
      authorUserId: profile.user_id,
      authorName,
      authorRole,
      body
    });
  } catch (error) {
    if (error instanceof QuickRequestChatLockedError) {
      return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.locked), 409, {
        targetLabel: requestNo,
        metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', QUICK_CHAT_MESSAGES.locked))
      });
    }
    console.error('[quick-request/messages] create failed:', error);
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.sendFailed), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error', undefined, { body_length: body.length }))
    });
  }

  // 알림 실패는 전송 응답을 바꾸지 않는다 (safeNotify와 같은 격리 · recipient_count만 비운다)
  let recipientCount: number | undefined;
  try {
    recipientCount = await notifyQuickRequestChatMessage({
      row,
      message: created,
      senderUserId: profile.user_id,
      senderName: authorName
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('[quick-request/notifications] chat_message failed:', message);
  }

  return logger.respond(
    { success: true, data: { message: toQuickRequestMessage(created) } },
    201,
    {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, {
        message_id: Number(created.id),
        body_length: body.length,
        ...(recipientCount !== undefined ? { recipient_count: recipientCount } : {})
      })
    }
  );
}
