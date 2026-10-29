'use client';

import { useState } from 'react';
import { ko } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import {
  isQuickRangeDate,
  isQuickRangeKind,
  quickRangeLabel,
  type QuickRangeKind
} from '../../lib/quick-request-range';
import { QUICK_RANGE_DEFAULT_VALUE, type QuickRangeValue } from '../../lib/quick-range-search-params';
import { useMatchMedia } from '../chat/use-match-media';

const PRESETS: ReadonlyArray<{ value: Exclude<QuickRangeKind, 'custom'>; label: string }> = [
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
  { value: 'all', label: '전체' }
];

export const QUICK_RANGE_FILTER_TEXT = {
  ariaLabel: '조회 기간',
  custom: '기간 직접 선택',
  hint: '시작일과 종료일을 차례로 선택하세요',
  clear: '지우기',
  apply: '적용'
} as const;

/** lg↑ 2개월 · 그 아래 1개월 (designer K1 — Popover 폭 clamp · Drawer 미사용) */
const TWO_MONTHS_MEDIA_QUERY = '(min-width: 1024px)';

/** URL `yyyy-MM-dd` → Calendar 로컬 Date (KST 해석은 서버 `parseQuickRange`) */
function parseLocalDate(value: string | null): Date | undefined {
  if (!isQuickRangeDate(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDraft(value: QuickRangeValue): DateRange | undefined {
  if (value.range !== 'custom') return undefined;
  const from = parseLocalDate(value.from);
  const to = parseLocalDate(value.to);
  return from ? { from, to } : undefined;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

type QuickRangeFilterProps = {
  value: QuickRangeValue;
  onChange: (next: QuickRangeValue) => void;
  /** `default`: 대시보드 툴바(h-11 → lg h-9) · `sm`: 「퀵 대화」 패널(h-11 → lg h-8 · 달력은 아이콘 버튼) */
  size?: 'default' | 'sm';
  /** `{prefix}-range-{7d|30d|90d|all|custom|calendar|apply|clear|label}` */
  testIdPrefix: string;
  /** `below`: 아래에 `quickRangeLabel` 보조 문구 (대시보드는 메타바가 따로 표시 → `none`) */
  labelPlacement?: 'none' | 'below';
  className?: string;
};

/**
 * plan 97 D-7 · U-1·U-3 — 기간 ToggleGroup(7일·30일·90일·전체) + 「기간 직접 선택」 Popover Calendar(range).
 * 대시보드·「퀵 대화」 공용. 달력 draft는 Popover를 열 때 현재 값으로 되돌린다.
 */
export function QuickRangeFilter({
  value,
  onChange,
  size = 'default',
  testIdPrefix,
  labelPlacement = 'none',
  className
}: QuickRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() => toDraft(value));
  const twoMonths = useMatchMedia(TWO_MONTHS_MEDIA_QUERY);
  const isCustom = value.range === 'custom';
  const isSmall = size === 'sm';

  function handleOpenChange(next: boolean) {
    if (next) setDraft(toDraft(value));
    setOpen(next);
  }

  function handlePreset(next: string) {
    if (!next || !isQuickRangeKind(next) || next === 'custom') return;
    onChange({ range: next, from: null, to: null });
  }

  function handleClear() {
    onChange(QUICK_RANGE_DEFAULT_VALUE);
    setOpen(false);
  }

  function handleApply() {
    if (!draft?.from) return;
    const from = formatAbsoluteDateKo(draft.from);
    const to = formatAbsoluteDateKo(draft.to ?? draft.from);
    onChange({ range: 'custom', from, to });
    setOpen(false);
  }

  const customLabel = isCustom ? `${value.from} ~ ${value.to}` : QUICK_RANGE_FILTER_TEXT.custom;

  const trigger = (
    <Button
      type='button'
      variant='outline'
      size={isSmall ? 'icon' : 'default'}
      aria-haspopup='dialog'
      aria-expanded={open}
      aria-label={isSmall ? customLabel : undefined}
      data-testid={`${testIdPrefix}-range-custom`}
      data-state={isCustom ? 'on' : 'off'}
      className={cn(
        'shrink-0 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
        isSmall ? 'size-11 lg:size-8' : 'h-11 w-full tabular-nums lg:h-9 lg:w-auto'
      )}
    >
      <Icons.calendar aria-hidden className='size-4' />
      {isSmall ? null : customLabel}
    </Button>
  );

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <div
        className={cn(
          'flex min-w-0 gap-2',
          isSmall ? 'flex-row items-center' : 'flex-col lg:flex-row lg:items-center'
        )}
      >
        <ToggleGroup
          type='single'
          variant='outline'
          size={isSmall ? 'sm' : 'default'}
          aria-label={QUICK_RANGE_FILTER_TEXT.ariaLabel}
          value={isCustom ? '' : value.range}
          onValueChange={handlePreset}
          className={cn('min-w-0', isSmall ? 'flex-1' : 'w-full lg:w-auto')}
        >
          {PRESETS.map((preset) => (
            <ToggleGroupItem
              key={preset.value}
              value={preset.value}
              aria-label={preset.value === 'all' ? '전체 기간' : `최근 ${preset.label}`}
              data-testid={`${testIdPrefix}-range-${preset.value}`}
              className={cn(
                'tabular-nums',
                isSmall ? 'h-11 px-2 text-xs lg:h-8' : 'h-11 px-3 lg:h-9'
              )}
            >
              {preset.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Popover open={open} onOpenChange={handleOpenChange}>
          {isSmall ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>{trigger}</PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side='bottom'>{customLabel}</TooltipContent>
            </Tooltip>
          ) : (
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          )}
          <PopoverContent
            align='start'
            className='w-auto max-w-[calc(100vw-2rem)] p-0'
            data-testid={`${testIdPrefix}-range-popover`}
          >
            <p className='px-3 pt-3 text-xs text-muted-foreground'>{QUICK_RANGE_FILTER_TEXT.hint}</p>
            <Calendar
              mode='range'
              locale={ko}
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={twoMonths ? 2 : 1}
              disabled={{ after: startOfToday() }}
              autoFocus
              data-testid={`${testIdPrefix}-range-calendar`}
            />
            <div className='flex items-center justify-end gap-2 border-t p-2'>
              <Button
                type='button'
                variant='ghost'
                className='h-9'
                data-testid={`${testIdPrefix}-range-clear`}
                onClick={handleClear}
              >
                {QUICK_RANGE_FILTER_TEXT.clear}
              </Button>
              <Button
                type='button'
                className='h-9'
                disabled={!draft?.from}
                data-testid={`${testIdPrefix}-range-apply`}
                onClick={handleApply}
              >
                {QUICK_RANGE_FILTER_TEXT.apply}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {labelPlacement === 'below' ? (
        <p
          data-testid={`${testIdPrefix}-range-label`}
          aria-live='polite'
          className='mt-1 text-xs text-muted-foreground tabular-nums'
        >
          {quickRangeLabel(value)}
        </p>
      ) : null}
    </div>
  );
}
