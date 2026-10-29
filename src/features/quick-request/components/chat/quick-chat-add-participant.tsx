'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Icons } from '@/components/icons';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { inviteQuickRequestParticipantMutation } from '../../api/mutations';
import { quickRequestParticipantCandidatesQueryOptions } from '../../api/queries';
import type { QuickRequestParticipantCandidate } from '../../api/types';
import { QUICK_CHAT_PARTICIPANT_MESSAGES } from '../../schemas/quick-request-participant';
import { quickChatInitial } from './quick-chat-bubble';
import {
  QUICK_CHAT_PARTICIPANT_SEARCH_DEBOUNCE_MS,
  QUICK_CHAT_TEXT,
  quickChatText
} from './quick-chat-constants';
import { useDebouncedValue } from './use-debounced-value';

export type QuickChatParticipantsLayout = 'popover' | 'drawer';

type QuickChatAddParticipantProps = {
  requestNo: string;
  layout: QuickChatParticipantsLayout;
  /** 「참여자 목록으로」 */
  onBack: () => void;
  /** 초대 201 뒤 (부모가 mode='list') */
  onInvited: () => void;
};

/**
 * plan 101 U-3 · designer §2-3 — 서버 검색 Combobox: `Command shouldFilter={false}` + 300ms debounce →
 * `GET …/participants/candidates?q=` · 선택 즉시 초대(toast 「{이름}님을 초대했습니다.」) · 실패는 서버 message.
 * Popover 안에 Popover를 띄우지 않고 패널 모드만 바꾼다(중첩 오버레이 없음).
 */
export function QuickChatAddParticipant({ requestNo, layout, onBack, onInvited }: QuickChatAddParticipantProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, QUICK_CHAT_PARTICIPANT_SEARCH_DEBOUNCE_MS);
  const q = debouncedQuery.trim();
  const enabled = q.length > 0;

  const candidates = useQuery({
    ...quickRequestParticipantCandidatesQueryOptions(requestNo, q),
    enabled,
    placeholderData: keepPreviousData
  });

  const invite = useMutation({
    ...inviteQuickRequestParticipantMutation,
    onSuccess: (data) => {
      notifySuccess(quickChatText.invited(data.participant.name));
      onInvited();
    },
    onError: (error) => {
      notifyError(
        error instanceof Error && error.message ? error.message : QUICK_CHAT_PARTICIPANT_MESSAGES.inviteFailed
      );
    }
  });

  function handleSelect(candidate: QuickRequestParticipantCandidate) {
    if (invite.isPending) return;
    invite.mutate({ requestNo, userId: candidate.userId });
  }

  const results = candidates.data;
  const showHint = !enabled;
  const showLoading = enabled && candidates.isPending;
  const showError = enabled && candidates.isError;
  const showEmpty = enabled && !candidates.isPending && !candidates.isError && results?.length === 0;

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='flex items-center gap-1 px-2 py-2'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className={cn('shrink-0', layout === 'drawer' ? 'size-11' : 'size-9')}
          aria-label={QUICK_CHAT_TEXT.backToParticipants}
          data-testid='quick-chat-add-participant-back'
          onClick={onBack}
        >
          <Icons.chevronLeft aria-hidden />
        </Button>
        <h3 className='text-sm font-semibold'>{QUICK_CHAT_TEXT.addParticipant}</h3>
      </div>
      <Command shouldFilter={false} className='min-h-0 flex-1 rounded-none bg-transparent'>
        <CommandInput
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={QUICK_CHAT_TEXT.participantSearchPlaceholder}
          aria-label={QUICK_CHAT_TEXT.participantSearchPlaceholder}
          data-testid='quick-chat-add-participant-input'
        />
        <CommandList className={cn('min-h-0', layout === 'drawer' ? 'max-h-[40dvh]' : 'max-h-72')}>
          {showHint ? (
            <p className='p-4 text-sm text-muted-foreground'>{QUICK_CHAT_TEXT.participantSearchHint}</p>
          ) : null}
          {showLoading ? (
            <PageLoadingSpinner variant='compact' data-testid='quick-chat-candidates-loading' />
          ) : null}
          {showError ? (
            <p className='p-4 text-sm text-destructive' role='alert'>
              {candidates.error instanceof Error && candidates.error.message
                ? candidates.error.message
                : QUICK_CHAT_TEXT.loadFailed}
            </p>
          ) : null}
          {showEmpty ? (
            <CommandEmpty data-testid='quick-chat-candidates-empty'>{QUICK_CHAT_TEXT.candidatesEmpty}</CommandEmpty>
          ) : null}
          {enabled && results && results.length > 0 ? (
            <CommandGroup>
              {results.map((candidate) => (
                <CommandItem
                  key={candidate.userId}
                  value={candidate.userId}
                  disabled={invite.isPending}
                  onSelect={() => handleSelect(candidate)}
                  className={cn('gap-2', layout === 'drawer' ? 'min-h-12' : 'min-h-11')}
                  data-testid={`quick-chat-candidate-${candidate.userId}`}
                >
                  <Avatar className='size-6'>
                    <AvatarFallback className='bg-primary/10 text-[11px] font-medium text-primary'>
                      {quickChatInitial(candidate.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className='flex min-w-0 flex-1 flex-col'>
                    <span className='truncate text-sm'>{candidate.name}</span>
                    <span className='truncate text-xs text-muted-foreground'>
                      {candidate.email}
                      {candidate.affiliationLabel ? ` · ${candidate.affiliationLabel}` : ''}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </div>
  );
}
