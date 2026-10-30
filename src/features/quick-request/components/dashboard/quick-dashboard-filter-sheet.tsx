'use client';

import { useId, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { quickRequestSummaryQueryOptions } from '../../api/queries';
import type { QuickRequestStatus } from '../../api/types';
import type { QuickRangeValue } from '../../lib/quick-range-search-params';
import {
  QUICK_REQUEST_STATUS_DOT_CLASS,
  QUICK_REQUEST_STATUS_LABELS
} from '../../lib/quick-request-status';
import { isQuickRequestStatus, QUICK_REQUEST_STATUSES } from '../../schemas/quick-request-workflow';
import { QuickRangeSheetField } from './quick-range-sheet-field';
import {
  countQuickDashboardSheetFilters,
  toQuickDashboardRangeFilters,
  toQuickDashboardRangeValue,
  type QuickDashboardFilters
} from './use-quick-dashboard-params';

const ALL_STATUS_VALUE = 'all';

export const QUICK_DASHBOARD_FILTER_TEXT = {
  button: '필터',
  title: '필터',
  description: '기간과 진행 상태를 고르면 바로 적용됩니다.',
  statusLegend: '상태',
  statusAll: '전체',
  reset: '초기화',
  close: '닫기'
} as const;

function filterButtonLabel(count: number): string {
  return count > 0
    ? `${QUICK_DASHBOARD_FILTER_TEXT.button} · 켜진 필터 ${count}개`
    : QUICK_DASHBOARD_FILTER_TEXT.button;
}

type QuickDashboardFilterSheetProps = {
  filters: QuickDashboardFilters;
  onRangeChange: (next: QuickRangeValue) => void;
  onStatusChange: (status: QuickRequestStatus | null) => void;
  /** 상태·검색만 지움 · 기간 유지 (89 designer K3 · AC-15) */
  onReset: () => void;
  /** 「초기화」가 지울 것(상태·검색)이 있을 때만 활성 */
  canReset: boolean;
  className?: string;
};

/**
 * plan 106 D-7 · U-4 · designer §3.7 — lg 미만 「필터」 버튼 + 아래에서 올라오는 판(vaul Drawer · K6).
 * 판: 「기간」(`QuickRangeSheetField` · 달력은 판 안에서 펼침) + 「상태」(전체 + 5종 · 각 44px) · 아래 고정 [초기화][닫기].
 * 선택은 바로 URL에 반영(달력만 「적용」) — 판 뒤의 칩·메타바·목록이 함께 바뀐다(필터 셸은 Suspense 밖 · plan 40).
 * 숫자는 상태 칩과 같은 summary 캐시(같은 키 · 추가 조회 없음).
 */
export function QuickDashboardFilterSheet({
  filters,
  onRangeChange,
  onStatusChange,
  onReset,
  canReset,
  className
}: QuickDashboardFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const activeCount = countQuickDashboardSheetFilters(filters);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type='button'
          variant='outline'
          aria-haspopup='dialog'
          aria-label={filterButtonLabel(activeCount)}
          data-testid='quick-dashboard-filter-button'
          className={cn('h-11 shrink-0 touch-manipulation gap-1.5 px-3', className)}
        >
          <Icons.adjustments aria-hidden />
          {QUICK_DASHBOARD_FILTER_TEXT.button}
          {activeCount > 0 ? (
            <Badge
              data-testid='quick-dashboard-filter-count'
              className='h-5 min-w-5 rounded-full px-1.5 tabular-nums'
            >
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </DrawerTrigger>
      <DrawerContent
        data-testid='quick-dashboard-filter-sheet'
        className='data-[vaul-drawer-direction=bottom]:max-h-[85dvh]'
        onOpenAutoFocus={(event) => {
          // 첫 컨트롤 자동 포커스 금지(휴대폰에서 원치 않는 스크롤) — 판 제목으로 (designer §3.7)
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DrawerHeader className='pb-2'>
          <DrawerTitle ref={titleRef} tabIndex={-1} className='text-base outline-none'>
            {QUICK_DASHBOARD_FILTER_TEXT.title}
          </DrawerTitle>
          <DrawerDescription className='sr-only'>{QUICK_DASHBOARD_FILTER_TEXT.description}</DrawerDescription>
        </DrawerHeader>
        <div className='flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 pb-4'>
          <QuickRangeSheetField
            value={toQuickDashboardRangeValue(filters)}
            onChange={onRangeChange}
            testIdPrefix='quick-dashboard-filter'
          />
          <QuickDashboardStatusField filters={filters} onStatusChange={onStatusChange} />
        </div>
        <DrawerFooter className='grid grid-cols-2 gap-2 border-t pb-[max(1rem,env(safe-area-inset-bottom))]'>
          <Button
            type='button'
            variant='outline'
            className='h-11 touch-manipulation'
            data-testid='quick-dashboard-filter-reset'
            disabled={!canReset}
            onClick={onReset}
          >
            {QUICK_DASHBOARD_FILTER_TEXT.reset}
          </Button>
          <DrawerClose asChild>
            <Button type='button' className='h-11 touch-manipulation' data-testid='quick-dashboard-filter-close'>
              {QUICK_DASHBOARD_FILTER_TEXT.close}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

type QuickDashboardStatusFieldProps = {
  filters: QuickDashboardFilters;
  onStatusChange: (status: QuickRequestStatus | null) => void;
};

/** 판 「상태」 — 전체 + 5종 · 행 전체(label)가 누르는 영역(44px) · 오른쪽 숫자 = 선택 기간 summary */
function QuickDashboardStatusField({ filters, onStatusChange }: QuickDashboardStatusFieldProps) {
  const legendId = useId();
  const itemIdPrefix = useId();
  const { data: summary } = useQuery({
    ...quickRequestSummaryQueryOptions(toQuickDashboardRangeFilters(filters)),
    placeholderData: keepPreviousData
  });
  const counts = summary?.counts;
  const options: ReadonlyArray<{ value: string; label: string; status: QuickRequestStatus | null }> = [
    { value: ALL_STATUS_VALUE, label: QUICK_DASHBOARD_FILTER_TEXT.statusAll, status: null },
    ...QUICK_REQUEST_STATUSES.map((status) => ({
      value: status,
      label: QUICK_REQUEST_STATUS_LABELS[status],
      status
    }))
  ];

  return (
    <fieldset className='flex min-w-0 flex-col gap-2'>
      <legend id={legendId} className='mb-2 text-sm font-medium'>
        {QUICK_DASHBOARD_FILTER_TEXT.statusLegend}
      </legend>
      <RadioGroup
        aria-labelledby={legendId}
        value={filters.status ?? ALL_STATUS_VALUE}
        onValueChange={(next) => onStatusChange(isQuickRequestStatus(next) ? next : null)}
        className='gap-1'
      >
        {options.map((option) => {
          const id = `${itemIdPrefix}-${option.value}`;
          const isSelected = (filters.status ?? ALL_STATUS_VALUE) === option.value;
          return (
            <label
              key={option.value}
              htmlFor={id}
              data-testid={`quick-dashboard-filter-status-${option.value}`}
              data-state={isSelected ? 'checked' : 'unchecked'}
              className={cn(
                'flex min-h-11 cursor-pointer touch-manipulation items-center gap-3 rounded-md border border-transparent px-3 text-sm transition-colors hover:bg-accent',
                'has-[button:focus-visible]:ring-[3px] has-[button:focus-visible]:ring-ring/50',
                isSelected && 'border-primary bg-primary/5'
              )}
            >
              <RadioGroupItem id={id} value={option.value} />
              {option.status ? (
                <span
                  aria-hidden
                  className={cn('size-2 shrink-0 rounded-full', QUICK_REQUEST_STATUS_DOT_CLASS[option.status])}
                />
              ) : null}
              <span className='min-w-0 flex-1 break-keep'>{option.label}</span>
              {option.status ? (
                <span className='text-muted-foreground tabular-nums'>
                  {counts?.[option.status] ?? '—'}
                </span>
              ) : null}
            </label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
