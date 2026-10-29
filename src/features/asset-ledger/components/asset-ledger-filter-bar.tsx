'use client';

import { useState } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { ASSET_SCOPES, type AssetScope } from '../api/types';
import {
  AssetLedgerStatusChecklist,
  AssetLedgerStatusFilter,
  type LedgerStatusOption
} from './asset-ledger-status-filter';

const SEARCH_DEBOUNCE_MS = 500;

type AssetSearchInputProps = {
  value: string | null;
  placeholder: string;
  onChange: (next: string | null) => void;
};

/** 검색 — 500ms debounce → URL `q` (plan 73) · URL에서 지워지면(초기화) 입력도 비운다 */
function AssetSearchInput({ value, placeholder, onChange }: AssetSearchInputProps) {
  const [text, setText] = useState(value ?? '');
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (!value && text.trim()) setText('');
  }
  const debounced = useDebouncedCallback((next: string) => onChange(next.trim() ? next : null), SEARCH_DEBOUNCE_MS);

  return (
    <InputGroup className='order-last h-11 w-full md:order-none md:h-9 md:w-64'>
      <InputGroupAddon>
        <Icons.search aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type='search'
        data-testid='asset-search-input'
        aria-label={placeholder}
        placeholder={placeholder}
        autoComplete='off'
        spellCheck={false}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          debounced(event.target.value);
        }}
      />
    </InputGroup>
  );
}

const SCOPE_LABELS: Record<'subscription' | 'equipment', Record<AssetScope, string>> = {
  subscription: { all: '전체', mine: '내 구독', team: '내 팀 구독' },
  equipment: { all: '전체', mine: '내 장비', team: '내 팀 장비' }
};

type AssetLedgerFilterBarProps = {
  targetType: 'subscription' | 'equipment';
  searchPlaceholder: string;
  query: string | null;
  onQueryChange: (next: string | null) => void;
  scope: AssetScope;
  onScopeChange: (next: AssetScope) => void;
  statusOptions: LedgerStatusOption[];
  statuses: string[];
  statusIsCustom: boolean;
  onStatusesChange: (next: string[]) => void;
  onStatusReset: () => void;
  hasActiveFilters: boolean;
  onReset: () => void;
  /** 권한자 전용 데스크톱 필터(결제 카드) — 직원이면 넘기지 않는다(렌더 자체 안 함) */
  managerFilter?: React.ReactNode;
  /** 휴대폰 필터 Sheet 안 권한자 필터 */
  managerFilterMobile?: React.ReactNode;
  /** 휴대폰 「필터」 버튼 점 — Sheet 안 값(상태·카드)이 기본과 다름 */
  sheetFiltersActive: boolean;
};

/**
 * 필터 줄 (designer §2-3) — Suspense **밖**(plan 40).
 * 휴대폰: 범위 칩 + 「필터」 아이콘(하단 Sheet) · 검색은 다음 줄 전체. md↑: 한 줄(넘치면 wrap).
 */
export function AssetLedgerFilterBar({
  targetType,
  searchPlaceholder,
  query,
  onQueryChange,
  scope,
  onScopeChange,
  statusOptions,
  statuses,
  statusIsCustom,
  onStatusesChange,
  onStatusReset,
  hasActiveFilters,
  onReset,
  managerFilter,
  managerFilterMobile,
  sheetFiltersActive
}: AssetLedgerFilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const scopeLabels = SCOPE_LABELS[targetType];

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-2'>
      <AssetSearchInput value={query} placeholder={searchPlaceholder} onChange={onQueryChange} />
      <ToggleGroup
        type='single'
        variant='outline'
        aria-label='보기 범위'
        data-testid='asset-scope-filter'
        value={scope}
        onValueChange={(next) => {
          if (!next || !(ASSET_SCOPES as readonly string[]).includes(next)) return;
          onScopeChange(next as AssetScope);
        }}
      >
        {ASSET_SCOPES.map((value) => (
          <ToggleGroupItem
            key={value}
            value={value}
            data-testid={`asset-scope-${value}`}
            className='h-11 px-3 md:h-9'
          >
            {scopeLabels[value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className='hidden items-center gap-2 md:flex'>
        <AssetLedgerStatusFilter
          options={statusOptions}
          value={statuses}
          isCustom={statusIsCustom}
          onChange={onStatusesChange}
          onReset={onStatusReset}
        />
        {managerFilter}
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-9'
          data-testid='asset-filter-reset'
          disabled={!hasActiveFilters}
          onClick={onReset}
        >
          초기화
        </Button>
      </div>
      <Button
        type='button'
        variant='outline'
        size='icon'
        aria-label='필터'
        data-testid='asset-filter-sheet-trigger'
        className='relative ml-auto size-11 md:hidden'
        onClick={() => setSheetOpen(true)}
      >
        <Icons.adjustments aria-hidden />
        {sheetFiltersActive ? (
          <span aria-hidden className='absolute top-2 right-2 size-2 rounded-full bg-primary' />
        ) : null}
      </Button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side='bottom'
          data-testid='asset-filter-sheet'
          className='flex max-h-[85dvh] min-h-0 flex-col gap-0 rounded-t-xl p-0'
        >
          <SheetHeader className='shrink-0 border-b px-4 py-4'>
            <SheetTitle>필터</SheetTitle>
            <SheetDescription className='sr-only'>
              상태와 결제 카드를 고르면 바로 목록에 반영돼요.
            </SheetDescription>
          </SheetHeader>
          <div className='min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4'>
            <AssetLedgerStatusChecklist
              options={statusOptions}
              value={statuses}
              onChange={onStatusesChange}
            />
            {managerFilterMobile}
          </div>
          <SheetFooter className='shrink-0 flex-row justify-end gap-2 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'>
            <Button
              type='button'
              variant='outline'
              className='h-11'
              data-testid='asset-filter-reset-mobile'
              disabled={!hasActiveFilters}
              onClick={onReset}
            >
              초기화
            </Button>
            <Button type='button' className='h-11' onClick={() => setSheetOpen(false)}>
              닫기
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
