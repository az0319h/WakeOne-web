'use client';

import { useEffect } from 'react';
import { useNotificationsUnreadCount } from './notification-infinite-list';

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * plan 91 — 설치된 PWA 아이콘 배지를 미읽음 수와 동기화한다. 렌더 없음.
 * 알림센터와 같은 infinite query를 쓰므로 읽음 처리(낙관적 업데이트)에 즉시 반응한다.
 * 상위에서 `<Suspense fallback={null}>`로 감싼다.
 */
export function AppBadgeSync() {
  const unreadCount = useNotificationsUnreadCount();

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as BadgeNavigator;

    if (unreadCount > 0) {
      if (typeof nav.setAppBadge === 'function') {
        nav.setAppBadge(unreadCount).catch(() => {});
      }
      return;
    }

    if (typeof nav.clearAppBadge === 'function') {
      nav.clearAppBadge().catch(() => {});
    }
  }, [unreadCount]);

  return null;
}
