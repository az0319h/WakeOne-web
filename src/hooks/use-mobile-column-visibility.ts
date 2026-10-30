'use client';

import * as React from 'react';
import type { Table } from '@tanstack/react-table';

/** `use-mobile.tsx`와 같은 기준 — 768px 미만이 모바일 */
const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * 768px 미만이면 true. `useIsMobile`과 기준은 같지만 클라이언트 첫 렌더부터 실제 값을 돌려준다
 * (서버·hydration 첫 렌더는 false). Dialog처럼 열린 뒤 그려지는 UI의 조건부 렌더에 쓴다.
 */
export function useIsMobileViewport() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * 모바일(768px 미만)에서 지정한 컬럼을 TanStack column visibility로 숨긴다.
 * 데스크톱으로 돌아오면 다시 보인다. 컬럼 메뉴(보기 옵션)와 같은 상태를 쓰므로
 * 사용자가 모바일에서 다시 켤 수도 있다.
 */
export function useMobileColumnVisibility<TData>(
  table: Table<TData>,
  mobileHiddenColumnIds: readonly string[]
) {
  const isMobile = useIsMobileViewport();
  const idsKey = mobileHiddenColumnIds.join('|');

  React.useLayoutEffect(() => {
    if (!idsKey) {
      return;
    }

    table.setColumnVisibility((current) => {
      const ids = idsKey.split('|');
      // 이미 원하는 상태면 같은 객체를 돌려줘 불필요한 재렌더를 막는다 (미지정 = 보임)
      if (ids.every((id) => (current[id] ?? true) === !isMobile)) {
        return current;
      }
      const next = { ...current };
      for (const id of ids) {
        next[id] = !isMobile;
      }
      return next;
    });
  }, [idsKey, isMobile, table]);

  return isMobile;
}
