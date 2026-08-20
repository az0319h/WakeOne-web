'use client';

import { Suspense, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { parseAsArrayOf, parseAsString, useQueryStates } from 'nuqs';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Separator } from '@/components/ui/separator';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useNavAccess } from '@/contexts/nav-access';
import { cn } from '@/lib/utils';
import { usersQueryOptions } from '@/features/users/api/queries';
import { useUserComboboxLabel } from '@/features/users/hooks/use-user-combobox-label';
import {
  buildSupportFilters,
  SUPPORT_STATUS_FILTER_OPTIONS
} from '../api/filter-utils';
import type { SupportFilters } from '../api/types';

const ARRAY_SEPARATOR = ',';
const DEBOUNCE_MS = 400;

const SUPPORT_USER_STATIC_OPTIONS = [{ value: 'all', label: '전체' }] as const;

interface SupportUserComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

function SupportUserComboboxList({
  search,
  value,
  onSelect
}: {
  search: string;
  value: string;
  onSelect: (value: string) => void;
}) {
  const { data } = useSuspenseQuery(
    usersQueryOptions({
      limit: 50,
      ...(search && { search })
    })
  );

  if (data.users.length === 0) {
    return <CommandEmpty>사용자를 찾을 수 없습니다.</CommandEmpty>;
  }

  return (
    <CommandGroup heading='사용자'>
      {data.users.map((user) => (
        <CommandItem
          key={user.id}
          value={`${user.full_name} ${user.email}`}
          onSelect={() => onSelect(user.id)}
        >
          <Icons.check
            className={cn('mr-2 size-4', value === user.id ? 'opacity-100' : 'opacity-0')}
          />
          <div className='flex flex-col'>
            <span className='text-sm'>{user.full_name}</span>
            <span className='text-muted-foreground text-xs'>{user.email}</span>
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function SupportUserCombobox({ value, onValueChange }: SupportUserComboboxProps) {
  const [open, setOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const selectedLabel = useUserComboboxLabel(value, SUPPORT_USER_STATIC_OPTIONS);

  const debouncedSetUserSearch = useDebouncedCallback((next: string) => {
    setDebouncedUserSearch(next);
  }, 300);

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
    setUserSearch('');
    setDebouncedUserSearch('');
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          role='combobox'
          aria-expanded={open}
          className='border-dashed'
          data-testid='support-user-combobox'
        >
          <Icons.user className='size-4' />
          <span>사용자</span>
          <Separator orientation='vertical' className='mx-0.5 data-[orientation=vertical]:h-4' />
          <span>{selectedLabel}</span>
          <Icons.chevronsUpDown className='ml-1 size-4 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[280px] p-0' align='start'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='이름·이메일 검색…'
            value={userSearch}
            onValueChange={(next) => {
              setUserSearch(next);
              debouncedSetUserSearch(next);
            }}
          />
          <CommandList>
            <CommandGroup>
              {SUPPORT_USER_STATIC_OPTIONS.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Icons.check
                    className={cn(
                      'mr-2 size-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
              <SupportUserComboboxList
                search={debouncedUserSearch}
                value={value}
                onSelect={handleSelect}
              />
            </Suspense>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function useSupportListFilterParams() {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';

  const [params, setParams] = useQueryStates(
    {
      search: parseAsString,
      support_status: parseAsArrayOf(parseAsString, ARRAY_SEPARATOR),
      support_user: parseAsString
    },
    { shallow: true, throttleMs: 50 }
  );

  const filters = buildSupportFilters({
    search: params.search,
    status: params.support_status ?? [],
    submitted_by:
      isAdmin && params.support_user && params.support_user !== 'all'
        ? params.support_user
        : undefined
  });

  return { params, setParams, filters, isAdmin };
}

export function SupportListFilters() {
  const { params, setParams, isAdmin } = useSupportListFilterParams();
  const [searchInput, setSearchInput] = useState(params.search ?? '');
  const [statusOpen, setStatusOpen] = useState(false);

  const debouncedSetSearch = useDebouncedCallback((value: string) => {
    void setParams({ search: value.trim() ? value : null });
  }, DEBOUNCE_MS);

  const selectedStatuses = new Set(params.support_status ?? []);

  const hasFilters = Boolean(
    params.search?.trim() ||
      (params.support_status?.length ?? 0) > 0 ||
      (isAdmin && params.support_user && params.support_user !== 'all')
  );

  function toggleStatus(value: string) {
    const current = new Set(params.support_status ?? []);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    const next = [...current];
    void setParams({ support_status: next.length > 0 ? next : null });
  }

  function resetFilters() {
    setSearchInput('');
    void setParams({ search: null, support_status: null, support_user: null });
  }

  return (
    <div className='flex flex-1 flex-wrap items-center gap-2' data-testid='support-list-filters'>
      <Input
        placeholder='제목·본문 검색…'
        value={searchInput}
        onChange={(event) => {
          const value = event.target.value;
          setSearchInput(value);
          debouncedSetSearch(value);
        }}
        className='h-8 w-full min-w-48 sm:w-56'
        data-testid='support-search-input'
      />

      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='border-dashed'
            data-testid='support-status-filter'
          >
            {selectedStatuses.size > 0 ? (
              <Icons.xCircle className='h-4 w-4' />
            ) : (
              <Icons.plusCircle className='h-4 w-4' />
            )}
            상태
            {selectedStatuses.size > 0 ? (
              <>
                <Separator
                  orientation='vertical'
                  className='mx-0.5 data-[orientation=vertical]:h-4'
                />
                <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
                  {selectedStatuses.size}
                </Badge>
              </>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-50 p-0' align='start'>
          <Command>
            <CommandList>
              <CommandEmpty>결과 없음</CommandEmpty>
              <CommandGroup>
                {SUPPORT_STATUS_FILTER_OPTIONS.map((option) => {
                  const isSelected = selectedStatuses.has(option.value);
                  return (
                    <CommandItem key={option.value} onSelect={() => toggleStatus(option.value)}>
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
              {selectedStatuses.size > 0 ? (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => void setParams({ support_status: null })}
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

      {isAdmin ? (
        <SupportUserCombobox
          value={params.support_user ?? 'all'}
          onValueChange={(value) =>
            void setParams({ support_user: value === 'all' ? null : value })
          }
        />
      ) : null}

      {hasFilters ? (
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='border-dashed'
          onClick={resetFilters}
          data-testid='support-filter-reset'
        >
          <Cross2Icon />
          초기화
        </Button>
      ) : null}
    </div>
  );
}

export function getSupportListFiltersFromParams(params: {
  search?: string | null;
  support_status?: string[] | null;
  support_user?: string | null;
  isAdmin?: boolean;
}): SupportFilters {
  return buildSupportFilters({
    search: params.search,
    status: params.support_status ?? [],
    submitted_by:
      params.isAdmin && params.support_user && params.support_user !== 'all'
        ? params.support_user
        : undefined
  });
}
