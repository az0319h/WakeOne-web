import { NextRequest } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { insertSupportCommentNotification } from '@/features/notifications/api/fan-out.server';
import {
  canAccessSupportRequest,
  createSupportComment,
  getSupportCommentById,
  getSupportRequestByIdAsService
} from '@/features/support/api/service.server';
import {
  isSupportValidationErrorMessage,
  logSupportAuthFailure,
  newSupportRequestId,
  parseSupportId,
  supportCommentTargetLabel
} from '../../../../_utils';

type Params = { params: Promise<{ id: string; commentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = newSupportRequestId();
  const { id, commentId } = await params;
  const parsedId = parseSupportId(id);
  const parsedCommentId = parseSupportId(commentId);
  const httpPath = `/api/support/${id}/comments/${commentId}/replies`;

  const session = await requireSession();
  if (!session.ok) {
    return logSupportAuthFailure({
      requestId,
      action: 'support.comment_create',
      targetType: 'support_comment',
      httpMethod: 'POST',
      httpPath,
      targetLabel: supportCommentTargetLabel({
        supportRequestId: id,
        commentId
      }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId || !parsedCommentId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_create',
        targetType: 'support_comment',
        targetUserId: session.userId,
        targetLabel: supportCommentTargetLabel({
          supportRequestId: id,
          commentId
        }),
        httpMethod: 'POST',
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
          action: 'support.comment_create',
          targetType: 'support_comment',
          targetUserId: session.userId,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'POST',
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
          action: 'support.comment_create',
          targetType: 'support_comment',
          targetUserId: session.userId,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'POST',
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
          action: 'support.comment_create',
          targetType: 'support_comment',
          targetUserId: supportRequest.submitted_by,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('forbidden', '답글을 작성할 권한이 없습니다.', {
            support_request_id: parsedId,
            comment_id: parsedCommentId
          })
        },
        { success: false, message: '답글을 작성할 권한이 없습니다.' },
        403
      );
    }

    const parentComment = await getSupportCommentById({
      supportRequestId: parsedId,
      commentId: parsedCommentId
    });

    if (!parentComment) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.comment_create',
          targetType: 'support_comment',
          targetUserId: supportRequest.submitted_by,
          targetLabel: supportCommentTargetLabel({
            supportRequestId: parsedId,
            commentId: parsedCommentId
          }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('not_found', '부모 댓글을 찾을 수 없습니다.', {
            support_request_id: parsedId,
            comment_id: parsedCommentId
          })
        },
        { success: false, message: '부모 댓글을 찾을 수 없습니다.' },
        404
      );
    }

    const comment = await createSupportComment({
      supportRequestId: parsedId,
      authorUserId: session.userId,
      parentId: parsedCommentId,
      payload: { body: body.body }
    });

    try {
      await insertSupportCommentNotification({
        actorUserId: session.userId,
        actorRole: session.profile.system_role,
        supportRequestId: parsedId,
        supportOwnerUserId: supportRequest.submitted_by,
        commentId: comment.id,
        parentId: parsedCommentId,
        preview: body.body
      });
    } catch (notificationError) {
      const message =
        notificationError instanceof Error ? notificationError.message : 'Unknown error';
      console.error('[support] reply notification fan-out failed:', message);
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_create',
        targetType: 'support_comment',
        targetUserId: comment.author_user_id,
        targetLabel: supportCommentTargetLabel({
          supportRequestId: parsedId,
          commentId: comment.id
        }),
        httpMethod: 'POST',
        httpPath,
        metadata: {
          support_request_id: parsedId,
          comment_id: comment.id,
          parent_id: comment.parent_id,
          root_comment_id: comment.root_comment_id,
          depth: comment.depth
        }
      },
      { success: true, message: '답글이 등록되었습니다.', comment },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '답글 등록 중 오류가 발생했습니다.';
    const status = isSupportValidationErrorMessage(message) ? 400 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_create',
        targetType: 'support_comment',
        targetUserId: session.userId,
        targetLabel: supportCommentTargetLabel({
          supportRequestId: parsedId,
          commentId: parsedCommentId
        }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(status === 400 ? 'validation' : 'internal_error', message, {
          support_request_id: parsedId ?? undefined,
          comment_id: parsedCommentId ?? undefined
        })
      },
      { success: false, message },
      status
    );
  }
}
