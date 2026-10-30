'use client';

import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { assigneeOptionsQueryOptions } from '@/features/subscriptions/api/queries';
import { cn } from '@/lib/utils';
import {
  affiliationAllLabel,
  LEDGER_AFFILIATIONS,
  LEDGER_AFFILIATION_LABELS,
  type AssigneeInput,
  type AssigneePersonOption,
  type AssigneeTeamOption,
  type AssigneeView,
  type LedgerAffiliation
} from '../api/types';
import { assigneeKey } from '../lib/assignee-input';
import { nameInitials } from '../lib/ui-labels';
import { AssetLedgerErrorAlert, AssetLedgerQueryBoundary } from './asset-ledger-query-boundary';
import { AssigneeChip } from './assignee-chip';

/** 폼 값 — 서버 입력 + 칩 라벨 */
export type AssigneePick = {
  key: string;
  input: AssigneeInput;
  label: string;
  /** 사람이면 「웨이크 디자인팀」 */
  sub: string | null;
};

export function assigneePickFromView(view: AssigneeView): AssigneePick | null {
  let input: AssigneeInput | null = null;
  if (view.assignee_type === 'user' && view.user_id) {
    input = { assignee_type: 'user', user_id: view.user_id };
  } else if (view.assignee_type === 'team' && view.affiliation && view.rank) {
    input = { assignee_type: 'team', affiliation: view.affiliation, rank: view.rank };
  } else if (view.assignee_type === 'affiliation' && view.affiliation) {
    input = { assignee_type: 'affiliation', affiliation: view.affiliation };
  }
  if (!input) return null;
  return { key: assigneeKey(input), input, label: view.label, sub: view.team_label };
}

function personPick(person: AssigneePersonOption): AssigneePick {
  const input: AssigneeInput = { assignee_type: 'user', user_id: person.user_id };
  return { key: assigneeKey(input), input, label: person.full_name, sub: person.team_label };
}

function teamPick(team: AssigneeTeamOption): AssigneePick {
  const input: AssigneeInput = { assignee_type: 'team', affiliation: team.affiliation, rank: team.rank };
  return { key: assigneeKey(input), input, label: team.label, sub: null };
}

function affiliationPick(affiliation: LedgerAffiliation): AssigneePick {
  const input: AssigneeInput = { assignee_type: 'affiliation', affiliation };
  return { key: assigneeKey(input), input, label: affiliationAllLabel(affiliation), sub: null };
}

type PickerTab = 'user' | 'team' | 'affiliation' | 'none';

type OptionListProps = {
  pickedKeys: Set<string>;
  multiple: boolean;
  onPick: (pick: AssigneePick) => void;
};

function PeopleOptions({ pickedKeys, multiple, onPick }: OptionListProps) {
  const { data } = useSuspenseQuery(assigneeOptionsQueryOptions());
  return (
    <>
      <CommandEmpty>찾는 사람이 없어요.</CommandEmpty>
      <CommandGroup>
        {data.people.map((person) => {
          const pick = personPick(person);
          const picked = pickedKeys.has(pick.key);
          return (
            <CommandItem
              key={person.user_id}
              value={`${person.full_name} ${person.team_label ?? ''} ${person.user_id}`}
              data-testid={`assignee-option-user-${person.user_id}`}
              disabled={multiple && picked}
              onSelect={() => onPick(pick)}
              className='min-h-11 gap-2'
            >
              <Avatar className='size-6'>
                <AvatarFallback className='text-[10px]'>{nameInitials(person.full_name)}</AvatarFallback>
              </Avatar>
              <span className='flex min-w-0 flex-1 flex-col'>
                <span className='truncate text-sm' translate='no'>
                  {person.full_name}
                </span>
                {person.team_label ? (
                  <span className='truncate text-xs text-muted-foreground'>{person.team_label}</span>
                ) : null}
              </span>
              {picked ? (
                multiple ? (
                  <span className='shrink-0 text-xs text-muted-foreground'>선택됨</span>
                ) : (
                  <Icons.check aria-hidden className='size-4 shrink-0' />
                )
              ) : null}
            </CommandItem>
          );
        })}
      </CommandGroup>
    </>
  );
}

function TeamOptions({ pickedKeys, multiple, onPick }: OptionListProps) {
  const { data } = useSuspenseQuery(assigneeOptionsQueryOptions());
  return (
    <>
      <CommandEmpty>찾는 팀이 없어요.</CommandEmpty>
      {LEDGER_AFFILIATIONS.map((affiliation) => {
        const teams = data.teams.filter((team) => team.affiliation === affiliation);
        if (teams.length === 0) return null;
        return (
          <CommandGroup key={affiliation} heading={LEDGER_AFFILIATION_LABELS[affiliation]}>
            {teams.map((team) => {
              const pick = teamPick(team);
              const picked = pickedKeys.has(pick.key);
              return (
                <CommandItem
                  key={pick.key}
                  value={`${team.label} ${pick.key}`}
                  data-testid={`assignee-option-team-${team.affiliation}-${team.rank}`}
                  disabled={multiple && picked}
                  onSelect={() => onPick(pick)}
                  className='min-h-11 gap-2'
                >
                  <Icons.teams aria-hidden className='size-4 text-muted-foreground' />
                  <span className='min-w-0 flex-1 truncate'>{team.label}</span>
                  {picked ? (
                    multiple ? (
                      <span className='shrink-0 text-xs text-muted-foreground'>선택됨</span>
                    ) : (
                      <Icons.check aria-hidden className='size-4 shrink-0' />
                    )
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        );
      })}
    </>
  );
}

type OptionPopoverProps = OptionListProps & {
  kind: 'user' | 'team';
};

function OptionPopover({ kind, pickedKeys, multiple, onPick }: OptionPopoverProps) {
  const [open, setOpen] = useState(false);
  const List = kind === 'user' ? PeopleOptions : TeamOptions;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          data-testid={`assignee-picker-open-${kind}`}
          className='h-11 w-full justify-between font-normal text-muted-foreground md:h-9'
        >
          {kind === 'user' ? '이름으로 찾기' : '팀 고르기'}
          <Icons.search aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-[var(--radix-popover-trigger-width)] min-w-64 p-0'>
        <Command>
          <CommandInput placeholder={kind === 'user' ? '이름 검색' : '팀 검색'} />
          <CommandList className='max-h-72'>
            <AssetLedgerQueryBoundary
              errorMessage='대상자 목록을 불러오지 못했어요.'
              loadingFallback={<PageLoadingSpinner variant='compact' />}
              renderError={(_error, retry) => (
                <div className='p-2'>
                  <AssetLedgerErrorAlert message='대상자 목록을 불러오지 못했어요.' onRetry={retry} />
                </div>
              )}
            >
              <List
                pickedKeys={pickedKeys}
                multiple={multiple}
                onPick={(pick) => {
                  onPick(pick);
                  setOpen(false);
                }}
              />
            </AssetLedgerQueryBoundary>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type AssigneePickerProps = {
  /** multiple = 구독 대상자(여러 개 · 사람/팀/소속 전체) · single = 비품 사용자(하나 · 사람/팀/비워 두기) */
  mode: 'multiple' | 'single';
  value: AssigneePick[];
  onChange: (next: AssigneePick[]) => void;
  invalid?: boolean;
};

/**
 * 대상자 피커 (designer §2-8) — 탭 「사람」「팀」「소속 전체」/「비워 두기」 · 고른 것은 칩으로 쌓이고 X로 뺀다.
 * 후보 = `GET /api/asset-ledger/assignee-options`(권한자 전용 · 동방 제외 · Popover 열 때 조회).
 */
export function AssigneePicker({ mode, value, onChange, invalid }: AssigneePickerProps) {
  const multiple = mode === 'multiple';
  const [tab, setTab] = useState<PickerTab>(() => {
    const first = value[0];
    if (!first) return 'user';
    return first.input.assignee_type;
  });
  const pickedKeys = new Set(value.map((pick) => pick.key));

  function addPick(pick: AssigneePick) {
    if (!multiple) {
      onChange([pick]);
      return;
    }
    if (pickedKeys.has(pick.key)) return;
    onChange([...value, pick]);
  }

  function removePick(key: string) {
    onChange(value.filter((pick) => pick.key !== key));
  }

  const tabs: { value: PickerTab; label: string }[] = multiple
    ? [
        { value: 'user', label: '사람' },
        { value: 'team', label: '팀' },
        { value: 'affiliation', label: '소속 전체' }
      ]
    : [
        { value: 'user', label: '사람' },
        { value: 'team', label: '팀' },
        { value: 'none', label: '비워 두기' }
      ];

  return (
    <div
      data-testid='assignee-picker'
      className={cn(
        'space-y-3 rounded-lg border p-3',
        invalid && 'border-destructive ring-1 ring-destructive/20'
      )}
    >
      {multiple ? (
        value.length > 0 ? (
          <ul aria-label='고른 대상자' className='flex flex-wrap gap-2'>
            {value.map((pick) => (
              <li key={pick.key}>
                <AssigneeChip
                  assignee={{ assignee_type: pick.input.assignee_type, label: pick.label }}
                  className='h-9 pr-0.5 md:h-7'
                >
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-8 rounded-full md:size-6'
                    aria-label={`${pick.label} 빼기`}
                    data-testid={`assignee-chip-remove-${pick.key}`}
                    onClick={() => removePick(pick.key)}
                  >
                    <Icons.close aria-hidden className='size-3.5' />
                  </Button>
                </AssigneeChip>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-sm text-muted-foreground'>아직 대상자가 없어요.</p>
        )
      ) : (
        <div className='flex min-w-0 items-center gap-2'>
          <AssigneeChip
            assignee={
              value[0] ? { assignee_type: value[0].input.assignee_type, label: value[0].label } : null
            }
          />
          {value[0]?.sub ? (
            <span className='truncate text-xs text-muted-foreground'>{value[0].sub}</span>
          ) : null}
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(next) => {
          const nextTab = next as PickerTab;
          setTab(nextTab);
          if (nextTab === 'none') onChange([]);
        }}
      >
        <TabsList className='grid h-10 w-full grid-cols-3 md:h-9'>
          {tabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value} data-testid={`assignee-picker-tab-${item.value}`}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'user' || tab === 'team' ? (
        <OptionPopover kind={tab} pickedKeys={pickedKeys} multiple={multiple} onPick={addPick} />
      ) : null}

      {tab === 'affiliation' ? (
        <div className='space-y-1'>
          {LEDGER_AFFILIATIONS.map((affiliation) => {
            const pick = affiliationPick(affiliation);
            const checked = pickedKeys.has(pick.key);
            const id = `assignee-affiliation-${affiliation}`;
            return (
              <div key={affiliation} className='flex min-h-11 items-center gap-3'>
                <Checkbox
                  id={id}
                  data-testid={`assignee-option-affiliation-${affiliation}`}
                  checked={checked}
                  onCheckedChange={() => (checked ? removePick(pick.key) : addPick(pick))}
                />
                <Label htmlFor={id} className='flex flex-1 items-center gap-2 py-2 font-normal'>
                  <Icons.building aria-hidden className='size-4 text-muted-foreground' />
                  {pick.label}
                </Label>
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === 'none' ? (
        <p className='text-sm text-muted-foreground'>보관 중인 장비처럼 쓰는 사람이 없을 때 고르세요.</p>
      ) : null}
    </div>
  );
}
