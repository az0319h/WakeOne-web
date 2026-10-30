'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer';
import { Icons } from '@/components/icons';
import type { QuickRequestFormValues } from '../schemas/quick-request-form';
import {
  QuickRequestSummaryContent,
  formatQuickRequestSummaryParts
} from './quick-request-summary-content';

type QuickRequestMobileSummaryBarProps = {
  values: QuickRequestFormValues;
  isSubmitting: boolean;
  onRegister: () => void;
};

/**
 * lg 미만 하단 고정 바 — 요약 1줄 + 등록 · 탭 시 Drawer 전체 요약.
 * plan 106 D-10 ⑦ · AC-29 — 페이지 스크롤에서 `sticky bottom-0`(문서 흐름 끝 · fixed 아님) · 높이 61px(≤ 76) ·
 * 경로만 말줄임, 「{차량} · {대수}」는 통째로(단어 중간 줄바꿈 없음). `data-quick-sticky-bottom` → 전역 scroll-padding.
 */
export function QuickRequestMobileSummaryBar({
  values,
  isSubmitting,
  onRegister
}: QuickRequestMobileSummaryBarProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  // Drawer 등록 경로: 닫힘 시 trigger 포커스 복귀가 scrollToFirstError·미리보기 Dialog 포커스를 빼앗지 않도록 차단
  const registerFromDrawerRef = React.useRef(false);

  function handleRegisterFromDrawer() {
    registerFromDrawerRef.current = true;
    setDrawerOpen(false);
    onRegister();
  }

  const summary = formatQuickRequestSummaryParts(values);

  return (
    <div
      data-testid='quick-request-mobile-bar'
      data-quick-sticky-bottom
      className='sticky bottom-0 z-20 -mx-4 -mb-4 flex shrink-0 items-center gap-3 border-t bg-background px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 lg:hidden'
    >
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            data-testid='quick-request-mobile-summary-trigger'
            className='h-11 min-w-0 flex-1 justify-start gap-2 px-0 text-left font-normal hover:bg-transparent'
          >
            {/* 접근 이름 = 「요청 요약 보기, {보이는 요약}」 (보이는 글자 포함 규칙) */}
            <span className='sr-only'>요청 요약 보기, </span>
            <span
              data-testid='quick-request-mobile-summary-text'
              className='flex min-w-0 flex-1 items-center overflow-hidden text-sm font-medium whitespace-nowrap text-foreground'
            >
              <span className='min-w-0 truncate'>{summary.route}</span>
              <span className='shrink-0 break-keep'>&nbsp;· {summary.rest}</span>
            </span>
            <Icons.chevronUp className='size-4 shrink-0 text-muted-foreground' aria-hidden />
          </Button>
        </DrawerTrigger>
        <DrawerContent
          data-testid='quick-request-summary-drawer'
          className='data-[vaul-drawer-direction=bottom]:max-h-[85dvh]'
          onCloseAutoFocus={(e) => {
            if (registerFromDrawerRef.current) {
              e.preventDefault();
              registerFromDrawerRef.current = false;
            }
          }}
        >
          <DrawerHeader className='text-left'>
            <DrawerTitle>요청 요약</DrawerTitle>
            <DrawerDescription>입력 내용을 확인하고 등록해 주세요.</DrawerDescription>
          </DrawerHeader>
          <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4'>
            <QuickRequestSummaryContent values={values} />
          </div>
          <DrawerFooter className='border-t pb-[max(1rem,env(safe-area-inset-bottom))]'>
            <Button
              type='button'
              className='h-11 w-full'
              isLoading={isSubmitting}
              onClick={handleRegisterFromDrawer}
            >
              퀵 요청 등록하기
            </Button>
            <DrawerClose asChild>
              <Button type='button' variant='outline' className='h-11 w-full'>
                닫기
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Button
        type='button'
        className='h-11 shrink-0 px-5'
        isLoading={isSubmitting}
        aria-label='퀵 요청 등록하기'
        data-testid='quick-request-mobile-register-button'
        onClick={onRegister}
      >
        등록하기
      </Button>
    </div>
  );
}
