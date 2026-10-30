'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * plan 106 D-5 · designer §7 — 퀵 화면 안 「뒤로」.
 *
 * - 앱 안에서 들어온 화면(퀵 layout이 마운트된 뒤 push로 쌓인 기록)이면 `router.back()`.
 * - 알림·주소창·새 창·다른 메뉴에서 **바로 들어온** 화면이면 부모 화면으로 `router.replace(parentHref)`.
 *   → 설치 앱(standalone · 브라우저 뒤로 없음)에서도 항상 빠져나갈 수 있고, 닫은 화면이 폰 뒤로가기로 다시 열리지 않는다(T5).
 *
 * 기록 깊이(`quickInAppDepth`)는 모듈 변수 하나 — `QuickBackTracker`(퀵 layout에 1개)만 쓰고 `useQuickBack`은 클릭 때 읽기만 한다
 * (렌더 구독 없음). 상단바 「뒤로」(`QuickMobileBackButton`)는 퀵 layout 밖(Header)에 있지만 같은 모듈 변수를 본다.
 */

type NavigationEntryLike = { index: number };
type NavigationLike = { currentEntry?: NavigationEntryLike | null };

let quickInAppDepth = 0;
/** Navigation API(크롬·안드로이드·최신 사파리)가 있으면 퀵 layout 마운트 시점의 기록 위치 — 정확한 깊이 계산용 */
let navigationBaseIndex: number | null = null;
/** Navigation API가 없을 때(구형 브라우저) 쓰는 대체 판정 상태 */
let fallbackPopPending = false;
let fallbackHistoryLength = 0;

function readNavigationIndex(): number | null {
  const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
  const index = navigation?.currentEntry?.index;
  return typeof index === 'number' && index >= 0 ? index : null;
}

function resetQuickInAppDepth() {
  quickInAppDepth = 0;
  navigationBaseIndex = readNavigationIndex();
  fallbackPopPending = false;
  fallbackHistoryLength = window.history.length;
}

/** URL(pathname+search)이 바뀐 직후 호출 — push면 +1, 뒤로/앞으로면 기록 위치대로, replace면 그대로 */
function syncQuickInAppDepth() {
  const index = readNavigationIndex();
  if (index !== null && navigationBaseIndex !== null) {
    if (index < navigationBaseIndex) navigationBaseIndex = index;
    quickInAppDepth = index - navigationBaseIndex;
    return;
  }

  // 대체 판정 (designer §7.2): popstate 직후 = 뒤로(−1) · history.length 증가 = push(+1) · 그 밖 = replace(그대로)
  const length = window.history.length;
  if (fallbackPopPending) {
    quickInAppDepth = Math.max(0, quickInAppDepth - 1);
  } else if (length > fallbackHistoryLength) {
    quickInAppDepth += 1;
  }
  fallbackPopPending = false;
  fallbackHistoryLength = length;
}

/** 지금 화면 아래에 퀵 안에서 쌓인 기록이 있는가 (클릭 시점에 읽는 값 · 렌더에 쓰지 말 것) */
export function hasQuickInAppHistory(): boolean {
  return quickInAppDepth > 0;
}

/**
 * 퀵 layout(`src/app/dashboard/quick/layout.tsx`)에 **1개만** 둔다. 화면에 아무것도 그리지 않는다.
 * `useSearchParams`를 쓰므로 `<Suspense fallback={null}>` 안에 둔다.
 */
export function QuickBackTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams.toString()}`;
  const isFirstSyncRef = useRef(true);

  useEffect(() => {
    resetQuickInAppDepth();

    function handlePopState() {
      fallbackPopPending = true;
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isFirstSyncRef.current) {
      isFirstSyncRef.current = false;
      return;
    }
    syncQuickInAppDepth();
  }, [url]);

  return null;
}

/**
 * 「뒤로」 동작 함수를 돌려준다: 퀵 안 기록이 있으면 `router.back()`, 없으면 `router.replace(parentHref)`.
 * `parentHref`는 문자열 또는 클릭 시점에 계산하는 함수(예: 대화 목록의 q·tab·range 유지).
 */
export function useQuickBack(parentHref: string | (() => string)): () => void {
  const router = useRouter();
  const parentHrefRef = useRef(parentHref);

  useEffect(() => {
    parentHrefRef.current = parentHref;
  }, [parentHref]);

  return useCallback(() => {
    if (hasQuickInAppHistory()) {
      router.back();
      return;
    }
    const target = parentHrefRef.current;
    router.replace(typeof target === 'function' ? target() : target);
  }, [router]);
}
