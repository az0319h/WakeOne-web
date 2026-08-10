'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { parseAsArrayOf, parseAsString, useQueryStates } from 'nuqs';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';
import {
  ANNOUNCEMENT_PRIORITY_FILTER_OPTIONS,
  buildAnnouncementsFilters
} from '../api/filter-utils';
import type { AnnouncementsFilters } from '../api/types';

const ARRAY_SEPARATOR = ',';
const DEBOUNCE_MS = 400;

export function useAnnouncementListFilterParams() {
  const [params, setParams] = useQueryStates(
    {
      search: parseAsString,
      priority: parseAsArrayOf(parseAsString, ARRAY_SEPARATOR),
      pinned: parseAsString
    },
    { shallow: true, throttleMs: 50 }
  );

  const filters = useMemo(
    () =>
      buildAnnouncementsFilters({
        search: params.search,
        priority: params.priority ?? [],
        pinned: params.pinned
      }),
    [params.search, params.priority, params.pinned]
  );

  return { params, setParams, filters };
}

export function AnnouncementsListFilters() {
  const { params, setParams } = useAnnouncementListFilterParams();
  const [searchInput, setSearchInput] = useState(params.search ?? '');
  const [priorityOpen, setPriorityOpen] = useState(false);

  useEffect(() => {
    setSearchInput(params.search ?? '');
  }, [params.search]);

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    void setParams({ search: value.trim() ? value : null });
  }, DEBOUNCE_MS);

  const selectedPriorities = useMemo(
    () => new Set(params.priority ?? []),
    [params.priority]
  );

  const hasFilters = Boolean(
    params.search?.trim() ||
      (params.priority?.length ?? 0) > 0 ||
      params.pinned === '1'
  );

  function togglePriority(value: string) {
    const current = new Set(params.priority ?? []);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    const next = [...current];
    void setParams({ priority: next.length > 0 ? next : null });
  }

  function resetFilters() {
    setSearchInput('');
    void setParams({ search: null, priority: null, pinned: null });
  }

  return (
    <div
      className='flex flex-1 flex-wrap items-center gap-2'
      data-testid='announcements-list-filters'
    >
      <Input
        placeholder='제목·본문 검색…'
        value={searchInput}
        onChange={(event) => {
          const value = event.target.value;
          setSearchInput(value);
          debouncedSetSearch(value);
        }}
        className='h-8 w-full min-w-48 sm:w-56'
        data-testid='announcements-search-input'
      />

      <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='border-dashed'
            data-testid='announcements-priority-filter'
          >
            {selectedPriorities.size > 0 ? (
              <Icons.xCircle className='h-4 w-4' />
            ) : (
              <Icons.plusCircle className='h-4 w-4' />
            )}
            중요도
            {selectedPriorities.size > 0 ? (
              <>
                <Separator
                  orientation='vertical'
                  className='mx-0.5 data-[orientation=vertical]:h-4'
                />
                <Badge variant='secondary' className='rounded-sm px-1 font-normal lg:hidden'>
                  {selectedPriorities.size}
                </Badge>
                <div className='hidden items-center gap-1 lg:flex'>
                  {selectedPriorities.size > 2 ? (
                    <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
                      {selectedPriorities.size}개
                    </Badge>
                  ) : (
                    ANNOUNCEMENT_PRIORITY_FILTER_OPTIONS.filter((option) =>
                      selectedPriorities.has(option.value)
                    ).map((option) => (
                      <Badge
                        variant='secondary'
                        key={option.value}
                        className='rounded-sm px-1 font-normal'
                      >
                        {option.label}
                      </Badge>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-50 p-0' align='start'>
          <Command>
            <CommandList>
              <CommandEmpty>결과 없음</CommandEmpty>
              <CommandGroup>
                {ANNOUNCEMENT_PRIORITY_FILTER_OPTIONS.map((option) => {
                  const isSelected = selectedPriorities.has(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => togglePriority(option.value)}
                    >
                      <div
                        className={cn(
                          'border-primary flex size-4 items-center justify-center rounded-sm border',
                          isSelected ? 'bg-primary' : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <CheckIcon />
                      </div>
                      <span>{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {selectedPriorities.size > 0 ? (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => void setParams({ priority: null })}
                      className='justify-center text-center'
                    >
                      필터 초기화
                    </CommandItem>
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        type='button'
        variant={params.pinned === '1' ? 'secondary' : 'outline'}
        size='sm'
        className={cn(params.pinned !== '1' && 'border-dashed')}
        onClick={() => void setParams({ pinned: params.pinned === '1' ? null : '1' })}
        data-testid='announcements-pinned-filter'
      >
        {params.pinned === '1' ? (
          <Icons.xCircle className='h-4 w-4' />
        ) : (
          <Icons.plusCircle className='h-4 w-4' />
        )}
        고정만
      </Button>

      {hasFilters ? (
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='border-dashed'
          onClick={resetFilters}
          data-testid='announcements-filter-reset'
        >
          <Cross2Icon />
          초기화
        </Button>
      ) : null}
    </div>
  );
}

export function getAnnouncementListFiltersFromParams(params: {
  search?: string | null;
  priority?: string[] | null;
  pinned?: string | null;
}): AnnouncementsFilters {
  return buildAnnouncementsFilters({
    search: params.search,
    priority: params.priority ?? [],
    pinned: params.pinned
  });
}
