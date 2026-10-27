/* eslint-disable */
/**
 * WakeOne 서비스 워커 (plan 91 — 휴대폰 웹 푸시 전용).
 * 캐시·오프라인 처리는 하지 않는다. push 표시 · 알림 클릭 이동 · 앱 아이콘 배지만 담당한다.
 */

const NOTIFICATIONS_URL = '/dashboard/notifications';
const ICON_URL = '/icons/icon-192.png';
const BADGE_URL = '/icons/badge-72.png';

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

      if (sameOrigin) {
        return Promise.resolve(sameOrigin.focus ? sameOrigin.focus() : sameOrigin).then(
          (client) => {
            if (client && 'navigate' in client && typeof client.navigate === 'function') {
              return client.navigate(targetUrl).catch(() => client);
            }
            return client;
          }
        );
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
