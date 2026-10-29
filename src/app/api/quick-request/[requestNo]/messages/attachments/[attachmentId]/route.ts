import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { deletePendingQuickChatAttachment } from '@/features/quick-request/api/attachments.server';
import {
  parseQuickChatAttachmentId,
  QUICK_CHAT_ATTACHMENT_MESSAGES
} from '@/features/quick-request/schemas/quick-request-attachment';
import { QUICK_CHAT_MESSAGES } from '@/features/quick-request/schemas/quick-request-chat';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata
} from '../../../../_utils';

type Params = { params: Promise<{ requestNo: string; attachmentId: string }> };

const ACTION = 'quick_request.message_attachment_delete' as const;

/**
 * plan 98 D-4 ④ — 전송 전 취소: 업로더 본인의 pending 첨부만 삭제(Storage 객체 포함). 서버 첨부 삭제 기능은 Out(전송 후 409).
 * 로그 metadata `{quick_request_no, attachment_id, error_code}` — 파일명·storage_path 금지.
 *
 * return 매트릭스: 401/403(session) · 404(건 형식·미존재·조회 불가) · 500(조회) · 404(id 형식·타인·미존재) · 409(이미 연결됨) · 500 · 200
 */
export async function DELETE(_request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo, attachmentId: rawAttachmentId } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/messages/attachments/${rawAttachmentId}`;
  const session = await requireSession();

  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action: ACTION,
      targetType: QUICK_REQUEST_TARGET,
      targetLabel: rawRequestNo,
      httpMethod: 'DELETE',
      httpPath,
      response: session.response
    });
  }

  const { profile } = session;
  const logger = createQuickRouteLogger({
    requestId,
    action: ACTION,
    httpMethod: 'DELETE',
    httpPath,
    profile,
    defaultTargetLabel: rawRequestNo
  });

  const loaded = await loadQuickRequestForMutation({ rawRequestNo, profile, logger });
  if (!loaded.ok) return loaded.response;
  const { row, requestNo } = loaded;

  const attachmentId = parseQuickChatAttachmentId(rawAttachmentId);
  if (!attachmentId) {
    return logger.respond(quickErrorBody(QUICK_CHAT_ATTACHMENT_MESSAGES.attachmentNotFound), 404, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('not_found', undefined, { attempted_target: rawAttachmentId }))
    });
  }

  try {
    const result = await deletePendingQuickChatAttachment({
      requestId: row.id,
      uploaderUserId: profile.user_id,
      attachmentId
    });

    if (result === 'not_found') {
      return logger.respond(quickErrorBody(QUICK_CHAT_ATTACHMENT_MESSAGES.attachmentNotFound), 404, {
        targetLabel: requestNo,
        metadata: quickLogMetadata(requestNo, buildErrorMetadata('not_found', undefined, { attachment_id: attachmentId }))
      });
    }

    if (result === 'linked') {
      return logger.respond(quickErrorBody(QUICK_CHAT_ATTACHMENT_MESSAGES.linkedCannotDelete), 409, {
        targetLabel: requestNo,
        metadata: quickLogMetadata(
          requestNo,
          buildErrorMetadata('conflict', QUICK_CHAT_ATTACHMENT_MESSAGES.linkedCannotDelete, { attachment_id: attachmentId })
        )
      });
    }

    return logger.respond(
      { success: true, data: { id: attachmentId } },
      200,
      { targetLabel: requestNo, metadata: quickLogMetadata(requestNo, { attachment_id: attachmentId }) }
    );
  } catch (error) {
    console.error('[quick-request/messages/attachments] delete failed:', error);
    return logger.respond(quickErrorBody(QUICK_CHAT_MESSAGES.internalError), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error', undefined, { attachment_id: attachmentId }))
    });
  }
}
