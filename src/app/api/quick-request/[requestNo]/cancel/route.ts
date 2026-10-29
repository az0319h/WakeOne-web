import { after } from 'next/server';
import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { canOperateQuickRequests } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  notifyQuickRequestEvent,
  safeNotify
} from '@/features/quick-request/api/notifications.server';
import {
  isQuickRequestLocked,
  updateQuickRequestIfStatus,
  type QuickRequestRow
} from '@/features/quick-request/api/workflow.server';
import {
  QUICK_REQUEST_MESSAGES,
  quickRequestCancelBodySchema
} from '@/features/quick-request/schemas/quick-request-workflow';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata,
  readJsonBody,
  resolveTransitionConflictMessage,
  zodIssuesToValidationErrors
} from '../../_utils';

type Params = { params: Promise<{ requestNo: string }> };

const ACTION = 'quick_request.cancel' as const;

/**
 * 취소 — 요청자는 requested만(그 외 403 AC-24), 동방·admin은 requested·dispatching·dispatched.
 * 인앱 알림 `cancelled` — 동방 전원·admin·구매물류팀·요청자(행위자 제외 · plan 92).
 * 사유(최대 200자)는 DB에만 저장하고 감사 로그 metadata에는 남기지 않는다.
 */
export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/cancel`;
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

  const isOperator = canOperateQuickRequests(profile);
  const isRequester = row.requester_user_id === profile.user_id;

  if (!isOperator && !isRequester) {
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

  if (!isOperator && row.status !== 'requested') {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.requesterCannotCancel), 403, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(
        requestNo,
        buildErrorMetadata('forbidden', QUICK_REQUEST_MESSAGES.requesterCannotCancel, {
          status: row.status
        })
      )
    });
  }

  // 본문 없이 호출해도 된다 (사유 선택)
  const json = await readJsonBody(request);
  const parsed = quickRequestCancelBodySchema.safeParse(json.ok ? (json.body ?? {}) : {});
  if (!parsed.success) {
    const validationErrors = zodIssuesToValidationErrors(parsed.error);
    return logger.respond(
      { ...quickErrorBody(QUICK_REQUEST_MESSAGES.invalid), errors: validationErrors },
      400,
      {
        targetLabel: requestNo,
        metadata: quickLogMetadata(
          requestNo,
          buildErrorMetadata('validation', undefined, { validation_errors: validationErrors })
        )
      }
    );
  }

  const reason = parsed.data.reason?.trim() || null;
  const previousStatus = row.status;

  let updated: QuickRequestRow | null;
  try {
    updated = await updateQuickRequestIfStatus(row.id, previousStatus, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: profile.user_id,
      cancel_reason: reason
    });
  } catch (error) {
    console.error('[quick-request/cancel] failed:', error);
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

  const actorName = profile.full_name?.trim() || profile.email;
  const latest = updated;
  // plan 94 D-2 — 알림(인앱 insert + 푸시 fan-out)은 응답을 돌려준 뒤 after()에서. 실패는 safeNotify가 console.error만
  after(() =>
    safeNotify('cancelled', () =>
      notifyQuickRequestEvent({ row: latest, event: 'cancelled', actorUserId: profile.user_id, actorName })
    )
  );

  return logger.respond(
    { success: true, data: { requestNo, status: updated.status } },
    200,
    {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, {
        previous_status: previousStatus,
        new_status: updated.status
      })
    }
  );
}
