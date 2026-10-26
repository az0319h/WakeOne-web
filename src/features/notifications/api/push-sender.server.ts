import 'server-only';

/**
 * plan 91 — web-push 래퍼. VAPID 3종이 모두 있어야 「연결됨」.
 * `E2E_WEB_PUSH_MOCK=1`이면 네트워크 없이 endpoint 패턴으로 결과를 정한다
 *   `https://e2e.invalid/push/ok/…` → 성공 · `https://e2e.invalid/push/410/…` → 410(만료) · 그 외 → 500
 * `E2E_WEB_PUSH_UNCONFIGURED=1`이면 env가 있어도 미설정으로 판단한다 (AC-20 spec 분리용).
 */

export type PushSubscriptionLike = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  notificationId: number | null;
  title: string;
  body: string;
  url: string;
  tag: string;
  unreadCount: number | null;
};

export type PushSendResult =
  | { ok: true }
  | { ok: false; statusCode: number | null; gone: boolean; message: string };

const PUSH_TTL_SECONDS = 86_400;

function readVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  if (process.env.E2E_WEB_PUSH_UNCONFIGURED === '1') {
    return null;
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? '';
  const subject = process.env.VAPID_SUBJECT?.trim() ?? '';
  if (!publicKey || !privateKey || !subject) {
    return null;
  }
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return readVapidConfig() !== null;
}

export function isPushMockEnabled(): boolean {
  return process.env.E2E_WEB_PUSH_MOCK === '1';
}

function sendMock(subscription: PushSubscriptionLike): PushSendResult {
  const endpoint = subscription.endpoint;
  if (endpoint.startsWith('https://e2e.invalid/push/ok/')) {
    return { ok: true };
  }
  if (endpoint.startsWith('https://e2e.invalid/push/410/')) {
    return { ok: false, statusCode: 410, gone: true, message: 'mock gone' };
  }
  if (endpoint.startsWith('https://e2e.invalid/push/404/')) {
    return { ok: false, statusCode: 404, gone: true, message: 'mock not found' };
  }
  return { ok: false, statusCode: 500, gone: false, message: 'mock failure' };
}

export async function sendPush(
  subscription: PushSubscriptionLike,
  payload: PushPayload
): Promise<PushSendResult> {
  const config = readVapidConfig();
  if (!config) {
    return { ok: false, statusCode: null, gone: false, message: 'push not configured' };
  }

  if (isPushMockEnabled()) {
    return sendMock(subscription);
  }

  const webPush = await import('web-push');
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
      },
      JSON.stringify(payload),
      { TTL: PUSH_TTL_SECONDS }
    );
    return { ok: true };
  } catch (error) {
    const statusCode =
      typeof (error as { statusCode?: unknown })?.statusCode === 'number'
        ? ((error as { statusCode: number }).statusCode as number)
        : null;
    return {
      ok: false,
      statusCode,
      gone: statusCode === 404 || statusCode === 410,
      message: error instanceof Error ? error.message : 'unknown push error'
    };
  }
}
