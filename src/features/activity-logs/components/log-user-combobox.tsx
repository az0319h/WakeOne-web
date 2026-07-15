'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Icons } from '@/components/icons';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';
import { usersQueryOptions } from '@/features/users/api/queries';

const STATIC_OPTIONS = [
  { value: 'self', label: '본인' },
  { value: 'all', label: '전체' }
] as const;

interface LogUserComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

interface LogUserComboboxUserListProps {
  search: string;
  value: string;
  onSelect: (value: string, userLabel: string) => void;
}

function LogUserComboboxUserList({ search, value, onSelect }: LogUserComboboxUserListProps) {
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
          onSelect={() => onSelect(user.id, user.full_name)}
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

export function LogUserCombobox({ value, onValueChange }: LogUserComboboxProps) {
  const [open, setOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');

  const [selectedUserLabel, setSelectedUserLabel] = useState<string | null>(null);

  const debouncedSetUserSearch = useDebouncedCallback((next: string) => {
    setDebouncedUserSearch(next);
  }, 300);

  const selectedLabel = useMemo(() => {
    const staticOption = STATIC_OPTIONS.find((option) => option.value === value);
    if (staticOption) {
      return staticOption.label;
    }

    if (selectedUserLabel) {
      return selectedUserLabel;
    }

    if (value !== 'self' && value !== 'all') {
      return '선택한 사용자';
    }

    return '본인';
  }, [value, selectedUserLabel]);

  function handleSelect(nextValue: string, userLabel?: string) {
    if (nextValue === 'self' || nextValue === 'all') {
      setSelectedUserLabel(null);
    } else if (userLabel) {
      setSelectedUserLabel(userLabel);
    }

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
          data-testid='log-user-combobox'
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
              {STATIC_OPTIONS.map((option) => (
                <CommandItem key={option.value} value={option.label} onSelect={() => handleSelect(option.value)}>
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
            <Suspense fallback={<CommandEmpty>불러오는 중…</CommandEmpty>}>
              <LogUserComboboxUserList
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
