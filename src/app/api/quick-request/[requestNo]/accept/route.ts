import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { canOperateQuickRequests } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  insertQuickRequestRequesterNotification,
  safeNotify
} from '@/features/quick-request/api/notifications.server';
import {
  isQuickRequestLocked,
  toQuickOpenchatSource,
  updateQuickRequestIfStatus,
  type QuickRequestRow
} from '@/features/quick-request/api/workflow.server';
import { dispatchQuickOpenchatEvent } from '@/features/quick-request/lib/openchat-webhook.server';
import { QUICK_REQUEST_MESSAGES } from '@/features/quick-request/schemas/quick-request-workflow';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata,
  resolveTransitionConflictMessage
} from '../../_utils';

type Params = { params: Promise<{ requestNo: string }> };

const ACTION = 'quick_request.accept' as const;

/** 동방·admin: requested → dispatching, webhook `accepted`, 요청자 알림. 경합 409 (AC-21) */
export async function POST(_request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/accept`;
  const session = await requireSession();

  if (!session.ok) {
    return logQuickRequestAuthFailure({
      requestId,
      action: ACTION,
      targetType: QUICK_REQUEST_TARGET,
      targetLabel: rawRequestNo,
      httpMethod: 'POST',
      httpPath,
      response: session.response
    });
  }

  const { profile } = session;
  const logger = createQuickRouteLogger({
    requestId,
    action: ACTION,
    httpMethod: 'POST',
    httpPath,
    profile,
    defaultTargetLabel: rawRequestNo
  });

  const loaded = await loadQuickRequestForMutation({ rawRequestNo, profile, logger });
  if (!loaded.ok) return loaded.response;
  const { row, requestNo } = loaded;

  if (!canOperateQuickRequests(profile)) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.forbidden), 403, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('forbidden'))
    });
  }

  if (isQuickRequestLocked(row.status)) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.locked), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', undefined, { status: row.status }))
    });
  }

  if (row.status !== 'requested') {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.stale), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', undefined, { status: row.status }))
    });
  }

  let updated: QuickRequestRow | null;
  try {
    updated = await updateQuickRequestIfStatus(row.id, 'requested', {
      status: 'dispatching',
      accepted_at: new Date().toISOString(),
      accepted_by: profile.user_id
    });
  } catch (error) {
    console.error('[quick-request/accept] failed:', error);
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.internalError), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error'))
    });
  }

  if (!updated) {
    const message = await resolveTransitionConflictMessage(requestNo);
    return logger.respond(quickErrorBody(message), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', message))
    });
  }

  // webhook은 update 성공 후에만 (경합 시 1회만 발송)
  const openchat = await dispatchQuickOpenchatEvent(toQuickOpenchatSource(updated), 'accepted');

  const actorName = profile.full_name?.trim() || profile.email;
  const latest = updated;
  await safeNotify('requester accepted', () =>
    insertQuickRequestRequesterNotification({
      row: latest,
      event: 'accepted',
      actorUserId: profile.user_id,
      actorName
    })
  );

  return logger.respond(
    {
      success: true,
      data: {
        requestNo,
        status: updated.status,
        openchat: { event: openchat.event, status: openchat.status }
      }
    },
    200,
    {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, {
        previous_status: 'requested',
        new_status: updated.status,
        openchat
      })
    }
  );
}
