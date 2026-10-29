import { NextRequest } from 'next/server';
import { createRequestId } from '@/features/activity-logs/api/log.server';
import type { ActivityLogMetadata } from '@/features/activity-logs/api/types';
import { requireSession } from '@/features/auth/api/session.server';
import {
  failWithLog,
  finishSessionFailure,
  internalErrorWithLog,
  PUSH_DEVICE_NOT_FOUND_MESSAGE,
  PUSH_INVALID_SUBSCRIPTION_MESSAGE,
  PUSH_NOT_CONFIGURED_MESSAGE,
  PUSH_RESUME_BLOCKED_DEACTIVATED_MESSAGE,
  PUSH_RESUME_OWNED_BY_OTHER_MESSAGE,
  readJsonBody,
  respondWithLog,
  type PushRouteContext
} from '@/features/notifications/api/push-route.server';
import {
  createPushSubscriptionSchema,
  deletePushSubscriptionSchema,
  readCreateSourceForLog,
  readDeleteSourceForLog
} from '@/features/notifications/api/push-schemas';
import { isPushConfigured } from '@/features/notifications/api/push-sender.server';
import {
  countPushSubscriptions,
  deletePushSubscription,
  endpointHost,
  findPushSubscriptionByEndpoint,
  hasDeactivationSince,
  upsertPushSubscription
} from '@/features/notifications/api/push-subscriptions.server';

const HTTP_PATH = '/api/notifications/push/subscriptions';

/**
 * 구독 등록 — endpoint 기준 upsert. 신규 201 · 기존 200 (멱등).
 * plan 105: `source`(`manual` 기본 · `auto_resume`) · `resume_marker_at`(auto_resume 필수).
 * 순서: 세션 → 400 → 503 → (auto_resume만) 409 다른 계정 소유 → 409 마커 이후 비활성화 이력 → upsert 201/200 → 500.
 */
export async function POST(request: NextRequest) {
  const ctx: PushRouteContext = {
    requestId: createRequestId(),
    action: 'push_subscription.create',
    httpMethod: 'POST',
    httpPath: HTTP_PATH
  };

  const session = await requireSession();
  if (!session.ok) {
    return finishSessionFailure(ctx, session.response);
  }

  let logSource: ActivityLogMetadata['source'];

  try {
    const body = await readJsonBody(request);
    logSource = readCreateSourceForLog(body);

    const parsed = createPushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return failWithLog(ctx, session, 400, PUSH_INVALID_SUBSCRIPTION_MESSAGE, 'validation', {
        source: logSource
      });
    }

    const source = parsed.data.source ?? 'manual';
    logSource = source;
    const host = endpointHost(parsed.data.endpoint);

    if (!isPushConfigured()) {
      return failWithLog(ctx, session, 503, PUSH_NOT_CONFIGURED_MESSAGE, 'conflict', {
        endpoint_host: host,
        source
      });
    }

    if (source === 'auto_resume') {
      // ① 다른 계정 소유 endpoint는 자동 복구로 가져오지 않는다(이동 금지 · 표시가 꼬여도 이중 차단)
      const existing = await findPushSubscriptionByEndpoint(parsed.data.endpoint);
      if (existing && existing.user_id !== session.userId) {
        return failWithLog(ctx, session, 409, PUSH_RESUME_OWNED_BY_OTHER_MESSAGE, 'conflict', {
          endpoint_host: host,
          source,
          reason: 'owned_by_other'
        });
      }

      // ② 표시 이후 비활성화된 적이 있으면 자동 복구하지 않는다(91 AC-15 · D-5 ①)
      const markerAt = parsed.data.resume_marker_at as string;
      if (await hasDeactivationSince(session.userId, markerAt)) {
        return failWithLog(ctx, session, 409, PUSH_RESUME_BLOCKED_DEACTIVATED_MESSAGE, 'conflict', {
          endpoint_host: host,
          source,
          reason: 'deactivated_after_marker'
        });
      }
    }

    const userAgent =
      parsed.data.userAgent?.trim() || request.headers.get('user-agent')?.slice(0, 512) || null;

    const { id, created } = await upsertPushSubscription({
      userId: session.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent
    });
    const deviceCount = await countPushSubscriptions(session.userId);

    return respondWithLog(
      ctx,
      session,
      { success: true, data: { id, device_count: deviceCount } },
      created ? 201 : 200,
      { created, device_count: deviceCount, endpoint_host: host, source }
    );
  } catch (error) {
    return internalErrorWithLog(ctx, session, error, { source: logSource });
  }
}

/**
 * 구독 해제 — `{endpoint}` 또는 `{id}` · 소유자 범위. 0행이면 404.
 * plan 105: `source`(`manual` 기본 · `sign_out` · `forced_sign_out`) — 동작은 91 그대로, 로그 metadata에만 남긴다.
 */
export async function DELETE(request: NextRequest) {
  const ctx: PushRouteContext = {
    requestId: createRequestId(),
    action: 'push_subscription.delete',
    httpMethod: 'DELETE',
    httpPath: HTTP_PATH
  };

  const session = await requireSession();
  if (!session.ok) {
    return finishSessionFailure(ctx, session.response);
  }

  let logSource: ActivityLogMetadata['source'];

  try {
    const body = await readJsonBody(request);
    logSource = readDeleteSourceForLog(body);

    const parsed = deletePushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return failWithLog(ctx, session, 400, PUSH_INVALID_SUBSCRIPTION_MESSAGE, 'validation', {
        source: logSource
      });
    }

    const source = parsed.data.source ?? 'manual';
    logSource = source;

    const result = await deletePushSubscription({
      userId: session.userId,
      endpoint: parsed.data.endpoint,
      id: parsed.data.id
    });
    const host = endpointHost(result.endpoint ?? parsed.data.endpoint ?? '');

    if (!result.deleted) {
      return failWithLog(ctx, session, 404, PUSH_DEVICE_NOT_FOUND_MESSAGE, 'not_found', {
        endpoint_host: host,
        source
      });
    }

    const deviceCount = await countPushSubscriptions(session.userId);

    return respondWithLog(
      ctx,
      session,
      { success: true, data: { device_count: deviceCount } },
      200,
      { device_count: deviceCount, endpoint_host: host, source }
    );
  } catch (error) {
    return internalErrorWithLog(ctx, session, error, { source: logSource });
  }
}
