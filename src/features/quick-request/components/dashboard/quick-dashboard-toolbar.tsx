'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { quickRequestListQueryOptions } from '../../api/queries';
import type { QuickRequestStatus } from '../../api/types';
import type { QuickRangeValue } from '../../lib/quick-range-search-params';
import { QUICK_REQUEST_STATUS_LABELS } from '../../lib/quick-request-status';
import { isQuickRequestStatus, QUICK_REQUEST_STATUSES } from '../../schemas/quick-request-workflow';
import { QuickRangeFilter } from './quick-range-filter';
import {
  hasActiveQuickDashboardFilters,
  toQuickDashboardRangeValue,
  toQuickRequestListFilters,
  type QuickDashboardFilters
} from './use-quick-dashboard-params';

const SEARCH_DEBOUNCE_MS = 400;
const ALL_STATUS_VALUE = 'all';

type QuickDashboardToolbarProps = {
  filters: QuickDashboardFilters;
  onRangeChange: (next: QuickRangeValue) => void;
  onSearchChange: (search: string | null) => void;
  onStatusChange: (status: QuickRequestStatus | null) => void;
  onReset: () => void;
};

/**
 * 1행 기간(ToggleGroup + 달력 · plan 97 U-1) / 2행 검색 · 상태 Select · 초기화 · 「총 N건」 — Suspense 밖 (plan 40).
 * 「초기화」는 상태·검색만 되돌리고 기간은 유지한다 (designer K3).
 */
export function QuickDashboardToolbar({
  filters,
  onRangeChange,
  onSearchChange,
  onStatusChange,
  onReset
}: QuickDashboardToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const [lastSearch, setLastSearch] = useState(filters.search);
  // 목록 캐시 구독만 (조회는 본문 useSuspenseQuery가 한다) — 결과가 있을 때만 「총 N건」
  const { data: list } = useQuery({
    ...quickRequestListQueryOptions(toQuickRequestListFilters(filters)),
    enabled: false
  });

  // URL search가 바깥(초기화·카드·뒤로가기)에서 바뀌면 입력값을 맞춘다
  if (lastSearch !== filters.search) {
    setLastSearch(filters.search);
    if ((filters.search ?? '') !== searchInput.trim()) {
      setSearchInput(filters.search ?? '');
    }
  }

  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearchChange(value.trim() ? value.trim() : null);
  }, SEARCH_DEBOUNCE_MS);

  const hasFilters = hasActiveQuickDashboardFilters(filters) || searchInput.trim() !== '';

  function handleReset() {
    setSearchInput('');
    onReset();
  }

  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <QuickRangeFilter
        value={toQuickDashboardRangeValue(filters)}
        onChange={onRangeChange}
        size='default'
        testIdPrefix='quick-dashboard'
        labelPlacement='none'
      />
      <div className='flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center'>
        <InputGroup className='h-11 min-w-0 lg:h-9 lg:w-72'>
          <InputGroupAddon>
            <Icons.search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type='search'
            value={searchInput}
            placeholder='요청번호·요청자·주소 검색…'
            aria-label='퀵 요청 검색'
            autoComplete='off'
            data-testid='quick-dashboard-search'
            onChange={(event) => {
              setSearchInput(event.target.value);
              debouncedSearch(event.target.value);
            }}
          />
        </InputGroup>
        <div className='flex min-w-0 items-center gap-2'>
          <Select
            value={filters.status ?? ALL_STATUS_VALUE}
            onValueChange={(next) => onStatusChange(isQuickRequestStatus(next) ? next : null)}
          >
            <SelectTrigger
              aria-label='진행 상태'
              data-testid='quick-dashboard-status-filter'
              className='w-40 data-[size=default]:h-11 lg:data-[size=default]:h-9'
            >
              <SelectValue placeholder='전체 상태' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS_VALUE}>전체 상태</SelectItem>
              {QUICK_REQUEST_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {QUICK_REQUEST_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type='button'
            variant='ghost'
            className='h-11 lg:h-9'
            data-testid='quick-dashboard-reset'
            disabled={!hasFilters}
            onClick={handleReset}
          >
            초기화
          </Button>
          <p
            aria-live='polite'
            data-testid='quick-dashboard-total'
            className='ml-auto text-sm whitespace-nowrap text-muted-foreground tabular-nums'
          >
            {list ? `총 ${list.total}건` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
