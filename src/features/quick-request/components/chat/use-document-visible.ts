'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function getSnapshot(): boolean {
  return document.visibilityState === 'visible';
}

function getServerSnapshot(): boolean {
  return true;
}

/** plan 100 D-2 ① — 탭이 보이는지 (`visibilitychange`). SSR·hydration 기본값 `true` */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
