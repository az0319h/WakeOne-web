import 'server-only';

import { listActiveAssetManagerUserIds } from '@/features/asset-ledger/api/assignees.server';
import { insertNotifications } from '@/features/notifications/api/insert.server';
import { buildAssetRequestNotificationCopy } from '../lib/notification-copy';
import { resolveAssetRequestRecipients, type AssetRequestNotificationEvent } from '../lib/recipients';
import { requestTypeLabel } from './types';
import type { AssetRequestRow } from './service.server';

/**
 * plan 103 §알림 — 구독·비품 요청 알림 fan-out.
 * INSERT는 `insertNotifications()`만 사용 → 인앱 + 휴대폰 푸시 자동 · 동방 수신 가드 자동(plan 91·95).
 * **이메일 없음**(전역 이메일 정책 · AC-44). 실패해도 요청 처리 응답은 바꾸지 않는다(호출부 응답 전에 catch).
 */

export async function notifyAssetRequestEvent(input: {
  event: AssetRequestNotificationEvent;
  request: AssetRequestRow;
  actorUserId: string;
  previousStatus?: string;
  newStatus?: string;
  commentId?: number;
  isReply?: boolean;
  commentBody?: string;
}): Promise<void> {
  try {
    const needsManagers =
      input.event === 'created' ||
      input.event === 'updated' ||
      input.event === 'canceled' ||
      (input.event === 'comment_created' && !input.request.assignee_user_id);
    const managerIds = needsManagers ? await listActiveAssetManagerUserIds() : [];

    const recipients = resolveAssetRequestRecipients({
      event: input.event,
      actorId: input.actorUserId,
      requesterId: input.request.requester_user_id,
      assigneeId: input.request.assignee_user_id,
      managerIds
    });
    if (recipients.length === 0) return;

    const copy = buildAssetRequestNotificationCopy({
      event: input.event,
      targetType: input.request.target_type,
      requestId: input.request.id,
      requestType: input.request.request_type,
      requestTypeLabel: requestTypeLabel(input.request.target_type, input.request.request_type),
      targetLabel: input.request.target_label,
      requesterName: input.request.requester_name,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      commentId: input.commentId,
      isReply: input.isReply,
      commentBody: input.commentBody
    });

    await insertNotifications(
      recipients.map((recipientUserId) => ({
        recipient_user_id: recipientUserId,
        type: copy.type,
        title: copy.title,
        body: copy.body,
        metadata: copy.metadata
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[asset-requests] notification (${input.event}) failed:`, message);
  }
}
