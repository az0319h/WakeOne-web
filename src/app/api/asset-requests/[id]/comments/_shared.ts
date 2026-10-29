import 'server-only';

import type { NextRequest } from 'next/server';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import { notifyAssetRequestEvent } from '@/features/asset-requests/api/notifications.server';
import {
  createAssetRequestComment,
  getVisibleAssetRequestRow
} from '@/features/asset-requests/api/service.server';
import { ASSET_REQUEST_MESSAGES } from '@/features/asset-requests/api/types';
import {
  AssetRouteLog,
  assetCommentTargetLabel,
  parsePositiveId,
  readJsonObject,
  requireAssetSession
} from '../../../asset-ledger/_utils';

/**
 * plan 103 — 원댓글(`POST …/comments`)·답글(`POST …/comments/{id}/replies`) 공용 처리.
 * 작성 = 요청자 + 권한자(그 외 404) · 모든 상태에서 가능(D-19) · 알림 asset_request.comment_created.
 * activity log metadata: asset_request_id · comment_id · parent_id · depth (본문 금지).
 */
export async function handleCreateAssetComment(input: {
  request: NextRequest;
  rawId: string;
  rawParentId: string | null;
}) {
  const path =
    input.rawParentId === null
      ? `/api/asset-requests/${input.rawId}/comments`
      : `/api/asset-requests/${input.rawId}/comments/${input.rawParentId}/replies`;
  const log = new AssetRouteLog({
    action: 'asset_request.comment_create',
    targetType: 'asset_request_comment',
    method: 'POST',
    path,
    targetLabel: assetCommentTargetLabel({ requestId: input.rawId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const requestId = parsePositiveId(input.rawId);
  if (!requestId) return log.fail(404, ASSET_REQUEST_MESSAGES.notFound);
  log.setMetadata({ asset_request_id: requestId });

  let parentId: number | null = null;
  if (input.rawParentId !== null) {
    parentId = parsePositiveId(input.rawParentId);
    if (!parentId) return log.fail(404, ASSET_REQUEST_MESSAGES.commentNotFound);
    log.setMetadata({ parent_id: parentId });
  }

  try {
    const row = await getVisibleAssetRequestRow(requestId, session.viewer);
    if (!row) return log.fail(404, ASSET_REQUEST_MESSAGES.notFound);

    const body = await readJsonObject(input.request);
    if (!body) return log.fail(400, ASSET_MESSAGES.invalidBody);

    const comment = await createAssetRequestComment({
      request: row,
      authorUserId: session.userId,
      body: body.body,
      parentId
    });
    log.setTarget(assetCommentTargetLabel({ requestId, commentId: comment.id }), row.requester_user_id);

    await notifyAssetRequestEvent({
      event: 'comment_created',
      request: row,
      actorUserId: session.userId,
      commentId: comment.id,
      isReply: parentId !== null,
      commentBody: comment.body
    });

    return log.success({ message: '댓글을 등록했어요.', comment }, 201, {
      comment_id: comment.id,
      parent_id: comment.parent_id,
      depth: comment.depth,
      body_length: comment.body.length
    });
  } catch (error) {
    return log.fromError(error, '댓글 등록 중 오류가 발생했습니다.');
  }
}
