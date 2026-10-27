'use client';

import { Suspense, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { DateRange } from 'react-day-picker';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getKstTodayDateString } from '@/lib/kst';
import { workflowMembersQueryOptions, workflowTemplatesQueryOptions } from '../api/queries';
import { WORKFLOW_SORTS, type WorkflowSort } from '../api/types';
import { parseWorkflowDateValue, toWorkflowDateValue } from '../lib/date-value';
import { formatAffiliation } from '../lib/person';
import { WorkflowPersonAvatar } from './workflow-person';

// ---------------------------------------------------------------------------
// 다중 선택 Popover 공통 trigger
// ---------------------------------------------------------------------------
function FilterTriggerButton({
  label,
  count,
  testId,
  open
}: {
  label: string;
  count: number;
  testId: string;
  open: boolean;
}) {
  return (
    <PopoverTrigger asChild>
      <Button
        type='button'
        variant='outline'
        size='sm'
        aria-expanded={open}
        data-testid={testId}
        className='h-9 border-dashed md:h-8'
      >
        <Icons.plusCircle aria-hidden />
        {label}
        {count > 0 ? (
          <>
            <Separator orientation='vertical' className='mx-0.5 data-[orientation=vertical]:h-4' />
            <Badge variant='secondary' className='rounded-sm px-1 font-normal tabular-nums'>
              {count}
            </Badge>
          </>
        ) : null}
      </Button>
    </PopoverTrigger>
  );
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary',
        checked ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible'
      )}
    >
      <Icons.check className='size-3.5' />
    </span>
  );
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

// ---------------------------------------------------------------------------
// 작성자
// ---------------------------------------------------------------------------
function WriterOptions({
  selected,
  onChange
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { data: members } = useSuspenseQuery(workflowMembersQueryOptions());
  return (
    <>
      <CommandEmpty>구성원을 찾을 수 없습니다.</CommandEmpty>
      <CommandGroup>
        {members.map((member) => {
          const checked = selected.includes(member.user_id);
          return (
            <CommandItem
              key={member.user_id}
              value={`${member.full_name} ${member.email} ${formatAffiliation(member)}`}
              onSelect={() => onChange(toggleValue(selected, member.user_id))}
              className='min-h-10'
            >
              <CheckMark checked={checked} />
              <WorkflowPersonAvatar person={member} className='size-6' />
              <span className='truncate'>{member.full_name}</span>
              <span className='ml-auto truncate text-xs text-muted-foreground'>
                {formatAffiliation(member)}
              </span>
            </CommandItem>
          );
        })}
      </CommandGroup>
    </>
  );
}

export function WorkflowWriterFilter({
  selected,
  onChange
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <FilterTriggerButton
        label='작성자'
        count={selected.length}
        testId='workflow-filter-writer'
        open={open}
      />
      <PopoverContent className='w-[min(18rem,calc(100vw-2rem))] p-0' align='start'>
        <Command>
          <CommandInput placeholder='이름 검색…' />
          <CommandList>
            <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
              <WriterOptions selected={selected} onChange={onChange} />
            </Suspense>
            {selected.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onChange([])} className='justify-center'>
                    선택 해제
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// 양식
// ---------------------------------------------------------------------------
function TemplateOptions({
  selected,
  onChange
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { data: templates } = useSuspenseQuery(workflowTemplatesQueryOptions());
  return (
    <>
      <CommandEmpty>양식을 찾을 수 없습니다.</CommandEmpty>
      <CommandGroup>
        {templates.map((template) => (
          <CommandItem
            key={template.template_key}
            value={template.name}
            onSelect={() => onChange(toggleValue(selected, template.template_key))}
            className='min-h-10'
          >
            <CheckMark checked={selected.includes(template.template_key)} />
            <span aria-hidden>{template.emoji}</span>
            <span className='truncate'>{template.name}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}

export function WorkflowTemplateFilter({
  selected,
  onChange
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <FilterTriggerButton
        label='양식'
        count={selected.length}
        testId='workflow-filter-template'
        open={open}
      />
      <PopoverContent className='w-[min(16rem,calc(100vw-2rem))] p-0' align='start'>
        <Command>
          <CommandInput placeholder='양식 검색…' />
          <CommandList>
            <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
              <TemplateOptions selected={selected} onChange={onChange} />
            </Suspense>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// 업데이트일 (오늘 · 지난 1주일 · 1개월 · 3개월 · 월별 · 직접 입력)
// ---------------------------------------------------------------------------
const UPDATED_PRESETS = [
  { value: 'today', label: '오늘' },
  { value: '7d', label: '지난 1주일' },
  { value: '1m', label: '지난 1개월' },
  { value: '3m', label: '지난 3개월' }
] as const;

export function getUpdatedFilterLabel(value: string | null): string {
  if (!value) return '업데이트일';
  const preset = UPDATED_PRESETS.find((item) => item.value === value);
  if (preset) return preset.label;
  const month = /^month:(\d{4}-\d{2})$/.exec(value);
  if (month) return month[1];
  const range = /^range:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(value);
  if (range) return `${range[1]} ~ ${range[2]}`;
  return '업데이트일';
}

type UpdatedView = 'menu' | 'month' | 'range';

function MonthGrid({
  value,
  onSelect,
  onBack
}: {
  value: string | null;
  onSelect: (next: string) => void;
  onBack: () => void;
}) {
  const today = getKstTodayDateString();
  const selectedMonth = value?.startsWith('month:') ? value.slice(6) : null;
  const [year, setYear] = useState(() =>
    selectedMonth ? Number(selectedMonth.slice(0, 4)) : Number(today.slice(0, 4))
  );
  return (
    <div className='flex flex-col gap-3 p-3'>
      <div className='flex items-center justify-between gap-2'>
        <Button type='button' variant='ghost' size='sm' onClick={onBack}>
          <Icons.chevronLeft aria-hidden />
          뒤로
        </Button>
        <div className='flex items-center gap-1'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label='이전 연도'
            className='size-8'
            onClick={() => setYear((current) => current - 1)}
          >
            <Icons.chevronLeft aria-hidden />
          </Button>
          <span className='w-14 text-center text-sm font-medium tabular-nums'>{year}</span>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label='다음 연도'
            className='size-8'
            onClick={() => setYear((current) => current + 1)}
          >
            <Icons.chevronRight aria-hidden />
          </Button>
        </div>
      </div>
      <div className='grid grid-cols-3 gap-2'>
        {Array.from({ length: 12 }, (_, index) => {
          const month = `${year}-${String(index + 1).padStart(2, '0')}`;
          return (
            <Button
              key={month}
              type='button'
              variant={selectedMonth === month ? 'default' : 'outline'}
              size='sm'
              className='h-9'
              onClick={() => onSelect(`month:${month}`)}
            >
              {index + 1}월
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function RangePicker({
  value,
  onSelect,
  onBack
}: {
  value: string | null;
  onSelect: (next: string) => void;
  onBack: () => void;
}) {
  const match = value ? /^range:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(value) : null;
  const [range, setRange] = useState<DateRange | undefined>(() =>
    match
      ? { from: parseWorkflowDateValue(match[1]), to: parseWorkflowDateValue(match[2]) }
      : undefined
  );
  const canApply = Boolean(range?.from);
  return (
    <div className='flex flex-col gap-2 p-2'>
      <Button type='button' variant='ghost' size='sm' className='self-start' onClick={onBack}>
        <Icons.chevronLeft aria-hidden />
        뒤로
      </Button>
      <Calendar mode='range' selected={range} onSelect={setRange} numberOfMonths={1} />
      <Button
        type='button'
        size='sm'
        className='h-9'
        disabled={!canApply}
        onClick={() => {
          if (!range?.from) return;
          const from = toWorkflowDateValue(range.from);
          const to = toWorkflowDateValue(range.to ?? range.from);
          onSelect(`range:${from}..${to}`);
        }}
      >
        적용
      </Button>
    </div>
  );
}

export function WorkflowUpdatedFilter({
  value,
  onChange
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<UpdatedView>('menu');
  const label = getUpdatedFilterLabel(value);

  function select(next: string | null) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView('menu');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          aria-expanded={open}
          data-testid='workflow-filter-updated'
          className={cn('h-9 md:h-8', value ? '' : 'border-dashed')}
        >
          <Icons.calendar aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto min-w-56 p-0' align='start'>
        {view === 'menu' ? (
          <Command>
            <CommandList>
              <CommandGroup>
                {UPDATED_PRESETS.map((preset) => (
                  <CommandItem
                    key={preset.value}
                    value={preset.label}
                    onSelect={() => select(preset.value)}
                    className='min-h-10'
                  >
                    <Icons.check
                      aria-hidden
                      className={cn('size-4', value === preset.value ? 'opacity-100' : 'opacity-0')}
                    />
                    {preset.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem value='월별 조회' onSelect={() => setView('month')} className='min-h-10'>
                  <Icons.calendar aria-hidden />
                  월별 조회
                </CommandItem>
                <CommandItem value='직접 입력' onSelect={() => setView('range')} className='min-h-10'>
                  <Icons.edit aria-hidden />
                  직접 입력
                </CommandItem>
              </CommandGroup>
              {value ? (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem value='조건 해제' onSelect={() => select(null)} className='justify-center'>
                      조건 해제
                    </CommandItem>
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </Command>
        ) : view === 'month' ? (
          <MonthGrid value={value} onSelect={select} onBack={() => setView('menu')} />
        ) : (
          <RangePicker value={value} onSelect={select} onBack={() => setView('menu')} />
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// 정렬
// ---------------------------------------------------------------------------
export const WORKFLOW_SORT_LABELS: Record<WorkflowSort, string> = {
  updated_desc: '최근 업데이트순',
  updated_asc: '오래된 업데이트순',
  written_desc: '최근 작성순',
  written_asc: '오래된 작성순'
};

export function WorkflowSortMenu({
  value,
  onChange
}: {
  value: WorkflowSort;
  onChange: (next: WorkflowSort) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          data-testid='workflow-sort'
          className='h-9 md:h-8'
          aria-label={`정렬: ${WORKFLOW_SORT_LABELS[value]}`}
        >
          <Icons.sort aria-hidden />
          <span className='hidden sm:inline'>{WORKFLOW_SORT_LABELS[value]}</span>
          <span className='sm:hidden'>정렬</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        <DropdownMenuLabel>정렬</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if ((WORKFLOW_SORTS as readonly string[]).includes(next)) {
              onChange(next as WorkflowSort);
            }
          }}
        >
          {WORKFLOW_SORTS.map((sort) => (
            <DropdownMenuRadioItem key={sort} value={sort}>
              {WORKFLOW_SORT_LABELS[sort]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
