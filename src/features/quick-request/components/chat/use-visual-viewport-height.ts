'use client';

import { useEffect, type RefObject } from 'react';
import { QUICK_CHAT_MOBILE_MEDIA_QUERY } from './quick-chat-constants';

const MIN_HEIGHT_PX = 320;
const DEFAULT_BOTTOM_GAP_PX = 16;

export type VisualViewportHeightOptions = {
  /**
   * `default`: `보이는 뷰포트 바닥 − 요소 top − bottomGapPx` (최소 320px · PC·대화 목록).
   * `fullscreen`(plan 106 K1 · designer §5.2): **lg 미만에서만** 보이는 뷰포트 높이 그대로(최소 0 · 여백 0) —
   * 키보드가 올라와 476px가 되어도 문서보다 커지지 않아 이중 스크롤이 없다. `visualViewport.offsetTop > 0`·창 스크롤이 생기면
   * `scrollTo(0, 0)`으로 상단바를 화면 안에 붙잡는다. lg 이상에서는 `default`와 같다.
   */
  mode?: 'default' | 'fullscreen';
  /** 요소 아래 여백(px) — `default`에서만 (기본 16 · `PageContainer` `pb-4`) */
  bottomGapPx?: number;
  /**
   * 바닥 경계 셀렉터 (plan 106 §5.3 — 퀵 탭 바 `[data-quick-tabbar]`). 보이면(높이 > 0) 그 `getBoundingClientRect().top`과
   * 보이는 뷰포트 바닥 중 위쪽을 바닥으로 쓴다(safe-area 포함 실측 · 상수 금지). 안 보이면 무시.
   */
  bottomBoundary?: string;
};

function isBelowLg(): boolean {
  return window.matchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY).matches;
}

function readBoundaryTop(selector: string | undefined): number | null {
  if (!selector) return null;
  const boundary = document.querySelector<HTMLElement>(selector);
  if (!boundary) return null;
  const rect = boundary.getBoundingClientRect();
  return rect.height > 0 ? rect.top : null;
}

/**
 * plan 93 designer §4.10 — 대화 컨테이너 높이를 **보이는 뷰포트**에 맞춘다 (`height = viewport - top - gap`).
 * - dashboard 셸(`main`)은 `min-h-svh`라 위에서 높이를 못 묶는다 → 요소가 스스로 뷰포트 기준 높이를 잡아야
 *   메시지 영역이 스크롤 컨테이너가 된다(페이지 스크롤 없음 · U-1).
 * - iOS 키보드가 뜨면 `window.visualViewport`가 줄어드므로 같은 식으로 다시 계산한다(입력창이 가려지지 않음).
 * - plan 106: `mode: 'fullscreen'`(대화방·상세 대화 lg 미만) · `bottomBoundary`(대화 목록 → 퀵 탭 바 위에서 끝남).
 * CSS `calc(100dvh-…)`는 JS 전 첫 페인트용 fallback이고, 마운트 뒤에는 이 훅이 inline height를 덮어쓴다.
 */
export function useVisualViewportHeight(
  ref: RefObject<HTMLElement | null>,
  { mode = 'default', bottomGapPx = DEFAULT_BOTTOM_GAP_PX, bottomBoundary }: VisualViewportHeightOptions = {}
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const viewport = window.visualViewport;
    let frame = 0;

    function isFullscreenNow() {
      return mode === 'fullscreen' && isBelowLg();
    }

    /** 전체 화면에서 iOS가 키보드·포커스로 창을 밀어 올리면 상단바가 화면 밖으로 나간다 → 맨 위로 되돌린다 */
    function pinToTop() {
      if (!isFullscreenNow()) return false;
      const offsetTop = viewport?.offsetTop ?? 0;
      if (offsetTop > 0 || window.scrollY > 0) {
        window.scrollTo(0, 0);
        return true;
      }
      return false;
    }

    function apply() {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const top = Math.max(0, node.getBoundingClientRect().top);

      if (isFullscreenNow()) {
        const next = Math.max(0, viewportHeight + viewportTop - top);
        node.style.height = `${Math.round(next)}px`;
        return;
      }

      const visibleBottom = viewportHeight + viewportTop;
      const boundaryTop = readBoundaryTop(bottomBoundary);
      const bottom = boundaryTop === null ? visibleBottom : Math.min(visibleBottom, boundaryTop);
      const next = Math.max(MIN_HEIGHT_PX, bottom - top - bottomGapPx);
      node.style.height = `${Math.round(next)}px`;
    }

    function schedule() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    }

    function handleViewportScroll() {
      pinToTop();
      schedule();
    }

    function handleWindowScroll() {
      if (pinToTop()) schedule();
    }

    pinToTop();
    apply();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', handleViewportScroll);
    const observer = new ResizeObserver(schedule);
    if (element.parentElement) observer.observe(element.parentElement);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', handleWindowScroll);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', handleViewportScroll);
      observer.disconnect();
      element.style.removeProperty('height');
    };
  }, [bottomBoundary, bottomGapPx, mode, ref]);
}
