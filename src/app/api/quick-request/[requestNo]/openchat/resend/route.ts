import { buildErrorMetadata, createRequestId } from '@/features/activity-logs/api/log.server';
import { canOperateQuickRequests } from '@/features/auth/api/quick-access.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  resendQuickOpenchatEvent,
  type ResendQuickOpenchatResult
} from '@/features/quick-request/lib/openchat-webhook.server';
import {
  QUICK_REQUEST_MESSAGES,
  quickRequestResendBodySchema
} from '@/features/quick-request/schemas/quick-request-workflow';
import {
  createQuickRouteLogger,
  loadQuickRequestForMutation,
  logQuickRequestAuthFailure,
  QUICK_REQUEST_TARGET,
  quickErrorBody,
  quickLogMetadata,
  readJsonBody,
  zodIssuesToValidationErrors
} from '../../../_utils';

type Params = { params: Promise<{ requestNo: string }> };

const ACTION = 'quick_request.openchat_resend' as const;

/**
 * 동방·admin: 저장된 payload를 같은 Idempotency-Key로 재전송 (같은 재시도 규칙).
 * 취소된 요청의 `cancelled` 이벤트도 재전송해야 하므로 잠금(409 locked) 검사는 하지 않는다.
 */
export async function POST(request: Request, { params }: Params) {
  const requestId = createRequestId();
  const { requestNo: rawRequestNo } = await params;
  const httpPath = `/api/quick-request/${rawRequestNo}/openchat/resend`;
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

  const json = await readJsonBody(request);
  const parsed = quickRequestResendBodySchema.safeParse(json.ok ? json.body : null);
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

  const { event } = parsed.data;

  let result: ResendQuickOpenchatResult;
  try {
    result = await resendQuickOpenchatEvent(row.id, event);
  } catch (error) {
    console.error('[quick-request/openchat/resend] failed:', error);
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.internalError), 500, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('internal_error', undefined, { status: event }))
    });
  }

  if (!result.ok) {
    if (result.reason === 'not_found') {
      return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.openchatRecordNotFound), 404, {
        targetLabel: requestNo,
        metadata: quickLogMetadata(requestNo, buildErrorMetadata('not_found', undefined, { status: event }))
      });
    }
    return logger.respond(quickErrorBody(QUICK_REQUEST_MESSAGES.openchatAlreadySent), 409, {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, buildErrorMetadata('conflict', undefined, { status: event }))
    });
  }

  const { outcome } = result;
  return logger.respond(
    {
      success: true,
      data: { event: outcome.event, status: outcome.status, attemptCount: outcome.attempts }
    },
    200,
    {
      targetLabel: requestNo,
      metadata: quickLogMetadata(requestNo, { openchat: outcome })
    }
  );
}
