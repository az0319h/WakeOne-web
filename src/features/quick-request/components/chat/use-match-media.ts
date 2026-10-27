'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** SSR·hydration 중 false, 이후 `matchMedia(query).matches` (레이아웃 분기 전용 · hydration 뒤에만 쓰는 트리에서 사용) */
export function useMatchMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
