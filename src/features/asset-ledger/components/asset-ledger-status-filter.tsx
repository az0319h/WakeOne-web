'use client';

import { useState } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export type LedgerStatusOption = { value: string; label: string };

type AssetLedgerStatusFilterProps = {
  options: LedgerStatusOption[];
  /** 지금 체크된 상태 */
  value: string[];
  /** 기본 묶음과 다르면 true (아이콘·리셋 활성) */
  isCustom: boolean;
  onChange: (next: string[]) => void;
  onReset: () => void;
};

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function summarize(options: LedgerStatusOption[], value: string[]): string {
  const labels = options.filter((option) => value.includes(option.value)).map((option) => option.label);
  if (labels.length === 0) return '전체';
  if (labels.length === options.length) return '전체';
  if (labels.length <= 2) return labels.join(' · ');
  return `${labels[0]} 외 ${labels.length - 1}`;
}

/** 상태 다중 선택 — 데스크톱 Popover (support-list-filters 선례 · designer §2-4) */
export function AssetLedgerStatusFilter({
  options,
  value,
  isCustom,
  onChange,
  onReset
}: AssetLedgerStatusFilterProps) {
  const [open, setOpen] = useState(false);
  const TriggerIcon = isCustom ? Icons.xCircle : Icons.plusCircle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          data-testid='asset-status-filter'
          className='h-9 border-dashed'
        >
          <TriggerIcon aria-hidden />
          상태
          <Separator orientation='vertical' className='mx-0.5 data-[orientation=vertical]:h-4' />
          <span className='font-normal'>{summarize(options, value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-56 p-0'>
        <Command>
          <CommandList>
            <CommandGroup>
              {options.map((option) => {
                const checked = value.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    data-testid={`asset-status-option-${option.value}`}
                    data-checked={checked}
                    onSelect={() => onChange(toggle(value, option.value))}
                    className='min-h-9'
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-4 items-center justify-center rounded-sm border border-primary',
                        checked ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <Icons.check className='size-3.5' />
                    </span>
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value='__reset__'
                disabled={!isCustom}
                onSelect={() => {
                  onReset();
                  setOpen(false);
                }}
                className='justify-center text-center'
              >
                기본값으로
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type AssetLedgerStatusChecklistProps = {
  options: LedgerStatusOption[];
  value: string[];
  onChange: (next: string[]) => void;
};

/** 상태 다중 선택 — 휴대폰 필터 Sheet 안 체크 목록 (`-mobile` testid) */
export function AssetLedgerStatusChecklist({ options, value, onChange }: AssetLedgerStatusChecklistProps) {
  return (
    <fieldset className='space-y-1'>
      <legend className='mb-2 text-sm font-semibold'>상태</legend>
      {options.map((option) => {
        const id = `asset-status-mobile-${option.value}`;
        return (
          <div key={option.value} className='flex min-h-11 items-center gap-3'>
            <Checkbox
              id={id}
              data-testid={`asset-status-option-mobile-${option.value}`}
              checked={value.includes(option.value)}
              onCheckedChange={() => onChange(toggle(value, option.value))}
            />
            <Label htmlFor={id} className='flex-1 py-2 text-sm font-normal'>
              {option.label}
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}
