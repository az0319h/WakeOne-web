'use client';

import { useSyncExternalStore } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribe(callback: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

/** lg(1024px) 이상 여부 — SSR에서는 false */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  );
}
