'use client';

import { useState } from 'react';
import { ko } from 'date-fns/locale';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { parseWorkflowDateValue, toWorkflowDateValue } from '../lib/date-value';
import { formatAmountInput } from '../lib/format-amount';
import { normalizeAmountInput } from '../lib/required-rules';

/**
 * flex 미니멀 톤 — 평소에는 표처럼, hover·focus 때 입력칸.
 * 휴대폰(md 미만)은 hover가 없어 입력칸인지 알 수 없으므로 테두리·배경을 늘 보인다.
 */
export const WORKFLOW_WIDGET_TONE =
  'border-transparent bg-transparent shadow-none hover:bg-muted/50 focus-visible:border-ring dark:bg-transparent max-md:border-input max-md:bg-muted/30 max-md:dark:bg-input/30';

export type WidgetA11yProps = {
  id: string;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
};

type BaseProps<T> = {
  value: T;
  onChange: (next: T) => void;
  onBlur?: () => void;
  a11y: WidgetA11yProps;
};

export function StringWidget({ value, onChange, onBlur, a11y }: BaseProps<string>) {
  return (
    <Textarea
      {...a11y}
      rows={1}
      value={value}
      placeholder='내용을 입력해 주세요.'
      className={cn(
        'min-h-11 resize-none py-2.5 field-sizing-content md:min-h-9 md:py-1.5',
        WORKFLOW_WIDGET_TONE
      )}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  );
}

export function AmountWidget({ value, onChange, onBlur, a11y }: BaseProps<string>) {
  return (
    <InputGroup className={cn('h-11 max-w-xs md:h-9', WORKFLOW_WIDGET_TONE)}>
      <InputGroupInput
        {...a11y}
        inputMode='numeric'
        autoComplete='off'
        value={formatAmountInput(value)}
        placeholder='금액을 입력해 주세요.'
        className='h-full tabular-nums'
        onChange={(event) => onChange(normalizeAmountInput(event.target.value).replace(/\D/g, ''))}
        onBlur={onBlur}
      />
      <InputGroupAddon align='inline-end'>원</InputGroupAddon>
    </InputGroup>
  );
}

export function SelectWidget({
  value,
  onChange,
  onBlur,
  a11y,
  options
}: BaseProps<string> & { options: string[] }) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(next);
        onBlur?.();
      }}
    >
      <SelectTrigger
        {...a11y}
        className={cn(
          'w-full max-w-xs justify-between data-[size=default]:h-11 md:data-[size=default]:h-9',
          WORKFLOW_WIDGET_TONE
        )}
      >
        <SelectValue placeholder='옵션을 선택해 주세요.'>
          {value ? (
            <Badge variant='secondary' className='rounded-md font-normal'>
              {value}
            </Badge>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option} className='min-h-11 md:min-h-0'>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MultiSelectWidget({
  value,
  onChange,
  a11y,
  options
}: BaseProps<string[]> & { options: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className='flex flex-wrap items-center gap-1'>
      {value.map((item) => (
        <Badge key={item} variant='secondary' className='gap-1 rounded-md pr-1 font-normal'>
          {item}
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label={`${item} 선택 해제`}
            className='size-8 md:size-5'
            onClick={() => onChange(value.filter((entry) => entry !== item))}
          >
            <Icons.close aria-hidden className='size-4 md:size-3' />
          </Button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            {...a11y}
            type='button'
            variant='ghost'
            className={cn('h-11 justify-start font-normal text-muted-foreground md:h-9', WORKFLOW_WIDGET_TONE)}
          >
            옵션을 선택해 주세요.
          </Button>
        </PopoverTrigger>
        <PopoverContent align='start' className='w-64 p-0'>
          <Command>
            <CommandList>
              <CommandEmpty>옵션이 없습니다.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const checked = value.includes(option);
                  return (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() =>
                        onChange(checked ? value.filter((entry) => entry !== option) : [...value, option])
                      }
                    >
                      <Icons.check aria-hidden className={cn('size-4', checked ? 'opacity-100' : 'opacity-0')} />
                      {option}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function DateWidget({
  value,
  onChange,
  onBlur,
  a11y,
  clearable
}: BaseProps<string> & { clearable: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = parseWorkflowDateValue(value);
  return (
    <div className='flex items-center gap-1'>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onBlur?.();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            {...a11y}
            type='button'
            variant='ghost'
            className={cn(
              'h-11 w-full max-w-xs justify-between font-normal tabular-nums md:h-9',
              WORKFLOW_WIDGET_TONE,
              !value && 'text-muted-foreground'
            )}
          >
            {value || '날짜를 입력해 주세요.'}
            <Icons.calendar aria-hidden className='text-muted-foreground' />
          </Button>
        </PopoverTrigger>
        <PopoverContent align='start' className='w-auto p-0'>
          <Calendar
            mode='single'
            locale={ko}
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              if (date) onChange(toWorkflowDateValue(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && value ? (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-11 shrink-0 text-muted-foreground md:h-9'
          onClick={() => onChange('')}
        >
          지우기
        </Button>
      ) : null}
    </div>
  );
}
