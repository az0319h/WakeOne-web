'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { LOGIN_DOMAIN_PRESETS } from '@/features/auth/constants/login-domain-options';
import { cn } from '@/lib/utils';

interface LoginDomainComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  isTouched: boolean;
  isValid: boolean;
  disabled?: boolean;
}

function sanitizeDomainInput(input: string): string {
  return input.trim().replace(/@/g, '').replace(/\s/g, '');
}

export function LoginDomainCombobox({
  value,
  onChange,
  onBlur,
  isTouched,
  isValid,
  disabled
}: LoginDomainComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const normalizedSearch = useMemo(() => sanitizeDomainInput(search), [search]);

  const showCustomDomainOption =
    normalizedSearch.length > 0 && !LOGIN_DOMAIN_PRESETS.includes(normalizedSearch as (typeof LOGIN_DOMAIN_PRESETS)[number]);

  function handleSelect(nextDomain: string) {
    const sanitized = sanitizeDomainInput(nextDomain);
    if (!sanitized) {
      return;
    }

    onChange(sanitized);
    setOpen(false);
    setSearch('');
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
      onBlur();
    }
  }

  return (
    <div className='w-full min-w-0'>
      <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          aria-label='이메일 도메인'
          disabled={disabled}
          className='h-9 w-full min-w-0 justify-between font-normal'
          data-testid='login-domain-combobox'
          aria-invalid={isTouched && !isValid}
          onBlur={onBlur}
        >
          <span className='min-w-0 truncate'>{value}</span>
          <Icons.chevronsUpDown className='ml-2 size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-[var(--radix-popover-trigger-width)] p-0'>
        <Command shouldFilter={true}>
          <CommandInput
            placeholder='도메인 검색 또는 입력…'
            value={search}
            onValueChange={(next) => setSearch(sanitizeDomainInput(next))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && normalizedSearch) {
                event.preventDefault();
                handleSelect(normalizedSearch);
              }
            }}
          />
          <CommandList>
            <CommandGroup heading='자주 쓰는 도메인'>
              {LOGIN_DOMAIN_PRESETS.map((preset) => (
                <CommandItem key={preset} value={preset} onSelect={() => handleSelect(preset)}>
                  <Icons.check
                    className={cn('mr-2 size-4', value === preset ? 'opacity-100' : 'opacity-0')}
                  />
                  {preset}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCustomDomainOption ? (
              <CommandGroup>
                <CommandItem
                  value={normalizedSearch}
                  onSelect={() => handleSelect(normalizedSearch)}
                >
                  「{normalizedSearch}」 사용
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
      </Popover>
    </div>
  );
}
