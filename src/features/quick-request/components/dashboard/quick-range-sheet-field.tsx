'use client';

import { useId, useState } from 'react';
import { ko } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Icons } from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { QUICK_RANGE_DEFAULT_VALUE, type QuickRangeValue } from '../../lib/quick-range-search-params';
import {
  QUICK_RANGE_FILTER_TEXT,
  QUICK_RANGE_PRESETS,
  quickRangePresetAriaLabel,
  startOfToday,
  toCustomRangeValue,
  toDraft,
  toPresetRangeValue
} from './quick-range-filter';

/** 판 legend 「기간」 */
const QUICK_RANGE_SHEET_LEGEND = '기간';

/**
 * 달력 44px (designer K7 — ui `Calendar`는 수정하지 않고 `classNames`만 덮는다 · 7×44 = 308px).
 * nav는 월 제목 줄 위에 겹쳐 양 끝에 이전/다음(44px)을 둔다.
 */
const SHEET_CALENDAR_CLASS_NAMES = {
  months: 'relative flex flex-col gap-2',
  month: 'flex flex-col gap-2',
  month_caption: 'relative flex h-11 w-full items-center justify-center',
  nav: 'pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between',
  button_previous: cn(
    buttonVariants({ variant: 'outline' }),
    'pointer-events-auto size-11 bg-transparent p-0'
  ),
  button_next: cn(
    buttonVariants({ variant: 'outline' }),
    'pointer-events-auto size-11 bg-transparent p-0'
  ),
  weekday: 'text-muted-foreground w-11 text-[0.8rem] font-normal',
  day_button: cn(
    buttonVariants({ variant: 'ghost' }),
    'size-11 p-0 font-normal aria-selected:opacity-100'
  )
};

type QuickRangeSheetFieldProps = {
  value: QuickRangeValue;
  /** 선택 즉시 호출 (판에 「적용」 버튼 없음 · 달력만 「적용」) */
  onChange: (next: QuickRangeValue) => void;
  /**
   * `{prefix}-range-{7d|30d|90d|all|custom|calendar|apply|clear}`.
   * 판은 `quick-dashboard-filter` / `quick-chat-filter` — PC 툴바(`quick-dashboard-range-*` 등)가 CSS로 숨은 채 DOM에 있으므로 겹치지 않게.
   */
  testIdPrefix: string;
  className?: string;
};

/**
 * plan 106 D-7 · designer §3.8 — 휴대폰 필터 판(Drawer) 안 「기간」 칸 (내역·대화 목록 판 공용).
 * 프리셋 4개(44px) + 「기간 직접 선택」 펼침(Collapsible · Popover 중첩 없음) 달력 44px + 지우기/적용.
 * 문구·판정은 PC `QuickRangeFilter`와 같은 상수·헬퍼를 쓴다.
 */
export function QuickRangeSheetField({
  value,
  onChange,
  testIdPrefix,
  className
}: QuickRangeSheetFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() => toDraft(value));
  const hintId = useId();
  const isCustom = value.range === 'custom';
  const customLabel = isCustom ? `${value.from} ~ ${value.to}` : QUICK_RANGE_FILTER_TEXT.custom;

  function handleOpenChange(next: boolean) {
    if (next) setDraft(toDraft(value));
    setOpen(next);
  }

  function handlePreset(next: string) {
    const preset = toPresetRangeValue(next);
    if (!preset) return;
    onChange(preset);
    setOpen(false);
  }

  function handleClear() {
    onChange(QUICK_RANGE_DEFAULT_VALUE);
    setOpen(false);
  }

  function handleApply() {
    const next = toCustomRangeValue(draft);
    if (!next) return;
    onChange(next);
    setOpen(false);
  }

  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-2', className)}>
      <legend className='mb-2 text-sm font-medium'>{QUICK_RANGE_SHEET_LEGEND}</legend>
      <ToggleGroup
        type='single'
        variant='outline'
        aria-label={QUICK_RANGE_FILTER_TEXT.ariaLabel}
        value={isCustom ? '' : value.range}
        onValueChange={handlePreset}
        className='grid w-full grid-cols-4'
      >
        {QUICK_RANGE_PRESETS.map((preset) => (
          <ToggleGroupItem
            key={preset.value}
            value={preset.value}
            aria-label={quickRangePresetAriaLabel(preset)}
            data-testid={`${testIdPrefix}-range-${preset.value}`}
            className='h-11 touch-manipulation tabular-nums'
          >
            {preset.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Collapsible open={open} onOpenChange={handleOpenChange}>
        <CollapsibleTrigger asChild>
          <Button
            type='button'
            variant='outline'
            data-testid={`${testIdPrefix}-range-custom`}
            className={cn(
              'group/range h-11 w-full touch-manipulation justify-between tabular-nums',
              isCustom && 'bg-accent text-accent-foreground'
            )}
          >
            <span className='flex min-w-0 items-center gap-2'>
              <Icons.calendar aria-hidden className='size-4 shrink-0' />
              <span className='truncate'>{customLabel}</span>
            </span>
            <Icons.chevronDown
              aria-hidden
              className='size-4 shrink-0 transition-transform group-data-[state=open]/range:rotate-180 motion-reduce:transition-none'
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className='flex flex-col gap-2 pt-2'>
          <p id={hintId} className='text-muted-foreground text-xs'>
            {QUICK_RANGE_FILTER_TEXT.hint}
          </p>
          <div className='flex justify-center'>
            <Calendar
              mode='range'
              locale={ko}
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={1}
              disabled={{ after: startOfToday() }}
              aria-describedby={hintId}
              data-testid={`${testIdPrefix}-range-calendar`}
              className='p-0'
              classNames={SHEET_CALENDAR_CLASS_NAMES}
            />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <Button
              type='button'
              variant='outline'
              className='h-11 touch-manipulation'
              data-testid={`${testIdPrefix}-range-clear`}
              onClick={handleClear}
            >
              {QUICK_RANGE_FILTER_TEXT.clear}
            </Button>
            <Button
              type='button'
              className='h-11 touch-manipulation'
              disabled={!draft?.from}
              data-testid={`${testIdPrefix}-range-apply`}
              onClick={handleApply}
            >
              {QUICK_RANGE_FILTER_TEXT.apply}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </fieldset>
  );
}
