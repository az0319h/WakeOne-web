'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

interface AssetItemCategoryFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  suggestions: string[];
  placeholder?: string;
}

export function AssetItemCategoryField({
  id,
  value,
  onChange,
  onBlur,
  suggestions,
  placeholder = '카테고리를 선택하거나 입력해 주세요.'
}: AssetItemCategoryFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const trimmedQuery = query.trim();
  const normalizedValue = value.trim();
  const filteredSuggestions = suggestions.filter((item) =>
    item.toLowerCase().includes(trimmedQuery.toLowerCase())
  );
  const canCreate =
    trimmedQuery.length > 0 &&
    !suggestions.some((item) => item.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between font-normal'
          onBlur={onBlur}
        >
          {normalizedValue.length > 0 ? normalizedValue : placeholder}
          <Icons.chevronDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[360px] p-0' align='start'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='카테고리 검색 또는 입력'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>일치하는 카테고리가 없습니다.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange('');
                  setQuery('');
                  setOpen(false);
                }}
              >
                <Icons.check
                  className={cn('mr-2 h-4 w-4', normalizedValue ? 'opacity-0' : 'opacity-100')}
                />
                미지정
              </CommandItem>
              {filteredSuggestions.map((item) => (
                <CommandItem
                  key={item}
                  value={item}
                  onSelect={() => {
                    onChange(item);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <Icons.check
                    className={cn(
                      'mr-2 h-4 w-4',
                      normalizedValue === item ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {item}
                </CommandItem>
              ))}
              {canCreate ? (
                <CommandItem
                  value={trimmedQuery}
                  onSelect={() => {
                    onChange(trimmedQuery);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <Icons.add className='mr-2 h-4 w-4 opacity-70' />
                  새 카테고리 추가: {trimmedQuery}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
