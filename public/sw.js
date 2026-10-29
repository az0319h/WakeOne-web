/* eslint-disable */
/**
 * WakeOne 서비스 워커 (plan 91 — 휴대폰 웹 푸시 전용).
 * 캐시·오프라인 처리는 하지 않는다. push 표시 · 알림 클릭 이동 · 앱 아이콘 배지만 담당한다.
 */

const NOTIFICATIONS_URL = '/dashboard/notifications';
const ICON_URL = '/icons/icon-192.png';
const BADGE_URL = '/icons/badge-72.png';
/** plan 94 D-6 — 앱(`service-worker-registrar.tsx`)과 같은 값. 열린 창에 경로를 보내 `router.push`로 즉시 이동시킨다 */
const NAVIGATE_MESSAGE_TYPE = 'wakeone:navigate';
const NAVIGATE_ACK = 'ack';
const NAVIGATE_ACK_TIMEOUT_MS = 1500;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function parsePayload(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    try {
      return { title: 'WakeOne', body: event.data.text(), url: NOTIFICATIONS_URL };
    } catch {
      return null;
    }
  }
}

function syncBadge(unreadCount) {
  if (typeof unreadCount !== 'number') return Promise.resolve();
  try {
    if (unreadCount > 0 && typeof self.registration.setAppBadge === 'function') {
      return self.registration.setAppBadge(unreadCount).catch(() => {});
    }
    if (unreadCount <= 0 && typeof self.registration.clearAppBadge === 'function') {
      return self.registration.clearAppBadge().catch(() => {});
    }
  } catch {
    /* 배지 미지원 */
  }
  return Promise.resolve();
}

self.addEventListener('push', (event) => {
  const payload = parsePayload(event);
  if (!payload) return;

  const title = payload.title || 'WakeOne';
  const url = typeof payload.url === 'string' && payload.url ? payload.url : NOTIFICATIONS_URL;
  const options = {
    body: payload.body || '',
    icon: ICON_URL,
    badge: BADGE_URL,
    tag: payload.tag || undefined,
    renotify: false,
    data: { url, notificationId: payload.notificationId ?? null }
  };

  event.waitUntil(
    Promise.all([self.registration.showNotification(title, options), syncBadge(payload.unreadCount)])
  );
});

/**
 * 열린 창에 `{ type: 'wakeone:navigate', url }`를 보내고 앱의 `'ack'`를 기다린다 (MessageChannel).
 * resolve(true) = 앱이 `router.push`로 이동함 · resolve(false) = 1.5초 안에 ack 없음(앱이 옛 번들이거나 멈춤) → 호출자가 fallback.
 */
function navigateViaApp(client, url) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (acked) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      resolve(acked);
    };
    timer = setTimeout(() => finish(false), NAVIGATE_ACK_TIMEOUT_MS);
    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (message) => {
        if (message.data === NAVIGATE_ACK) finish(true);
      };
      client.postMessage({ type: NAVIGATE_MESSAGE_TYPE, url }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetPath = typeof data.url === 'string' && data.url ? data.url : NOTIFICATIONS_URL;
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const sameOrigin = clientList.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      if (!sameOrigin) {
        // 창이 없을 때만 새 창
        return self.clients.openWindow(targetUrl);
      }

      // plan 94 D-6 — 창이 있으면 focus 후 postMessage → 앱이 router.push (전체 재로드 없음)
      return Promise.resolve(sameOrigin.focus ? sameOrigin.focus() : sameOrigin)
        .then((focused) => focused || sameOrigin)
        .then((client) =>
          navigateViaApp(client, targetUrl).then((acked) => {
            if (acked) return client;
            // ack 타임아웃 fallback — 옛 번들·멈춘 탭: 기존 방식(재로드)으로 이동
            if (typeof client.navigate === 'function') {
              return client.navigate(targetUrl).catch(() => self.clients.openWindow(targetUrl));
            }
            return self.clients.openWindow(targetUrl);
          })
        );
    })
  );
});
