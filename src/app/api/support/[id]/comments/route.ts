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
  getSupportRequestByIdAsService,
  listSupportComments
} from '@/features/support/api/service.server';
import {
  isSupportValidationErrorMessage,
  logSupportAuthFailure,
  newSupportRequestId,
  parseSupportId,
  supportCommentTargetLabel
} from '../../_utils';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) {
    return session.response;
  }

  const { id } = await params;
  const parsedId = parseSupportId(id);
  if (!parsedId) {
    return Response.json({ success: false, message: '문의 ID가 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    const supportRequest = await getSupportRequestByIdAsService(parsedId);
    if (!supportRequest) {
      return Response.json({ success: false, message: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!canAccessSupportRequest(supportRequest, session.profile)) {
      return Response.json(
        { success: false, message: '댓글을 조회할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const comments = await listSupportComments(parsedId);
    return Response.json({ success: true, comments });
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글을 불러오지 못했습니다.';
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = newSupportRequestId();
  const { id } = await params;
  const parsedId = parseSupportId(id);
  const httpPath = `/api/support/${id}/comments`;

  const session = await requireSession();
  if (!session.ok) {
    return logSupportAuthFailure({
      requestId,
      action: 'support.comment_create',
      targetType: 'support_comment',
      httpMethod: 'POST',
      httpPath,
      targetLabel: supportCommentTargetLabel({ supportRequestId: id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_create',
        targetType: 'support_comment',
        targetUserId: session.userId,
        targetLabel: supportCommentTargetLabel({ supportRequestId: id }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata('validation', '문의 ID가 올바르지 않습니다.')
      },
      { success: false, message: '문의 ID가 올바르지 않습니다.' },
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
          targetLabel: supportCommentTargetLabel({ supportRequestId: parsedId }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('validation', '댓글 본문을 입력해 주세요.', {
            support_request_id: parsedId
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
          targetLabel: supportCommentTargetLabel({ supportRequestId: parsedId }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('not_found', '문의를 찾을 수 없습니다.', {
            support_request_id: parsedId
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
          targetLabel: supportCommentTargetLabel({ supportRequestId: parsedId }),
          httpMethod: 'POST',
          httpPath,
          metadata: buildErrorMetadata('forbidden', '댓글을 작성할 권한이 없습니다.', {
            support_request_id: parsedId
          })
        },
        { success: false, message: '댓글을 작성할 권한이 없습니다.' },
        403
      );
    }

    const comment = await createSupportComment({
      supportRequestId: parsedId,
      authorUserId: session.userId,
      payload: { body: body.body }
    });

    try {
      await insertSupportCommentNotification({
        actorUserId: session.userId,
        actorRole: session.profile.system_role,
        supportRequestId: parsedId,
        supportOwnerUserId: supportRequest.submitted_by,
        commentId: comment.id,
        parentId: null,
        preview: body.body
      });
    } catch (notificationError) {
      const message =
        notificationError instanceof Error ? notificationError.message : 'Unknown error';
      console.error('[support] comment notification fan-out failed:', message);
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
          parent_id: null,
          root_comment_id: comment.root_comment_id,
          depth: comment.depth
        }
      },
      { success: true, message: '댓글이 등록되었습니다.', comment },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '댓글 등록 중 오류가 발생했습니다.';
    const status = isSupportValidationErrorMessage(message) ? 400 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.comment_create',
        targetType: 'support_comment',
        targetUserId: session.userId,
        targetLabel: supportCommentTargetLabel({ supportRequestId: parsedId }),
        httpMethod: 'POST',
        httpPath,
        metadata: buildErrorMetadata(status === 400 ? 'validation' : 'internal_error', message, {
          support_request_id: parsedId
        })
      },
      { success: false, message },
      status
    );
  }
}
