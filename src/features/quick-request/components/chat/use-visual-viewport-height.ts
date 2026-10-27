'use client';

import { useEffect, type RefObject } from 'react';

const MIN_HEIGHT_PX = 320;

/**
 * plan 93 designer §4.10 — 대화 컨테이너 높이를 **보이는 뷰포트**에 맞춘다 (`height = viewport - top - gap`).
 * - dashboard 셸(`main`)은 `min-h-svh`라 위에서 높이를 못 묶는다 → 요소가 스스로 뷰포트 기준 높이를 잡아야
 *   메시지 영역이 스크롤 컨테이너가 된다(페이지 스크롤 없음 · U-1).
 * - iOS 키보드가 뜨면 `window.visualViewport`가 줄어드므로 같은 식으로 다시 계산한다(입력창이 가려지지 않음).
 * CSS `calc(100dvh-…)`는 JS 전 첫 페인트용 fallback이고, 마운트 뒤에는 이 훅이 inline height를 덮어쓴다.
 */
export function useVisualViewportHeight(ref: RefObject<HTMLElement | null>, bottomGapPx = 16) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const viewport = window.visualViewport;
    let frame = 0;

    function apply() {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const top = Math.max(0, node.getBoundingClientRect().top);
      const next = Math.max(MIN_HEIGHT_PX, viewportHeight + viewportTop - top - bottomGapPx);
      node.style.height = `${Math.round(next)}px`;
    }

    function schedule() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    const observer = new ResizeObserver(schedule);
    if (element.parentElement) observer.observe(element.parentElement);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      observer.disconnect();
      ref.current?.style.removeProperty('height');
    };
  }, [bottomGapPx, ref]);
}
