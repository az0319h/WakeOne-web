import { createRequestId } from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { sendToSubscriptions } from '@/features/notifications/api/push-dispatch.server';
import {
  failWithLog,
  finishSessionFailure,
  internalErrorWithLog,
  PUSH_NO_DEVICE_MESSAGE,
  PUSH_NOT_CONFIGURED_MESSAGE,
  PUSH_TEST_BODY,
  PUSH_TEST_TITLE,
  respondWithLog,
  type PushRouteContext
} from '@/features/notifications/api/push-route.server';
import { isPushConfigured, type PushPayload } from '@/features/notifications/api/push-sender.server';
import { listPushSubscriptions } from '@/features/notifications/api/push-subscriptions.server';
import { NOTIFICATIONS_PAGE_ROUTE } from '@/features/notifications/lib/notification-route';

const HTTP_PATH = '/api/notifications/push/test';

/** 본인 구독 전부에 테스트 발송. 구독 0 → 409 · 미설정 → 503 */
export async function POST() {
  const ctx: PushRouteContext = {
    requestId: createRequestId(),
    action: 'push.test_send',
    httpMethod: 'POST',
    httpPath: HTTP_PATH
  };

  const session = await requireSession();
  if (!session.ok) {
    return finishSessionFailure(ctx, session.response);
  }

  try {
    if (!isPushConfigured()) {
      return failWithLog(ctx, session, 503, PUSH_NOT_CONFIGURED_MESSAGE, 'conflict');
    }

    const subscriptions = await listPushSubscriptions(session.userId);
    if (subscriptions.length === 0) {
      return failWithLog(ctx, session, 409, PUSH_NO_DEVICE_MESSAGE, 'conflict', {
        attempted: 0,
        sent: 0,
        removed: 0
      });
    }

    const payload: PushPayload = {
      notificationId: null,
      title: PUSH_TEST_TITLE,
      body: PUSH_TEST_BODY,
      url: NOTIFICATIONS_PAGE_ROUTE,
      tag: `wakeone-test-${session.userId}`,
      unreadCount: null
    };

    const summary = await sendToSubscriptions(
      subscriptions.map((subscription) => ({ subscription, payload }))
    );
    const data = { attempted: summary.attempted, sent: summary.sent, removed: summary.removed };

    return respondWithLog(ctx, session, { success: true, data }, 200, data);
  } catch (error) {
    return internalErrorWithLog(ctx, session, error);
  }
}
