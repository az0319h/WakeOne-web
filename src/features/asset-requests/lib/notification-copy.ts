import type { AssetRequestNotificationEvent } from './recipients';

/**
 * plan 103 §알림 — 알림 제목·본문·metadata (순수 함수 · `node --test`).
 * metadata는 허용 목록만: kind · asset_request_id · asset_target_type · request_type · previous_status · new_status · comment_id · is_reply.
 * **요청 본문·댓글 전문·금액·카드·메모·반려 사유는 넣지 않는다.** 본문 문자열에는 댓글 앞부분 미리보기(최대 80자)만 허용.
 */

export type AssetRequestNotificationType =
  | 'asset_request.created'
  | 'asset_request.updated'
  | 'asset_request.canceled'
  | 'asset_request.status_changed'
  | 'asset_request.assigned'
  | 'asset_request.comment_created';

export const ASSET_REQUEST_NOTIFICATION_TYPE_BY_EVENT: Record<
  AssetRequestNotificationEvent,
  AssetRequestNotificationType
> = {
  created: 'asset_request.created',
  updated: 'asset_request.updated',
  canceled: 'asset_request.canceled',
  status_changed: 'asset_request.status_changed',
  assigned: 'asset_request.assigned',
  comment_created: 'asset_request.comment_created'
};

export const ASSET_COMMENT_PREVIEW_MAX = 80;

const TARGET_WORD: Record<'subscription' | 'equipment', string> = {
  subscription: '구독',
  equipment: '비품'
};

const STATUS_TITLE: Record<string, string> = {
  in_progress: '요청이 처리중으로 바뀌었어요',
  completed: '요청이 완료됐어요',
  rejected: '요청이 반려됐어요'
};

export type AssetRequestCopyInput = {
  event: AssetRequestNotificationEvent;
  targetType: 'subscription' | 'equipment';
  requestId: number;
  requestType: string;
  requestTypeLabel: string;
  targetLabel: string;
  requesterName: string;
  previousStatus?: string;
  newStatus?: string;
  commentId?: number;
  isReply?: boolean;
  /** 댓글 원문 — 앞부분 80자만 본문 미리보기로 쓰고 metadata에는 넣지 않는다 */
  commentBody?: string;
};

export type AssetRequestNotificationCopy = {
  type: AssetRequestNotificationType;
  title: string;
  body: string;
  metadata: Record<string, string | number | boolean>;
};

export function formatCommentPreview(body: string, max = ASSET_COMMENT_PREVIEW_MAX): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}…`;
}

export function buildAssetRequestNotificationCopy(input: AssetRequestCopyInput): AssetRequestNotificationCopy {
  const word = TARGET_WORD[input.targetType];
  const type = ASSET_REQUEST_NOTIFICATION_TYPE_BY_EVENT[input.event];
  const metadata: Record<string, string | number | boolean> = {
    kind: type,
    asset_request_id: input.requestId,
    asset_target_type: input.targetType,
    request_type: input.requestType
  };
  const summary = `${input.requesterName} · ${input.targetLabel} · ${input.requestTypeLabel}`;

  switch (input.event) {
    case 'created':
      return { type, title: `새 ${word} 요청`, body: summary, metadata };
    case 'updated':
      return { type, title: `${word} 요청이 수정됐어요`, body: summary, metadata };
    case 'canceled':
      return { type, title: `${word} 요청이 취소됐어요`, body: summary, metadata };
    case 'status_changed': {
      if (input.previousStatus) metadata.previous_status = input.previousStatus;
      if (input.newStatus) metadata.new_status = input.newStatus;
      const title = STATUS_TITLE[input.newStatus ?? ''] ?? '요청 상태가 바뀌었어요';
      const suffix = input.newStatus === 'rejected' ? ' · 사유를 확인해 주세요' : '';
      return {
        type,
        title,
        body: `${input.targetLabel} · ${input.requestTypeLabel}${suffix}`,
        metadata
      };
    }
    case 'assigned':
      return {
        type,
        title: '요청 담당자로 지정됐어요',
        body: `${input.targetLabel} · ${input.requestTypeLabel}`,
        metadata
      };
    case 'comment_created': {
      if (typeof input.commentId === 'number') metadata.comment_id = input.commentId;
      metadata.is_reply = Boolean(input.isReply);
      return {
        type,
        title: `새 댓글 · ${input.targetLabel}`,
        body: formatCommentPreview(input.commentBody ?? ''),
        metadata
      };
    }
    default:
      return { type, title: `${word} 요청`, body: summary, metadata };
  }
}
