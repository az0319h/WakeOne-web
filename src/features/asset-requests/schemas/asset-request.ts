import * as z from 'zod';
import {
  ASSET_COMMENT_BODY_MAX,
  ASSET_REJECT_REASON_MAX,
  ASSET_REQUEST_BODY_MAX,
  ASSET_REQUEST_BODY_MIN,
  ASSET_REQUEST_MESSAGES,
  EQUIPMENT_REQUEST_TYPES,
  SUBSCRIPTION_REQUEST_TYPES,
  type AssetTargetType
} from '../api/types';

/**
 * plan 103 — 요청 폼 · 반려 사유 · 댓글 폼 Zod (서버 service 검증과 같은 문구).
 * 서버는 `service.server.ts`의 validateRequestBody / validateCommentBody로 같은 규칙을 다시 강제한다.
 */

export const assetRequestBodySchema = z
  .string({ error: ASSET_REQUEST_MESSAGES.bodyTooShort })
  .trim()
  .min(ASSET_REQUEST_BODY_MIN, ASSET_REQUEST_MESSAGES.bodyTooShort)
  .max(ASSET_REQUEST_BODY_MAX, ASSET_REQUEST_MESSAGES.bodyTooLong);

export function assetRequestFormSchema(targetType: AssetTargetType) {
  const types = targetType === 'equipment' ? EQUIPMENT_REQUEST_TYPES : SUBSCRIPTION_REQUEST_TYPES;
  return z.object({
    request_type: z.enum(types, { error: ASSET_REQUEST_MESSAGES.invalidType }),
    body: assetRequestBodySchema
  });
}

export type AssetRequestFormValues = {
  request_type: string;
  body: string;
};

export const assetRejectFormSchema = z.object({
  reject_reason: z
    .string({ error: ASSET_REQUEST_MESSAGES.rejectReasonRequired })
    .trim()
    .min(1, ASSET_REQUEST_MESSAGES.rejectReasonRequired)
    .max(ASSET_REJECT_REASON_MAX, ASSET_REQUEST_MESSAGES.rejectReasonTooLong)
});

export const assetCommentFormSchema = z.object({
  body: z
    .string({ error: ASSET_REQUEST_MESSAGES.commentRequired })
    .trim()
    .min(1, ASSET_REQUEST_MESSAGES.commentRequired)
    .max(ASSET_COMMENT_BODY_MAX, ASSET_REQUEST_MESSAGES.commentTooLong)
});

export type AssetCommentFormValues = z.infer<typeof assetCommentFormSchema>;
