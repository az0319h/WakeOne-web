'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** 서버·hydration 중에는 「움직임 줄이기」로 가정 — 컨페티·회전 링·Lottie가 설정 확인 전에 시작되지 않게 */
function getServerSnapshot() {
  return true;
}

/**
 * plan 102 D-14 — `prefers-reduced-motion: reduce` 여부.
 * `motion/react`의 `useReducedMotion`은 SSR(null)과 hydration 첫 값이 달라 불일치가 나므로
 * `useSyncExternalStore`로 서버 스냅샷을 고정한다(`use-is-desktop.ts` 패턴).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
