import { NextRequest } from 'next/server';
import {
  actorFromProfile,
  buildErrorMetadata,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  getSupportRequestById,
  truncateSupportTitle,
  updateSupportRequestContent,
  updateSupportRequestStatus
} from '@/features/support/api/service.server';
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUSES,
  type SupportStatus
} from '@/features/support/api/types';
import {
  insertSupportAdminNotifications,
  insertSupportStatusChangedNotification
} from '@/features/notifications/api/fan-out.server';
import {
  isSupportForbiddenError,
  isSupportValidationErrorMessage,
  logSupportAuthFailure,
  newSupportRequestId,
  parseSupportId,
  supportTargetLabel
} from '../_utils';

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
    const supportRequest = await getSupportRequestById(parsedId);
    if (!supportRequest) {
      return Response.json({ success: false, message: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: '문의를 불러왔습니다.',
      request: supportRequest
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '문의를 불러오지 못했습니다.';
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const requestId = newSupportRequestId();
  const { id } = await params;
  const parsedId = parseSupportId(id);
  const httpPath = `/api/support/${id}`;

  const session = await requireSession();
  if (!session.ok) {
    return logSupportAuthFailure({
      requestId,
      action: 'support.update',
      httpMethod: 'PATCH',
      httpPath,
      targetLabel: supportTargetLabel({ id }),
      response: session.response
    });
  }

  const actor = actorFromProfile(session.profile);

  if (!parsedId) {
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.update',
        targetType: 'support_request',
        targetUserId: session.userId,
        targetLabel: supportTargetLabel({ id }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('validation', '문의 ID가 올바르지 않습니다.')
      },
      { success: false, message: '문의 ID가 올바르지 않습니다.' },
      400
    );
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      status?: string;
    };

    const hasStatus = body.status !== undefined;
    const hasContent = body.title !== undefined || body.body !== undefined;

    if (hasStatus && hasContent) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'support.update',
          targetType: 'support_request',
          targetUserId: session.userId,
          targetLabel: supportTargetLabel({ id: parsedId }),
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', '상태와 내용을 동시에 변경할 수 없습니다.')
        },
        { success: false, message: '상태와 내용을 동시에 변경할 수 없습니다.' },
        400
      );
    }

    if (hasStatus) {
      if (session.profile.system_role !== 'admin') {
        return jsonWithActivityLog(
          requestId,
          {
            ...actor,
            action: 'support.status_update',
            targetType: 'support_request',
            targetUserId: session.userId,
            targetLabel: supportTargetLabel({ id: parsedId }),
            httpMethod: 'PATCH',
            httpPath,
            metadata: buildErrorMetadata('forbidden', '상태를 변경할 권한이 없습니다.')
          },
          { success: false, message: '상태를 변경할 권한이 없습니다.' },
          403
        );
      }

      if (typeof body.status !== 'string' || !SUPPORT_STATUSES.includes(body.status as SupportStatus)) {
        return jsonWithActivityLog(
          requestId,
          {
            ...actor,
            action: 'support.status_update',
            targetType: 'support_request',
            targetUserId: session.userId,
            targetLabel: supportTargetLabel({ id: parsedId }),
            httpMethod: 'PATCH',
            httpPath,
            metadata: buildErrorMetadata('validation', '상태 값이 올바르지 않습니다.')
          },
          { success: false, message: '상태 값이 올바르지 않습니다.' },
          400
        );
      }

      const existing = await getSupportRequestById(parsedId);
      if (!existing) {
        return jsonWithActivityLog(
          requestId,
          {
            ...actor,
            action: 'support.status_update',
            targetType: 'support_request',
            targetUserId: session.userId,
            targetLabel: supportTargetLabel({ id: parsedId }),
            httpMethod: 'PATCH',
            httpPath,
            metadata: buildErrorMetadata('not_found', '문의를 찾을 수 없습니다.', {
              support_request_id: parsedId
            })
          },
          { success: false, message: '문의를 찾을 수 없습니다.' },
          404
        );
      }

      try {
        const updated = await updateSupportRequestStatus({
          id: parsedId,
          adminUserId: session.userId,
          status: body.status as SupportStatus
        });

        if (!updated) {
          return jsonWithActivityLog(
            requestId,
            {
              ...actor,
              action: 'support.status_update',
              targetType: 'support_request',
              targetUserId: existing.submitted_by,
              targetLabel: supportTargetLabel({ id: parsedId, title: existing.title }),
              httpMethod: 'PATCH',
              httpPath,
              metadata: buildErrorMetadata('not_found', '문의를 찾을 수 없습니다.', {
                support_request_id: parsedId
              })
            },
            { success: false, message: '문의를 찾을 수 없습니다.' },
            404
          );
        }

        try {
          await insertSupportStatusChangedNotification({
            actorUserId: session.userId,
            recipientUserId: updated.submitted_by,
            supportRequestId: updated.id,
            title: truncateSupportTitle(updated.title),
            previousStatus: SUPPORT_STATUS_LABELS[existing.status],
            newStatus: SUPPORT_STATUS_LABELS[updated.status]
          });
        } catch (notificationError) {
          const message =
            notificationError instanceof Error ? notificationError.message : 'Unknown error';
          console.error('[support] status notification fan-out failed:', message);
        }

        return jsonWithActivityLog(
          requestId,
          {
            ...actor,
            action: 'support.status_update',
            targetType: 'support_request',
            targetUserId: updated.submitted_by,
            targetLabel: supportTargetLabel({ id: updated.id, title: updated.title }),
            httpMethod: 'PATCH',
            httpPath,
            metadata: {
              support_request_id: updated.id,
              previous_status: existing.status,
              new_status: updated.status
            }
          },
          {
            success: true,
            message: '상태가 변경되었습니다.',
            request: updated
          },
          200
        );
      } catch (statusError) {
        const statusMessage =
          statusError instanceof Error ? statusError.message : '상태 변경 중 오류가 발생했습니다.';

        if (isSupportForbiddenError(statusMessage)) {
          return jsonWithActivityLog(
            requestId,
            {
              ...actor,
              action: 'support.status_update',
              targetType: 'support_request',
              targetUserId: existing.submitted_by,
              targetLabel: supportTargetLabel({ id: parsedId, title: existing.title }),
              httpMethod: 'PATCH',
              httpPath,
              metadata: buildErrorMetadata('forbidden', '허용되지 않는 상태 변경입니다.', {
                support_request_id: parsedId,
                previous_status: existing.status
              })
            },
            { success: false, message: '허용되지 않는 상태 변경입니다.' },
            403
          );
        }

        throw statusError;
      }
    }

    if (hasContent) {
      if (typeof body.title !== 'string' || typeof body.body !== 'string') {
        return jsonWithActivityLog(
          requestId,
          {
            ...actor,
            action: 'support.update',
            targetType: 'support_request',
            targetUserId: session.userId,
            targetLabel: supportTargetLabel({ id: parsedId }),
            httpMethod: 'PATCH',
            httpPath,
            metadata: buildErrorMetadata('validation', '제목과 본문이 필요합니다.')
          },
          { success: false, message: '제목과 본문이 필요합니다.' },
          400
        );
      }

      const existing = await getSupportRequestById(parsedId);
      if (!existing) {
        return jsonWithActivityLog(
          requestId,
          {
            ...actor,
            action: 'support.update',
            targetType: 'support_request',
            targetUserId: session.userId,
            targetLabel: supportTargetLabel({ id: parsedId }),
            httpMethod: 'PATCH',
            httpPath,
            metadata: buildErrorMetadata('not_found', '문의를 찾을 수 없습니다.', {
              support_request_id: parsedId
            })
          },
          { success: false, message: '문의를 찾을 수 없습니다.' },
          404
        );
      }

      try {
        const updated = await updateSupportRequestContent({
          id: parsedId,
          userId: session.userId,
          payload: { title: body.title, body: body.body }
        });

        if (!updated) {
          return jsonWithActivityLog(
            requestId,
            {
              ...actor,
              action: 'support.update',
              targetType: 'support_request',
              targetUserId: session.userId,
              targetLabel: supportTargetLabel({ id: parsedId, title: existing.title }),
              httpMethod: 'PATCH',
              httpPath,
              metadata: buildErrorMetadata('not_found', '문의를 찾을 수 없습니다.', {
                support_request_id: parsedId
              })
            },
            { success: false, message: '문의를 찾을 수 없습니다.' },
            404
          );
        }

        const changedFields: string[] = [];
        if (existing.title !== updated.title) {
          changedFields.push('title');
        }
        if (existing.body !== updated.body) {
          changedFields.push('body');
        }

        try {
          await insertSupportAdminNotifications({
            actorUserId: session.userId,
            supportRequestId: updated.id,
            title: truncateSupportTitle(updated.title),
            preview: updated.body,
            type: 'support.updated'
          });
        } catch (notificationError) {
          const message =
            notificationError instanceof Error ? notificationError.message : 'Unknown error';
          console.error('[support] update notification fan-out failed:', message);
        }

        return jsonWithActivityLog(
          requestId,
          {
            ...actor,
            action: 'support.update',
            targetType: 'support_request',
            targetUserId: session.userId,
            targetLabel: supportTargetLabel({ id: updated.id, title: updated.title }),
            httpMethod: 'PATCH',
            httpPath,
            metadata: {
              support_request_id: updated.id,
              changed_fields: changedFields
            }
          },
          {
            success: true,
            message: '문의가 수정되었습니다.',
            request: updated
          },
          200
        );
      } catch (contentError) {
        const contentMessage =
          contentError instanceof Error ? contentError.message : '문의 수정 중 오류가 발생했습니다.';

        if (isSupportForbiddenError(contentMessage)) {
          return jsonWithActivityLog(
            requestId,
            {
              ...actor,
              action: 'support.update',
              targetType: 'support_request',
              targetUserId: session.userId,
              targetLabel: supportTargetLabel({ id: parsedId, title: existing.title }),
              httpMethod: 'PATCH',
              httpPath,
              metadata: buildErrorMetadata('forbidden', '문의를 수정할 권한이 없습니다.', {
                support_request_id: parsedId
              })
            },
            { success: false, message: '문의를 수정할 권한이 없습니다.' },
            403
          );
        }

        throw contentError;
      }
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.update',
        targetType: 'support_request',
        targetUserId: session.userId,
        targetLabel: supportTargetLabel({ id: parsedId }),
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('validation', '변경할 항목이 없습니다.')
      },
      { success: false, message: '변경할 항목이 없습니다.' },
      400
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '문의 수정 중 오류가 발생했습니다.';
    const status = isSupportValidationErrorMessage(message) ? 400 : 500;
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'support.update',
        targetType: 'support_request',
        targetUserId: session.userId,
        targetLabel: supportTargetLabel({ id: parsedId }),
        httpMethod: 'PATCH',
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
