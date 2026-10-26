import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createRequestId } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import {
  failWithLog,
  finishSessionFailure,
  internalErrorWithLog,
  PUSH_DEVICE_NOT_FOUND_MESSAGE,
  PUSH_INVALID_SUBSCRIPTION_MESSAGE,
  PUSH_NOT_CONFIGURED_MESSAGE,
  readJsonBody,
  respondWithLog,
  type PushRouteContext
} from '@/features/notifications/api/push-route.server';
import { isPushConfigured } from '@/features/notifications/api/push-sender.server';
import {
  countPushSubscriptions,
  deletePushSubscription,
  endpointHost,
  upsertPushSubscription
} from '@/features/notifications/api/push-subscriptions.server';

const HTTP_PATH = '/api/notifications/push/subscriptions';

const base64Key = z
  .string()
  .trim()
  .min(8)
  .max(512)
  .regex(/^[A-Za-z0-9_\-+/]+=*$/, 'base64');

const httpsEndpoint = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'https url');

const createSchema = z.object({
  endpoint: httpsEndpoint,
  keys: z.object({ p256dh: base64Key, auth: base64Key }),
  userAgent: z.string().trim().max(512).nullable().optional()
});

const deleteSchema = z
  .object({
    endpoint: httpsEndpoint.optional(),
    id: z.number().int().positive().optional()
  })
  .refine((value) => Boolean(value.endpoint) || typeof value.id === 'number', 'endpoint or id');

/** 구독 등록 — endpoint 기준 upsert. 신규 201 · 기존 200 (멱등) */
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

  try {
    const parsed = createSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return failWithLog(ctx, session, 400, PUSH_INVALID_SUBSCRIPTION_MESSAGE, 'validation');
    }

    const host = endpointHost(parsed.data.endpoint);

    if (!isPushConfigured()) {
      return failWithLog(ctx, session, 503, PUSH_NOT_CONFIGURED_MESSAGE, 'conflict', {
        endpoint_host: host
      });
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
      { created, device_count: deviceCount, endpoint_host: host }
    );
  } catch (error) {
    return internalErrorWithLog(ctx, session, error);
  }
}

/** 구독 해제 — `{endpoint}` 또는 `{id}` · 소유자 범위. 0행이면 404 */
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

  try {
    const parsed = deleteSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return failWithLog(ctx, session, 400, PUSH_INVALID_SUBSCRIPTION_MESSAGE, 'validation');
    }

    const result = await deletePushSubscription({
      userId: session.userId,
      endpoint: parsed.data.endpoint,
      id: parsed.data.id
    });
    const host = endpointHost(result.endpoint ?? parsed.data.endpoint ?? '');

    if (!result.deleted) {
      return failWithLog(ctx, session, 404, PUSH_DEVICE_NOT_FOUND_MESSAGE, 'not_found', {
        endpoint_host: host
      });
    }

    const deviceCount = await countPushSubscriptions(session.userId);

    return respondWithLog(
      ctx,
      session,
      { success: true, data: { device_count: deviceCount } },
      200,
      { device_count: deviceCount, endpoint_host: host }
    );
  } catch (error) {
    return internalErrorWithLog(ctx, session, error);
  }
}
