import { after } from 'next/server';
import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { canManageQuickRequestParticipants } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import { resolveChatAuthorName } from '@/features/quick-request/api/messages.server';
import {
  notifyQuickRequestParticipantEvent,
  safeNotify
} from '@/features/quick-request/api/notifications.server';
import { removeQuickRequestParticipant } from '@/features/quick-request/api/participants.server';
import {
  parseQuickChatParticipantUserId,
  QUICK_CHAT_PARTICIPANT_MESSAGES
} from '@/features/quick-request/schemas/quick-request-participant';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata
} from '../../../_utils';

type Params = { params: Promise<{ requestNo: string; userId: string }> };

const ACTION = 'quick_request.participant_remove' as const;

/**
 * plan 101 D-3 — 제외(초대자=요청자·admin) · 나가기(본인 · `self:true`). soft(`removed_at`·`removed_by`).
 * 동방·구매물류·다른 참여자 403 「참여자를 제외할 권한이 없습니다.」 · 활성 참여자가 아니면 404 「참여 중인 사용자가 아닙니다.」
 * 알림(D-6 ②)은 200 뒤 `after()`에서 당사자 1건 — 본인 나가기는 없음.
 *
 * return 매트릭스(모두 logger.respond → activity log + x-request-id · action `quick_request.participant_remove`):
 *   401/403/500(session) · 404(요청번호 형식·미존재·조회 불가) · 500(조회) · 404(userId 형식) · 403(권한) · 404(미참여) · 500(저장) · 200
 * metadata: quick_request_no · participant_user_id · self · error_code
 */
export async function DELETE(_request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo, userId: rawUserId } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/participants/${rawUserId}`;
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

  const userId = parseQuickChatParticipantUserId(rawUserId);
  if (!userId) {
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.notParticipant), 404, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('not_found', undefined, { attempted_target: rawUserId }))
    });
  }

  const self = userId === profile.user_id;
  const metadataBase = { participant_user_id: userId, self };

  if (!self && !canManageQuickRequestParticipants(profile, row)) {
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.removeForbidden), 403, {
      targetLabel: requestNo,
      targetUserId: userId,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('forbidden', QUICK_CHAT_PARTICIPANT_MESSAGES.removeForbidden, metadataBase)
      )
    });
  }

  let result;
  try {
    result = await removeQuickRequestParticipant({ requestId: row.id, userId, actorUserId: profile.user_id });
  } catch (error) {
    console.error('[quick-request/participants] remove failed:', error);
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.removeFailed), 500, {
      targetLabel: requestNo,
      targetUserId: userId,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error', undefined, metadataBase))
    });
  }

  if (!result.ok) {
    // 활성 참여자가 아님 (요청자·동방·admin·이미 제외됨·본인이 참여자가 아님)
    return logger.respond(quickErrorBody(QUICK_CHAT_PARTICIPANT_MESSAGES.notParticipant), 404, {
      targetLabel: requestNo,
      targetUserId: userId,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('not_found', undefined, metadataBase))
    });
  }

  if (!self) {
    const actorName = resolveChatAuthorName(profile);
    after(() =>
      safeNotify('participant_removed', () =>
        notifyQuickRequestParticipantEvent({
          row,
          event: 'participant_removed',
          recipientUserId: userId,
          actorUserId: profile.user_id,
          actorName
        })
      )
    );
  }

  return logger.respond({ success: true, data: { userId, self } }, 200, {
    targetLabel: requestNo,
    targetUserId: userId,
    metadata: quickLogMetadata(requestNo, metadataBase)
  });
}
