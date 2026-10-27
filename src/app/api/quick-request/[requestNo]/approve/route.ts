import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  notifyQuickRequestEvent,
  safeNotify
} from '@/features/quick-request/api/notifications.server';
import {
  canApproveRole,
  isQuickRequestLocked,
  updateQuickRequestIfStatus,
  type QuickRequestRow
} from '@/features/quick-request/api/workflow.server';
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

const ACTION = 'quick_request.approve' as const;

/** 요청자·admin: dispatched + 최종금액 → approved. 동방특송 403(AC-28). 인앱 알림 `approved`(동방 전원·요청자, 행위자 제외) */
export async function POST(_request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/approve`;
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

  if (!canApproveRole(profile, row)) {
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

  if (row.status !== 'dispatched') {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.stale), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', undefined, { status: row.status }))
    });
  }

  if (row.final_amount == null) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.finalAmountRequired), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('conflict', QUICK_REQUEST_MESSAGES.finalAmountRequired)
      )
    });
  }

  let updated: QuickRequestRow | null;
  try {
    updated = await updateQuickRequestIfStatus(row.id, 'dispatched', {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: profile.user_id
    });
  } catch (error) {
    console.error('[quick-request/approve] failed:', error);
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

  // 요청자는 admin 대리 승인일 때만 받는다 (행위자 본인 제외는 notifyQuickRequestEvent가 처리)
  const actorName = profile.full_name?.trim() || profile.email;
  const latest = updated;
  await safeNotify('approved', () =>
    notifyQuickRequestEvent({ row: latest, event: 'approved', actorUserId: profile.user_id, actorName })
  );

  return logger.respond(
    { success: true, data: { requestNo, status: updated.status } },
    200,
    {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, {
        previous_status: 'dispatched',
        new_status: updated.status
      })
    }
  );
}
