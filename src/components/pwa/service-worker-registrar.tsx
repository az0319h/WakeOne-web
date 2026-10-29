'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  SW_NAVIGATE_ACK,
  isSwNavigateMessage,
  resolveInternalNavigationPath,
  startInstallPromptCapture
} from '@/features/notifications/lib/push-client';

/**
 * plan 91 — `/sw.js` 등록 (루트 layout). 캐시 없음 · push 표시 전용 SW.
 * Android `beforeinstallprompt`는 페이지 초기에 발생하므로 여기서 함께 잡아 둔다.
 * plan 94 D-6 — SW가 알림 클릭 시 보내는 `{ type: 'wakeone:navigate', url }`를 받아 `router.push`(전체 재로드 없음)하고
 * `MessageChannel` 포트로 `'ack'`를 돌려준다. ack가 1.5초 안에 없으면 SW가 `client.navigate`(재로드)로 fallback.
 */
export function ServiceWorkerRegistrar() {
  const router = useRouter();

  useEffect(() => {
    const stopCapture = startInstallPromptCapture();

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return stopCapture;
    }

    const handleMessage = (event: MessageEvent) => {
      if (!isSwNavigateMessage(event.data)) return;
      const path = resolveInternalNavigationPath(event.data.url);
      if (!path) return;
      router.push(path);
      const port = event.ports?.[0];
      if (port) {
        try {
          port.postMessage(SW_NAVIGATE_ACK);
        } catch {
          /* 포트가 닫혔으면 SW 쪽 타임아웃 fallback */
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* 등록 실패는 기능 저하만 — 사용자 흐름 차단 없음 */
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      stopCapture();
    };
  }, [router]);

  return null;
}
