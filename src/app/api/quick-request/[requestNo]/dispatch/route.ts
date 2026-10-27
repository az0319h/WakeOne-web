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
  quickRequestDispatchBodySchema
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

const ACTION = 'quick_request.dispatch' as const;

/** 동방·admin: dispatching → dispatched (예상금액·차량정보·기사이름·기사연락처 필수), 인앱 알림 `dispatched` */
export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/dispatch`;
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

  const json = await readJsonBody(request);
  if (!json.ok) {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.invalid), 400, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('validation'))
    });
  }

  const parsed = quickRequestDispatchBodySchema.safeParse(json.body);
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

  if (row.status !== 'dispatching') {
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.stale), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', undefined, { status: row.status }))
    });
  }

  let updated: QuickRequestRow | null;
  try {
    updated = await updateQuickRequestIfStatus(row.id, 'dispatching', {
      status: 'dispatched',
      estimated_amount: parsed.data.estimatedAmount,
      dispatch_vehicle_info: parsed.data.vehicleInfo,
      driver_name: parsed.data.driverName,
      driver_phone: parsed.data.driverPhone,
      dispatched_at: new Date().toISOString(),
      dispatched_by: profile.user_id
    });
  } catch (error) {
    console.error('[quick-request/dispatch] failed:', error);
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
  await safeNotify('dispatched', () =>
    notifyQuickRequestEvent({ row: latest, event: 'dispatched', actorUserId: profile.user_id, actorName })
  );

  return logger.respond(
    { success: true, data: { requestNo, status: updated.status } },
    200,
    {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, {
        previous_status: 'dispatching',
        new_status: updated.status
      })
    }
  );
}
