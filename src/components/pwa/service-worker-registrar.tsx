'use client';

import { useEffect } from 'react';
import { startInstallPromptCapture } from '@/features/notifications/lib/push-client';

/**
 * plan 91 — `/sw.js` 등록 (루트 layout). 캐시 없음 · push 표시 전용 SW.
 * Android `beforeinstallprompt`는 페이지 초기에 발생하므로 여기서 함께 잡아 둔다.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    const stopCapture = startInstallPromptCapture();

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return stopCapture;
    }

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* 등록 실패는 기능 저하만 — 사용자 흐름 차단 없음 */
    });

    return stopCapture;
  }, []);

  return null;
}
