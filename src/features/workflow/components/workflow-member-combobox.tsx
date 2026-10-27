'use client';

import { Suspense, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { workflowMembersQueryOptions } from '../api/queries';
import type { WorkflowMember } from '../api/types';
import { formatAffiliation } from '../lib/person';
import { WorkflowPersonAvatar } from './workflow-person';

type MemberOptionsProps = {
  onSelect: (member: WorkflowMember) => void;
  getDisabledReason?: (member: WorkflowMember) => string | null;
};

function MemberOptions({ onSelect, getDisabledReason }: MemberOptionsProps) {
  const { data: members } = useSuspenseQuery(workflowMembersQueryOptions());
  const active = members.filter((member) => member.is_active);
  return (
    <>
      <CommandEmpty>구성원을 찾을 수 없습니다.</CommandEmpty>
      <CommandGroup>
        {active.map((member) => {
          const reason = getDisabledReason?.(member) ?? null;
          const affiliation = formatAffiliation(member);
          return (
            <CommandItem
              key={member.user_id}
              value={`${member.full_name} ${member.email} ${affiliation} ${member.user_id}`}
              disabled={reason !== null}
              onSelect={() => onSelect(member)}
              className='min-h-11 gap-2'
            >
              <WorkflowPersonAvatar person={member} className='size-6' />
              <span className='flex min-w-0 flex-1 flex-col'>
                <span className='truncate text-sm'>{member.full_name}</span>
                {affiliation ? (
                  <span className='truncate text-xs text-muted-foreground'>{affiliation}</span>
                ) : null}
              </span>
              {reason ? <span className='shrink-0 text-xs text-muted-foreground'>{reason}</span> : null}
            </CommandItem>
          );
        })}
      </CommandGroup>
    </>
  );
}

type WorkflowMemberComboboxProps = MemberOptionsProps & {
  /** PopoverTrigger asChild로 감쌀 버튼 */
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
};

/** active 구성원 선택 (이름·소속·아바타) — `GET /api/workflow/members` 1회 캐시, 클라이언트 필터 */
export function WorkflowMemberCombobox({
  children,
  onSelect,
  getDisabledReason,
  align = 'end'
}: WorkflowMemberComboboxProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className='w-[min(20rem,calc(100vw-2rem))] p-0'>
        <Command>
          <CommandInput placeholder='이름 검색…' />
          <CommandList className='max-h-72'>
            <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
              <MemberOptions
                getDisabledReason={getDisabledReason}
                onSelect={(member) => {
                  onSelect(member);
                  setOpen(false);
                }}
              />
            </Suspense>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
