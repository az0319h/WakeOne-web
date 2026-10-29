import { NextRequest } from 'next/server';
import { createRequestId, fetchUserTargetLabel } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  failWithLog,
  finishSessionFailure,
  internalErrorWithLog,
  PUSH_INVALID_SUBSCRIPTION_MESSAGE,
  readJsonBody,
  respondWithLog,
  respondWithLogForTarget,
  type PushRouteContext
} from '@/features/notifications/api/push-route.server';
import { detachPushSubscriptionSchema } from '@/features/notifications/api/push-schemas';
import {
  detachForeignPushSubscription,
  endpointHost,
  hashPushOwner
} from '@/features/notifications/api/push-subscriptions.server';

const HTTP_PATH = '/api/notifications/push/subscriptions/detach';

/**
 * plan 105 D-4 — 다른 계정이 로그인한 기기에 남은 **이전 사용자**의 푸시 구독을 끊는다.
 * - 행 없음 → `none` · 내 행 → `mine`(변경 없음) · 다른 계정 → 삭제 후 `detached` + `previous_owner_hash`.
 * - endpoint 원문은 로그·응답에 남기지 않는다(host만). 이전 주인은 hash로만 돌려준다.
 * - VAPID 미설정이어도 동작한다(발송이 아니라 정리).
 * - 로그 `push_subscription.detach`: `detached`면 target = 이전 주인 · 그 밖은 본인. 전 분기 기록.
 */
export async function POST(request: NextRequest) {
  const ctx: PushRouteContext = {
    requestId: createRequestId(),
    action: 'push_subscription.detach',
    httpMethod: 'POST',
    httpPath: HTTP_PATH
  };

  const session = await requireSession();
  if (!session.ok) {
    return finishSessionFailure(ctx, session.response);
  }

  try {
    const parsed = detachPushSubscriptionSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return failWithLog(ctx, session, 400, PUSH_INVALID_SUBSCRIPTION_MESSAGE, 'validation');
    }

    const host = endpointHost(parsed.data.endpoint);
    const outcome = await detachForeignPushSubscription({
      userId: session.userId,
      endpoint: parsed.data.endpoint
    });

    if (outcome.result === 'detached') {
      const previousOwnerId = outcome.previousOwnerId;
      return respondWithLogForTarget(
        ctx,
        session,
        { userId: previousOwnerId, label: await fetchUserTargetLabel(previousOwnerId) },
        {
          success: true,
          data: { result: 'detached', previous_owner_hash: hashPushOwner(previousOwnerId) }
        },
        200,
        { result: 'detached', endpoint_host: host }
      );
    }

    return respondWithLog(
      ctx,
      session,
      { success: true, data: { result: outcome.result } },
      200,
      { result: outcome.result, endpoint_host: host }
    );
  } catch (error) {
    return internalErrorWithLog(ctx, session, error);
  }
}
