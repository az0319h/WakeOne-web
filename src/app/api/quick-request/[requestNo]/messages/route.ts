import { after, NextResponse } from 'next/server';
import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  QuickChatAttachmentError,
  sumAttachmentBytes,
  verifyPendingQuickChatAttachments,
  type QuickRequestMessageAttachmentRow
} from '@/features/quick-request/api/attachments.server';
import {
  buildQuickRequestMessagesPayload,
  createQuickRequestMessage,
  QuickRequestMessageRpcError,
  resolveChatAuthorName,
  resolveChatAuthorRole,
  toQuickRequestMessage,
  type QuickRequestMessageRow
} from '@/features/quick-request/api/messages.server';
import {
  notifyQuickRequestChatMessage,
  safeNotify
} from '@/features/quick-request/api/notifications.server';
import { getQuickRequestByNo, resolveQuickRequestAccess } from '@/features/quick-request/api/workflow.server';
import { QUICK_CHAT_ATTACHMENT_MESSAGES } from '@/features/quick-request/schemas/quick-request-attachment';
import {
  isQuickChatMessageEmpty,
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
const KNOWN_BODY_MESSAGES = new Set<string>([QUICK_CHAT_MESSAGES.bodyTooLong, QUICK_CHAT_ATTACHMENT_MESSAGES.tooMany]);

/**
 * plan 93 — Read: 메시지(오름차순 · 최근 500) + 내 읽음 위치 + 읽음 위치 전원 + 쓰기 가능 여부 + 칩.
 * plan 101 — `participants[]`·`events[]`·`viewer.canManageParticipants`·`viewer.role='participant'`(초대 참여자).
 * plan 98 — `messages[].attachments[]`(빈 배열이라도 항상 존재 · URL은 지연 조회).
 * plan 100 — `aiSuggest: { enabled }` (= env ON && canWrite · FE AI 답장 추천 호출 여부).
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
    // plan 101 — 활성 초대 참여자도 조회 · viewer.role='participant' · participants/events 동봉
    const access = row ? await resolveQuickRequestAccess(session.profile, row) : null;
    if (!row || !access?.canView) {
      return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.notFound), { status: 404 });
    }

    const data = await buildQuickRequestMessagesPayload(session.profile, row, { isParticipant: access.isParticipant });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[quick-request/messages] list failed:', error);
    return NextResponse.json(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), { status: 500 });
  }
}

/**
 * plan 93 — 메시지 전송 (요청자 본인·동방특송·admin). 구매물류팀 403 · 본문 ≤ 1,000자.
 * plan 94 D-12 — 승인·취소 건도 201 (잠금 분기·409 삭제 · SQL 93에서 RPC 잠금 제거).
 * plan 94 D-2 — insert(RPC) 성공 직후 201을 돌려주고, 알림(`notifyQuickRequestChatMessage`)은 `after()`에서 실행한다.
 * plan 98 D-4 — `{ body, attachmentIds }`: 본문은 첨부 ≥ 1이면 `''` 허용 · 둘 다 없으면 400 「메시지를 입력하거나 파일을 첨부해 주세요.」
 *   · pending 첨부 검증(소유·건 → 400 mismatch · Storage 객체 없음 → 400 notUploaded · 크기/MIME 불일치 → 409 + 행 삭제)
 *   → RPC `p_attachment_ids`(한 트랜잭션 연결). 로그 metadata `{quick_request_no, message_id, body_length, attachment_count, total_bytes}`
 *   (파일명·storage_path 금지). 모든 return은 logger.respond → activity log + x-request-id.
 *
 * return 매트릭스: 401/403(session) · 404(형식·미존재·조회 불가) · 500(조회) · 403(logistics) · 400(JSON) · 400(zod: 1,000자·30개·형식)
 *   · 400(빈 본문+첨부 0) · 400(mismatch/notUploaded) · 409(uploadMismatch) · 500(첨부 검증) · 400(RPC empty/mismatch) · 500(RPC) · 201
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
  const { row, requestNo, isParticipant } = loaded;

  // 쓰기 역할 (요청자 본인 > 동방 > admin > 초대 참여자 · plan 101). 구매물류팀은 읽기 전용 — 유일한 읽기 전용 사유 (94 D-12)
  const authorRole = resolveChatAuthorRole(profile, row, isParticipant);
  if (!authorRole) {
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.logisticsReadOnly), 403, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('forbidden', QUICK_CHAT_MESSAGES.logisticsReadOnly))
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
    // 문구는 3종만: 1,000자 초과 · 첨부 30개 초과 · 그 밖(객체 아님·타입 불일치)은 「요청 형식이 올바르지 않습니다.」
    const issue = parsed.error.issues.find((item) => item.path[0] === 'body' || item.path[0] === 'attachmentIds');
    const message =
      issue && KNOWN_BODY_MESSAGES.has(issue.message) ? issue.message : QUICK_CHAT_MESSAGES.invalidBody;
    return logger.respond(quickErrorBody(message), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation', message))
    });
  }

  const body = parsed.data.body;
  const attachmentIds = [...new Set(parsed.data.attachmentIds)];
  if (isQuickChatMessageEmpty({ body, attachmentIds })) {
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.bodyRequired), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation', QUICK_CHAT_MESSAGES.bodyRequired))
    });
  }

  // plan 98 D-4 ③ — pending 첨부 검증 (소유·건 · Storage 객체 존재 · 크기·MIME)
  let attachments: QuickRequestMessageAttachmentRow[] = [];
  try {
    attachments = await verifyPendingQuickChatAttachments({
      requestId: row.id,
      uploaderUserId: profile.user_id,
      attachmentIds
    });
  } catch (error) {
    if (error instanceof QuickChatAttachmentError) {
      return logger.respond(quickErrorBody(error.message), error.status, {
        targetLabel: requestNo,
        metadata: quickLogMetadata(
          requestNo,
          buildErrorMetadata(error.errorCode, error.message, { attachment_count: attachmentIds.length })
        )
      });
    }
    console.error('[quick-request/messages] attachment verify failed:', error);
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.sendFailed), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('internal_error', undefined, { attachment_count: attachmentIds.length })
      )
    });
  }

  const totalBytes = sumAttachmentBytes(attachments);
  const authorName = resolveChatAuthorName(profile);

  let created: QuickRequestMessageRow;
  try {
    created = await createQuickRequestMessage({
      requestId: row.id,
      authorUserId: profile.user_id,
      authorName,
      authorRole,
      body,
      attachmentIds
    });
  } catch (error) {
    if (error instanceof QuickRequestMessageRpcError) {
      // 검증 뒤 경합(동시 전송으로 이미 연결됨 등) — 롤백됐으므로 400
      const message =
        error.reason === 'empty' ? QUICK_CHAT_MESSAGES.bodyRequired : QUICK_CHAT_ATTACHMENT_MESSAGES.mismatch;
      return logger.respond(quickErrorBody(message), 400, {
        targetLabel: requestNo,
        metadata: quickLogMetadata(
          requestNo,
          buildErrorMetadata('validation', message, { attachment_count: attachmentIds.length, total_bytes: totalBytes })
        )
      });
    }
    console.error('[quick-request/messages] create failed:', error);
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.sendFailed), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('internal_error', undefined, {
          body_length: body.length,
          attachment_count: attachmentIds.length,
          total_bytes: totalBytes
        })
      )
    });
  }

  const attachmentKinds = attachments.map((attachment) => attachment.kind);

  // plan 94 D-2 — 알림은 201을 돌려준 뒤 after()에서 (await 금지 · AC-02). plan 98 D-9 — 첨부 요약만(파일명 없음)
  after(() =>
    safeNotify('chat_message', () =>
      notifyQuickRequestChatMessage({
        row,
        message: created,
        senderUserId: profile.user_id,
        senderName: authorName,
        attachmentKinds
      })
    )
  );

  return logger.respond(
    { success: true, data: { message: toQuickRequestMessage(created, attachments) } },
    201,
    {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, {
        message_id: Number(created.id),
        body_length: body.length,
        attachment_count: attachments.length,
        total_bytes: totalBytes
      })
    }
  );
}
