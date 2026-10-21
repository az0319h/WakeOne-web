'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
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

  const hasFilters = hasActiveWorkflowFilters(filters);
  const currentTotal = counts ? counts[filters.tab] : null;

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
            <TabsList className='h-10 w-max'>
              {WORKFLOW_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab} className='h-9 px-3'>
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
          <InputGroup className='h-10 min-w-0 flex-1 md:h-9 md:w-64 md:flex-none'>
            <InputGroupAddon>
              <Icons.search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type='search'
              value={searchInput}
              placeholder='문서번호·내용 검색…'
              aria-label='문서 검색'
              data-testid='workflow-search-input'
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
        </div>
      </div>

      <div className='flex min-w-0 flex-col gap-2 border-t pt-3 md:flex-row md:items-center md:justify-between'>
        <div className='flex min-w-0 flex-col gap-2 md:flex-row md:items-center'>
          <div className='-mx-1 overflow-x-auto px-1'>
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
              <ToggleGroupItem value='related' data-testid='workflow-scope-related' className='h-9 px-3 md:h-8'>
                전체
              </ToggleGroupItem>
              <ToggleGroupItem value='mine' data-testid='workflow-scope-mine' className='h-9 px-3 whitespace-nowrap md:h-8'>
                내가 작성한
              </ToggleGroupItem>
              {isWorkflowAdmin ? (
                <ToggleGroupItem
                  value='company'
                  data-testid='workflow-scope-company'
                  className='h-9 px-3 whitespace-nowrap md:h-8'
                >
                  회사 전체
                </ToggleGroupItem>
              ) : null}
            </ToggleGroup>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
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
          </div>
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
            className='h-9 md:h-8'
          >
            초기화
          </Button>
        </div>
      </div>
    </div>
  );
}
