import { NextRequest } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  canAccessSupportRequest,
  getSupportRequestByIdAsService,
  softDeleteSupportComment,
  updateSupportComment
} from '@/features/support/api/service.server';
import {
  isSupportForbiddenError,
  isSupportValidationErrorMessage,
  logSupportAuthFailure,
  newSupportRequestId,
  parseSupportId,
  supportCommentTargetLabel
} from '../../../_utils';

type Params = { params: Promise<{ id: string; commentId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = newSupportRequestId();
  const { id, commentId } = await params;
  const parsedId = parseSupportId(id);
  const parsedCommentId = parseSupportId(commentId);
  const httpPath = `/api/support/${id}/comments/${commentId}`;

  const session = await requireSession();
  if (!session.ok) {
    return logSupportAuthFailure({
      requestId,
      action: 'support.comment_update',
      targetType: 'support_comment',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: supportCommentTargetLabel({ supportRequestId: id, commentId }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId || !parsedCommentId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_update',
        targetType: 'support_comment',
        targetUserId: session.userId,
        targetLabel: supportCommentTargetLabel({ supportRequestId: id, commentId }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('validation', '문의 또는 댓글 ID가 올바르지 않습니다.')
      },
      { success: false, message: '문의 또는 댓글 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const body = (await request.json()) as { body?: string };
    if (typeof body.body !== 'string') {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.comment_update',
          targetType: 'support_comment',
          targetUserId: session.userId,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', '댓글 본문을 입력해 주세요.', {
            support_request_id: parsedId,
            comment_id: parsedCommentId
          })
        },
        { success: false, message: '댓글 본문을 입력해 주세요.' },
        400
      );
    }

    const supportRequest = await getSupportRequestByIdAsService(parsedId);
    if (!supportRequest) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.comment_update',
          targetType: 'support_comment',
          targetUserId: session.userId,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '문의를 찾을 수 없습니다.', {
            support_request_id: parsedId,
            comment_id: parsedCommentId
          })
        },
        { success: false, message: '문의를 찾을 수 없습니다.' },
        404
      );
    }

    if (!canAccessSupportRequest(supportRequest, session.profile)) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.comment_update',
          targetType: 'support_comment',
          targetUserId: supportRequest.submitted_by,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('forbidden', '댓글을 수정할 권한이 없습니다.', {
            support_request_id: parsedId,
            comment_id: parsedCommentId
          })
        },
        { success: false, message: '댓글을 수정할 권한이 없습니다.' },
        403
      );
    }

    const comment = await updateSupportComment({
      supportRequestId: parsedId,
      commentId: parsedCommentId,
      authorUserId: session.userId,
      payload: { body: body.body }
    });

    if (!comment) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.comment_update',
          targetType: 'support_comment',
          targetUserId: supportRequest.submitted_by,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('not_found', '댓글을 찾을 수 없습니다.', {
            support_request_id: parsedId,
            comment_id: parsedCommentId
          })
        },
        { success: false, message: '댓글을 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_update',
        targetType: 'support_comment',
        targetUserId: comment.author_user_id,
        targetLabel: supportCommentTargetLabel({
          supportRequestId: parsedId,
          commentId: comment.id
        }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: {
          support_request_id: parsedId,
          comment_id: comment.id,
          parent_id: comment.parent_id,
          depth: comment.depth,
          changed_fields: ['body']
        }
      },
      { success: true, message: '댓글이 수정되었습니다.', comment },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글 수정 중 오류가 발생했습니다.';
    const isForbidden = isSupportForbiddenError(message);
    const status = isForbidden ? 403 : isSupportValidationErrorMessage(message) ? 400 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_update',
        targetType: 'support_comment',
        targetUserId: session.userId,
        targetLabel: supportCommentTargetLabel({
          supportRequestId: parsedId,
          commentId: parsedCommentId
        }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata(
          isForbidden ? 'forbidden' : status === 400 ? 'validation' : 'internal_error',
          isForbidden ? '댓글을 수정할 권한이 없습니다.' : message,
          {
            support_request_id: parsedId ?? undefined,
            comment_id: parsedCommentId ?? undefined
          }
        )
      },
      { success: false, message: isForbidden ? '댓글을 수정할 권한이 없습니다.' : message },
      status
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const requestId = newSupportRequestId();
  const { id, commentId } = await params;
  const parsedId = parseSupportId(id);
  const parsedCommentId = parseSupportId(commentId);
  const httpPath = `/api/support/${id}/comments/${commentId}`;

  const session = await requireSession();
  if (!session.ok) {
    return logSupportAuthFailure({
      requestId,
      action: 'support.comment_delete',
      targetType: 'support_comment',
      httpMethod: 'DELETE',
      httpPath,
      targetLabel: supportCommentTargetLabel({ supportRequestId: id, commentId }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId || !parsedCommentId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_delete',
        targetType: 'support_comment',
        targetUserId: session.userId,
        targetLabel: supportCommentTargetLabel({ supportRequestId: id, commentId }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata('validation', '문의 또는 댓글 ID가 올바르지 않습니다.')
      },
      { success: false, message: '문의 또는 댓글 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const supportRequest = await getSupportRequestByIdAsService(parsedId);
    if (!supportRequest) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.comment_delete',
          targetType: 'support_comment',
          targetUserId: session.userId,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '문의를 찾을 수 없습니다.', {
            support_request_id: parsedId,
            comment_id: parsedCommentId
          })
        },
        { success: false, message: '문의를 찾을 수 없습니다.' },
        404
      );
    }

    if (!canAccessSupportRequest(supportRequest, session.profile)) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.comment_delete',
          targetType: 'support_comment',
          targetUserId: supportRequest.submitted_by,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('forbidden', '댓글을 삭제할 권한이 없습니다.', {
            support_request_id: parsedId,
            comment_id: parsedCommentId
          })
        },
        { success: false, message: '댓글을 삭제할 권한이 없습니다.' },
        403
      );
    }

    const comment = await softDeleteSupportComment({
      supportRequestId: parsedId,
      commentId: parsedCommentId,
      actorUserId: session.userId,
      actorRole: session.profile.system_role
    });

    if (!comment) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.comment_delete',
          targetType: 'support_comment',
          targetUserId: supportRequest.submitted_by,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'DELETE',
          httpPath,
          metadata: buildErrorMetadata('not_found', '댓글을 찾을 수 없습니다.', {
            support_request_id: parsedId,
            comment_id: parsedCommentId
          })
        },
        { success: false, message: '댓글을 찾을 수 없습니다.' },
        404
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_delete',
        targetType: 'support_comment',
        targetUserId: comment.author_user_id,
        targetLabel: supportCommentTargetLabel({
          supportRequestId: parsedId,
          commentId: comment.id
        }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: {
          support_request_id: parsedId,
          comment_id: comment.id,
          parent_id: comment.parent_id,
          depth: comment.depth,
          deleted_by_admin: session.profile.system_role === 'admin'
        }
      },
      { success: true, message: '댓글이 삭제되었습니다.', comment },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글 삭제 중 오류가 발생했습니다.';
    const isForbidden = isSupportForbiddenError(message);
    const status = isForbidden ? 403 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_delete',
        targetType: 'support_comment',
        targetUserId: session.userId,
        targetLabel: supportCommentTargetLabel({
          supportRequestId: parsedId,
          commentId: parsedCommentId
        }),
        httpMethod: 'DELETE',
        httpPath,
        metadata: buildErrorMetadata(isForbidden ? 'forbidden' : 'internal_error', message, {
          support_request_id: parsedId ?? undefined,
          comment_id: parsedCommentId ?? undefined
        })
      },
      { success: false, message: isForbidden ? '댓글을 삭제할 권한이 없습니다.' : message },
      status
    );
  }
}
