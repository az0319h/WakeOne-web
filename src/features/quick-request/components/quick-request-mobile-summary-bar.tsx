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
  formatQuickRequestSummaryLine
} from './quick-request-summary-content';

type QuickRequestMobileSummaryBarProps = {
  values: QuickRequestFormValues;
  isSubmitting: boolean;
  onRegister: () => void;
};

/** lg 미만 하단 고정 바 — 요약 1줄 + 등록 · 탭 시 Drawer 전체 요약 */
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

  return (
    <div
      data-testid='quick-request-mobile-bar'
      className='-mx-4 -mb-4 flex shrink-0 items-center gap-3 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 lg:hidden'
    >
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            data-testid='quick-request-mobile-summary-trigger'
            className='h-auto min-h-11 min-w-0 flex-1 justify-start gap-2 px-0 text-left font-normal hover:bg-transparent'
          >
            <span className='min-w-0 flex-1'>
              <span className='block text-xs text-muted-foreground'>요청 요약</span>
              <span className='line-clamp-2 text-sm font-medium wrap-break-word whitespace-normal text-foreground'>
                {formatQuickRequestSummaryLine(values)}
              </span>
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
        className='h-11 shrink-0 px-4'
        isLoading={isSubmitting}
        data-testid='quick-request-mobile-register-button'
        onClick={onRegister}
      >
        퀵 요청 등록하기
      </Button>
    </div>
  );
}
