'use client';

import { useState } from 'react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';
import { quickRequestConversationsQueryOptions, quickRequestKeys } from '../../api/queries';
import type { QuickRequestConversationsFilters } from '../../api/types';
import { isQuickChatConversationTab, type QuickChatConversationTab } from '../../schemas/quick-request-chat';
import { QuickRequestQueryBoundary } from '../quick-request-query-boundary';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import { QuickChatConversationItem } from './quick-chat-conversation-item';
import type { QuickChatRealtimeStatus } from './quick-chat-realtime';

const SEARCH_DEBOUNCE_MS = 300;

type QuickChatConversationListProps = {
  filters: QuickRequestConversationsFilters;
  q: string | null;
  tab: QuickChatConversationTab;
  selectedRequestNo: string | null;
  realtimeStatus: QuickChatRealtimeStatus;
  onSearchChange: (q: string | null) => void;
  onTabChange: (tab: QuickChatConversationTab) => void;
  onSelect: (requestNo: string) => void;
  className?: string;
};

function ConversationItems({
  filters,
  selectedRequestNo,
  onSelect
}: Pick<QuickChatConversationListProps, 'filters' | 'selectedRequestNo' | 'onSelect'>) {
  const { data } = useSuspenseQuery(quickRequestConversationsQueryOptions(filters));

  if (data.conversations.length === 0) {
    const message =
      filters.tab === 'unread'
        ? QUICK_CHAT_TEXT.listEmptyUnread
        : filters.q
          ? QUICK_CHAT_TEXT.listEmptySearch
          : QUICK_CHAT_TEXT.listEmptyAll;
    return (
      <p data-testid='quick-chat-list-empty' className='px-4 py-10 text-center text-sm text-muted-foreground'>
        {message}
      </p>
    );
  }

  return (
    <ul role='list' aria-label={QUICK_CHAT_TEXT.listAriaLabel} className='divide-y'>
      {data.conversations.map((conversation) => (
        <QuickChatConversationItem
          key={conversation.id}
          conversation={conversation}
          selected={conversation.requestNo === selectedRequestNo}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

/** 목록 패널 — 헤더·검색·탭 shell은 Suspense 밖(plan 40), 항목만 compact 스피너 (U-2 · U-10) */
export function QuickChatConversationList({
  filters,
  q,
  tab,
  selectedRequestNo,
  realtimeStatus,
  onSearchChange,
  onTabChange,
  onSelect,
  className
}: QuickChatConversationListProps) {
  const [searchInput, setSearchInput] = useState(q ?? '');
  const [lastQ, setLastQ] = useState(q);
  // 캐시 구독만 (조회는 본문 useSuspenseQuery) — totals는 tab 무관이라 현재 필터 캐시에서 읽는다
  const { data } = useQuery({ ...quickRequestConversationsQueryOptions(filters), enabled: false });

  if (lastQ !== q) {
    setLastQ(q);
    if ((q ?? '') !== searchInput.trim()) {
      setSearchInput(q ?? '');
    }
  }

  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearchChange(value.trim() ? value.trim() : null);
  }, SEARCH_DEBOUNCE_MS);

  const totals = data?.totals;
  const connected = realtimeStatus === 'subscribed';

  return (
    <aside
      aria-label={QUICK_CHAT_TEXT.listAriaLabel}
      className={cn('min-h-0 min-w-0 flex-col rounded-xl border bg-card', className)}
    >
      <div className='shrink-0 px-4 pt-4 pb-3'>
        <div className='flex items-center justify-between gap-2'>
          <h2 className='text-sm font-semibold'>{QUICK_CHAT_TEXT.listTitle}</h2>
          <Badge
            variant='outline'
            data-testid='quick-chat-realtime-badge'
            data-status={realtimeStatus}
            className={cn('rounded-full font-normal', connected ? 'text-primary' : 'text-muted-foreground')}
          >
            {connected ? QUICK_CHAT_TEXT.realtimeOn : QUICK_CHAT_TEXT.realtimeConnecting}
          </Badge>
        </div>
        <p
          data-testid='quick-chat-list-summary'
          aria-live='polite'
          className='min-h-4 text-xs text-muted-foreground tabular-nums'
        >
          {totals ? quickChatText.summary(totals.conversations, totals.unreadConversations) : ''}
        </p>
      </div>
      <div className='shrink-0 px-4 pb-2'>
        <InputGroup className='h-11 lg:h-10'>
          <InputGroupAddon>
            <Icons.search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type='search'
            value={searchInput}
            placeholder={QUICK_CHAT_TEXT.searchPlaceholder}
            aria-label={QUICK_CHAT_TEXT.searchPlaceholder}
            autoComplete='off'
            data-testid='quick-chat-search'
            onChange={(event) => {
              setSearchInput(event.target.value);
              debouncedSearch(event.target.value);
            }}
          />
        </InputGroup>
      </div>
      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (isQuickChatConversationTab(next)) onTabChange(next);
        }}
        className='shrink-0 px-4 pb-2'
      >
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='all' data-testid='quick-chat-tab-all'>
            {QUICK_CHAT_TEXT.tabAll}
          </TabsTrigger>
          <TabsTrigger value='unread' data-testid='quick-chat-tab-unread'>
            {QUICK_CHAT_TEXT.tabUnread}
            {totals && totals.unreadConversations > 0 ? (
              <span className='text-xs tabular-nums text-muted-foreground'>{totals.unreadConversations}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <ScrollArea data-testid='quick-chat-list' className='min-h-0 flex-1 border-t'>
        <QuickRequestQueryBoundary
          errorMessage={QUICK_CHAT_TEXT.listLoadFailed}
          ssrQueryKey={quickRequestKeys.conversations(filters)}
          loadingFallback={<PageLoadingSpinner variant='compact' />}
          renderError={(alert) => <div className='p-4'>{alert}</div>}
        >
          <ConversationItems filters={filters} selectedRequestNo={selectedRequestNo} onSelect={onSelect} />
        </QuickRequestQueryBoundary>
      </ScrollArea>
    </aside>
  );
}
