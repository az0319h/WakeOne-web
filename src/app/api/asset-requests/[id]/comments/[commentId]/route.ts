import type { NextRequest } from 'next/server';
import { ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import {
  deleteAssetRequestComment,
  getVisibleAssetRequestRow,
  updateAssetRequestComment
} from '@/features/asset-requests/api/service.server';
import { ASSET_REQUEST_MESSAGES } from '@/features/asset-requests/api/types';
import {
  AssetRouteLog,
  assetCommentTargetLabel,
  parsePositiveId,
  readJsonObject,
  requireAssetSession
} from '../../../../asset-ledger/_utils';

type Params = { params: Promise<{ id: string; commentId: string }> };

/** plan 103 — 댓글 수정 (본인 글만 · 남의 글 403 · 요청을 못 보는 사람 404) */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: rawId, commentId: rawCommentId } = await params;
  const log = new AssetRouteLog({
    action: 'asset_request.comment_update',
    targetType: 'asset_request_comment',
    method: 'PATCH',
    path: `/api/asset-requests/${rawId}/comments/${rawCommentId}`,
    targetLabel: assetCommentTargetLabel({ requestId: rawId, commentId: rawCommentId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const requestId = parsePositiveId(rawId);
  const commentId = parsePositiveId(rawCommentId);
  if (!requestId) return log.fail(404, ASSET_REQUEST_MESSAGES.notFound);
  if (!commentId) return log.fail(404, ASSET_REQUEST_MESSAGES.commentNotFound);
  log.setMetadata({ asset_request_id: requestId, comment_id: commentId });

  try {
    const row = await getVisibleAssetRequestRow(requestId, session.viewer);
    if (!row) return log.fail(404, ASSET_REQUEST_MESSAGES.notFound);

    const body = await readJsonObject(request);
    if (!body) return log.fail(400, ASSET_MESSAGES.invalidBody);

    const comment = await updateAssetRequestComment({
      request: row,
      commentId,
      viewer: session.viewer,
      body: body.body
    });
    log.setTarget(assetCommentTargetLabel({ requestId, commentId }), comment.author_user_id);
    return log.success({ message: '댓글을 수정했어요.', comment }, 200, {
      parent_id: comment.parent_id,
      depth: comment.depth,
      changed_fields: ['body'],
      body_length: comment.body.length
    });
  } catch (error) {
    return log.fromError(error, '댓글 수정 중 오류가 발생했습니다.');
  }
}

/** plan 103 — 댓글 삭제 (soft delete · 본인 글 + 권한자는 남의 글도) */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id: rawId, commentId: rawCommentId } = await params;
  const log = new AssetRouteLog({
    action: 'asset_request.comment_delete',
    targetType: 'asset_request_comment',
    method: 'DELETE',
    path: `/api/asset-requests/${rawId}/comments/${rawCommentId}`,
    targetLabel: assetCommentTargetLabel({ requestId: rawId, commentId: rawCommentId })
  });

  const session = await requireAssetSession();
  if (!session.ok) return log.authFailure(session.response);
  log.setActor(session.profile);

  const requestId = parsePositiveId(rawId);
  const commentId = parsePositiveId(rawCommentId);
  if (!requestId) return log.fail(404, ASSET_REQUEST_MESSAGES.notFound);
  if (!commentId) return log.fail(404, ASSET_REQUEST_MESSAGES.commentNotFound);
  log.setMetadata({ asset_request_id: requestId, comment_id: commentId });

  try {
    const row = await getVisibleAssetRequestRow(requestId, session.viewer);
    if (!row) return log.fail(404, ASSET_REQUEST_MESSAGES.notFound);

    const { comment, deletedByManager } = await deleteAssetRequestComment({
      request: row,
      commentId,
      viewer: session.viewer
    });
    log.setTarget(assetCommentTargetLabel({ requestId, commentId }), comment.author_user_id);
    return log.success({ message: '댓글을 삭제했어요.', comment }, 200, {
      parent_id: comment.parent_id,
      depth: comment.depth,
      deleted_by_manager: deletedByManager
    });
  } catch (error) {
    return log.fromError(error, '댓글 삭제 중 오류가 발생했습니다.');
  }
}
