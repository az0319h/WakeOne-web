'use client';

import { useState } from 'react';
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
import { cn } from '@/lib/utils';
import type { QuickRangeValue } from '../../lib/quick-range-search-params';
import { QUICK_RANGE_PRESETS, quickRangePresetAriaLabel } from '../dashboard/quick-range-filter';
import { QuickRangeSheetField } from '../dashboard/quick-range-sheet-field';
import { QUICK_CHAT_TEXT } from './quick-chat-constants';

/** 버튼에 보이는 짧은 값 — 「7일」「30일」「90일」「전체」 · 직접 선택이면 「10-01~10-27」 */
function shortRangeValue(range: QuickRangeValue): string {
  if (range.range === 'custom' && range.from && range.to) {
    return `${range.from.slice(5)}~${range.to.slice(5)}`;
  }
  return QUICK_RANGE_PRESETS.find((preset) => preset.value === range.range)?.label ?? QUICK_RANGE_PRESETS[0].label;
}

/** 접근 이름용 값 — 「최근 7일」「전체 기간」 · 직접 선택이면 「2026-10-01 ~ 2026-10-27」 */
function longRangeValue(range: QuickRangeValue): string {
  if (range.range === 'custom' && range.from && range.to) {
    return `${range.from} ~ ${range.to}`;
  }
  const preset = QUICK_RANGE_PRESETS.find((item) => item.value === range.range) ?? QUICK_RANGE_PRESETS[0];
  return quickRangePresetAriaLabel(preset);
}

type QuickChatFilterSheetProps = {
  value: QuickRangeValue;
  onChange: (next: QuickRangeValue) => void;
  className?: string;
};

/**
 * plan 106 D-7(대화 목록판) · designer §5.3 · K15 — lg 미만 「퀵 대화」 목록의 기간 판.
 * 버튼(`quick-chat-filter-button`)은 지금 값을 보여 준다(「기간 7일」 · 대화 목록에는 메타바가 없어 줄이 늘지 않게).
 * 판 = vaul Drawer(아래에서) · 본문 `QuickRangeSheetField testIdPrefix='quick-chat-filter'` · 아래 고정 「닫기」(safe-area).
 * 선택은 바로 URL에 반영(달력만 「적용」) — 내역 필터 판(§3.7)과 같은 방식. lg 이상은 기존 `QuickRangeFilter` 줄 그대로.
 */
export function QuickChatFilterSheet({ value, onChange, className }: QuickChatFilterSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type='button'
          variant='outline'
          aria-haspopup='dialog'
          aria-label={`${QUICK_CHAT_TEXT.filterButtonAria}, ${longRangeValue(value)}`}
          data-testid='quick-chat-filter-button'
          className={cn('h-11 shrink-0 touch-manipulation gap-1.5 px-3 tabular-nums lg:hidden', className)}
        >
          <Icons.calendar aria-hidden className='size-4' />
          <span>{QUICK_CHAT_TEXT.filterButton}</span>
          <span data-testid='quick-chat-filter-value' className='font-semibold'>
            {shortRangeValue(value)}
          </span>
        </Button>
      </DrawerTrigger>
      <DrawerContent
        data-testid='quick-chat-filter-sheet'
        className='data-[vaul-drawer-direction=bottom]:max-h-[85dvh]'
      >
        <DrawerHeader className='text-left'>
          <DrawerTitle>{QUICK_CHAT_TEXT.filterTitle}</DrawerTitle>
          <DrawerDescription className='sr-only'>{QUICK_CHAT_TEXT.filterDescription}</DrawerDescription>
        </DrawerHeader>
        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4'>
          <QuickRangeSheetField value={value} onChange={onChange} testIdPrefix='quick-chat-filter' />
        </div>
        <DrawerFooter className='border-t pb-[max(1rem,env(safe-area-inset-bottom))]'>
          <DrawerClose asChild>
            <Button type='button' className='h-11 w-full touch-manipulation' data-testid='quick-chat-filter-close'>
              {QUICK_CHAT_TEXT.close}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
