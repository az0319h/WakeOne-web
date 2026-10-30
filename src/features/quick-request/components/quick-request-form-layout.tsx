'use client';

import { createContext, use, type ReactNode } from 'react';
import { useMatchMedia } from './chat/use-match-media';

/**
 * plan 106 D-10 — 요청 폼 섹션·컨트롤이 어느 화면에 그려지는지.
 * - `page`: `/dashboard/quick/request` 요청 폼 (lg 미만 휴대폰 규칙 · 등록 전용 날짜 `min` · 라디오 카드 가운데)
 * - `sheet`: 수정 Sheet(동방특송·admin·요청자) — **기본값 · 지금 화면 그대로**
 *
 * 섹션 컴포넌트(주소·차량·일정·물품·전달사항·결제)는 요청 폼과 수정 Sheet가 공유하므로
 * 휴대폰 개편은 이 값이 `page`일 때만 적용한다 (수정 Sheet 무변경).
 */
export type QuickRequestFormLayout = 'page' | 'sheet';

const QuickRequestFormLayoutContext = createContext<QuickRequestFormLayout>('sheet');

type QuickRequestFormLayoutProviderProps = {
  value: QuickRequestFormLayout;
  children: ReactNode;
};

export function QuickRequestFormLayoutProvider({ value, children }: QuickRequestFormLayoutProviderProps) {
  return <QuickRequestFormLayoutContext value={value}>{children}</QuickRequestFormLayoutContext>;
}

export function useQuickRequestFormLayout(): QuickRequestFormLayout {
  return use(QuickRequestFormLayoutContext);
}

/** PC 판정 — 설계 K8: SSR·hydration 중 `false`(휴대폰 우선) → lg 이상이면 hydration 직후 `true` */
export const QUICK_REQUEST_DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

export function useQuickRequestIsDesktop(): boolean {
  return useMatchMedia(QUICK_REQUEST_DESKTOP_MEDIA_QUERY);
}

/**
 * 요청 폼 글자 칸 공통 — lg 미만(태블릿 포함) 입력 글자 16px(iOS 확대 방지) · lg 이상은 지금(14px) 그대로.
 * ui `Input`/`Textarea` 기본 `text-base md:text-sm`의 `md:` 값만 덮는다.
 */
export const QUICK_REQUEST_PAGE_INPUT_TEXT_CLASS = 'md:text-base lg:text-sm';

/** Enter → 다음 글자 칸 대상 표시 (`quick-request-order-page`의 keydown capture가 사용) */
export const QUICK_REQUEST_ENTER_NEXT_ATTR = 'data-quick-enter-next';

export type QuickRequestEnterKeyHint = 'next' | 'done';

/** 요청 폼(page)일 때만 글자 칸에 붙이는 속성 — 수정 Sheet는 빈 객체(무변경) */
export function quickRequestEnterNextProps(
  layout: QuickRequestFormLayout,
  hint: QuickRequestEnterKeyHint = 'next'
): { enterKeyHint?: QuickRequestEnterKeyHint; [QUICK_REQUEST_ENTER_NEXT_ATTR]?: '' } {
  if (layout !== 'page') {
    return {};
  }
  return { enterKeyHint: hint, [QUICK_REQUEST_ENTER_NEXT_ATTR]: '' };
}
