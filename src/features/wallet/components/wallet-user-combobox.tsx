'use client';

import { Suspense, useState } from 'react';
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
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Separator } from '@/components/ui/separator';
import { Icons } from '@/components/icons';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';
import { usersQueryOptions } from '@/features/users/api/queries';
import { useUserComboboxLabel } from '@/features/users/hooks/use-user-combobox-label';

const WALLET_STATIC_OPTIONS = [{ value: 'self', label: '본인' }] as const;

interface WalletUserComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
}

interface WalletUserComboboxListProps {
  search: string;
  value: string;
  onSelect: (value: string) => void;
}

function WalletUserComboboxList({ search, value, onSelect }: WalletUserComboboxListProps) {
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

export function WalletUserCombobox({ value, onValueChange }: WalletUserComboboxProps) {
  const [open, setOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const selectedLabel = useUserComboboxLabel(value, WALLET_STATIC_OPTIONS);

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
          data-testid='wallet-user-combobox'
        >
          <Icons.user className='size-4' />
          <span>사용자</span>
          <Separator orientation='vertical' className='mx-0.5 data-[orientation=vertical]:h-4' />
          <span>{selectedLabel}</span>
          <Icons.chevronsUpDown className='ml-1 size-4 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[280px] p-0' align='end'>
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
              <CommandItem value='본인' onSelect={() => handleSelect('self')}>
                <Icons.check
                  className={cn('mr-2 size-4', value === 'self' ? 'opacity-100' : 'opacity-0')}
                />
                본인
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
              <WalletUserComboboxList
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
