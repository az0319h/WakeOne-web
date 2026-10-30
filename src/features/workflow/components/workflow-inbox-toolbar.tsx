'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { workflowCountsQueryOptions } from '../api/queries';
import { WORKFLOW_TABS, type WorkflowScope, type WorkflowTab } from '../api/types';
import {
  hasActiveWorkflowFilters,
  toWorkflowCountFilters,
  type WorkflowListFilters
} from '../lib/search-params';
import {
  WorkflowSortMenu,
  WorkflowTemplateFilter,
  WorkflowUpdatedFilter,
  WorkflowWriterFilter
} from './workflow-inbox-filters';
import type { useWorkflowListParams } from './use-workflow-list-params';

const TAB_LABELS: Record<WorkflowTab, string> = {
  in_progress: '진행중',
  done: '완료',
  star: '중요',
  all: '전체'
};

const SEARCH_DEBOUNCE_MS = 500;

type SetParams = ReturnType<typeof useWorkflowListParams>['setParams'];

type WorkflowInboxToolbarProps = {
  filters: WorkflowListFilters;
  setParams: SetParams;
  isWorkflowAdmin: boolean;
};

/** 탭 · 검색 · 정렬 · 범위 · 필터 · 건수 · 초기화 — Suspense 밖 (plan 40) */
export function WorkflowInboxToolbar({ filters, setParams, isWorkflowAdmin }: WorkflowInboxToolbarProps) {
  const { data: counts } = useQuery(workflowCountsQueryOptions(toWorkflowCountFilters(filters)));
  const [searchInput, setSearchInput] = useState(filters.q ?? '');
  const [lastQ, setLastQ] = useState(filters.q);

  // URL q가 바깥(초기화·뒤로가기)에서 바뀌면 입력값을 맞춘다
  if (lastQ !== filters.q) {
    setLastQ(filters.q);
    if ((filters.q ?? '') !== searchInput.trim()) {
      setSearchInput(filters.q ?? '');
    }
  }

  const debouncedSetQ = useDebouncedCallback((value: string) => {
    void setParams({ q: value.trim() ? value.trim() : null });
  }, SEARCH_DEBOUNCE_MS);

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const hasFilters = hasActiveWorkflowFilters(filters);
  const currentTotal = counts ? counts[filters.tab] : null;
  // 휴대폰 「필터」 Sheet 안 조건(범위·작성자·양식·업데이트일) 중 기본값과 다른 개수
  const sheetFilterCount =
    (filters.scope !== 'related' ? 1 : 0) +
    (filters.writer.length ? 1 : 0) +
    (filters.template.length ? 1 : 0) +
    (filters.updated ? 1 : 0);

  function handleReset() {
    setSearchInput('');
    void setParams({
      q: null,
      writer: null,
      template: null,
      updated: null,
      sort: null,
      scope: null
    });
  }

  // 범위 토글·조건 필터 — md↑ 툴바 둘째 줄 / 휴대폰은 「필터」 하단 Sheet 안 (같은 요소, 한 번에 한 곳만 마운트)
  const scopeToggle = (
    <ToggleGroup
      type='single'
      variant='outline'
      size='sm'
      value={filters.scope}
      aria-label='문서 범위'
      onValueChange={(next) => {
        if (!next) return;
        void setParams({ scope: next === 'related' ? null : (next as WorkflowScope) });
      }}
    >
      <ToggleGroupItem value='related' data-testid='workflow-scope-related' className='h-11 px-3 md:h-8'>
        전체
      </ToggleGroupItem>
      <ToggleGroupItem
        value='mine'
        data-testid='workflow-scope-mine'
        className='h-11 px-3 whitespace-nowrap md:h-8'
      >
        내가 작성한
      </ToggleGroupItem>
      {isWorkflowAdmin ? (
        <ToggleGroupItem
          value='company'
          data-testid='workflow-scope-company'
          className='h-11 px-3 whitespace-nowrap md:h-8'
        >
          회사 전체
        </ToggleGroupItem>
      ) : null}
    </ToggleGroup>
  );

  const conditionFilters = (
    <>
      <WorkflowWriterFilter
        selected={filters.writer}
        onChange={(next) => void setParams({ writer: next.length ? next : null })}
      />
      <WorkflowTemplateFilter
        selected={filters.template}
        onChange={(next) => void setParams({ template: next.length ? next : null })}
      />
      <WorkflowUpdatedFilter
        value={filters.updated}
        onChange={(next) => void setParams({ updated: next })}
      />
    </>
  );

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <div className='flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <Tabs
          value={filters.tab}
          onValueChange={(next) => {
            if ((WORKFLOW_TABS as readonly string[]).includes(next)) {
              void setParams({ tab: next as WorkflowTab });
            }
          }}
          className='min-w-0'
        >
          <div className='-mx-1 overflow-x-auto px-1 pb-0.5'>
            <TabsList className='h-auto w-max md:h-10'>
              {WORKFLOW_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} className='h-11 px-3 md:h-9'>
                  {TAB_LABELS[tab]}
                  {counts ? (
                    <span aria-hidden className='text-xs text-muted-foreground tabular-nums'>
                      {counts[tab]}
                    </span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div className='flex min-w-0 items-center gap-2'>
          <InputGroup className='h-11 min-w-0 flex-1 md:h-9 md:w-64 md:flex-none'>
            <InputGroupAddon>
              <Icons.search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type='search'
              value={searchInput}
              placeholder='문서번호·내용 검색…'
              aria-label='문서 검색'
              data-testid='workflow-search-input'
              className='h-full'
              onChange={(event) => {
                setSearchInput(event.target.value);
                debouncedSetQ(event.target.value);
              }}
            />
          </InputGroup>
          <WorkflowSortMenu
            value={filters.sort}
            onChange={(next) => void setParams({ sort: next === 'updated_desc' ? null : next })}
          />
          <Button
            type='button'
            variant='outline'
            data-testid='workflow-filter-sheet-trigger'
            aria-label={sheetFilterCount ? `필터 ${sheetFilterCount}개 적용됨` : '필터'}
            className='h-11 shrink-0 gap-1.5 px-3 md:hidden'
            onClick={() => setFilterSheetOpen(true)}
          >
            <Icons.adjustments aria-hidden />
            필터
            {sheetFilterCount ? (
              <Badge aria-hidden className='h-5 min-w-5 rounded-full px-1 tabular-nums'>
                {sheetFilterCount}
              </Badge>
            ) : null}
          </Button>
        </div>
      </div>

      {/* md↑ 전용 둘째 줄 — 휴대폰 Sheet가 열려 있는 동안은 마운트하지 않아 testid가 겹치지 않는다 */}
      {filterSheetOpen ? null : (
        <div className='hidden min-w-0 gap-2 border-t pt-3 md:flex md:flex-row md:items-center md:justify-between'>
          <div className='flex min-w-0 flex-row items-center gap-2'>
            <div className='-mx-1 overflow-x-auto px-1'>{scopeToggle}</div>
            <div className='flex flex-wrap items-center gap-2'>{conditionFilters}</div>
          </div>
          <div className='flex items-center justify-end gap-2'>
            <p aria-live='polite' className='text-sm text-muted-foreground tabular-nums'>
              {currentTotal !== null ? `${currentTotal}건` : ''}
            </p>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              data-testid='workflow-reset'
              disabled={!hasFilters && !searchInput}
              onClick={handleReset}
              className='h-8'
            >
              초기화
            </Button>
          </div>
        </div>
      )}

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent
          side='bottom'
          data-testid='workflow-filter-sheet'
          className='flex max-h-[85dvh] min-h-0 flex-col gap-0 rounded-t-xl p-0'
        >
          <SheetHeader className='shrink-0 border-b px-4 py-4'>
            <SheetTitle>필터</SheetTitle>
            <SheetDescription className='sr-only'>
              범위·작성자·양식·업데이트일을 고르면 바로 목록에 반영돼요.
            </SheetDescription>
          </SheetHeader>
          <div className='min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4'>
            <FieldSet className='gap-0'>
              <FieldLegend variant='label'>범위</FieldLegend>
              <div className='-mx-1 overflow-x-auto px-1'>{scopeToggle}</div>
            </FieldSet>
            <FieldSet className='gap-0'>
              <FieldLegend variant='label'>조건</FieldLegend>
              <div className='flex flex-wrap items-center gap-2'>{conditionFilters}</div>
            </FieldSet>
          </div>
          <SheetFooter className='shrink-0 flex-row gap-2 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'>
            <Button
              type='button'
              variant='outline'
              data-testid='workflow-reset'
              disabled={!hasFilters && !searchInput}
              onClick={handleReset}
              className='h-11'
            >
              초기화
            </Button>
            <SheetClose asChild>
              <Button type='button' className='h-11 flex-1'>
                {currentTotal !== null ? `${currentTotal}건 보기` : '닫기'}
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
