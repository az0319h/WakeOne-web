'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icons } from '@/components/icons';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';
import { quickRequestConversationsInfiniteQueryOptions, quickRequestKeys } from '../../api/queries';
import type { QuickRequestConversation, QuickRequestConversationsFilters } from '../../api/types';
import type { QuickRangeValue } from '../../lib/quick-range-search-params';
import type { QuickRealtimeStatus } from '../../lib/use-quick-realtime-channel';
import { isQuickChatConversationTab, type QuickChatConversationTab } from '../../schemas/quick-request-chat';
import { QuickRangeFilter } from '../dashboard/quick-range-filter';
import { QuickInfiniteSentinel } from '../quick-infinite-sentinel';
import { QuickRequestQueryBoundary } from '../quick-request-query-boundary';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import { QuickChatConversationItem } from './quick-chat-conversation-item';

const SEARCH_DEBOUNCE_MS = 300;

const REALTIME_STATUS_LABEL: Record<QuickRealtimeStatus, string> = {
  live: QUICK_CHAT_TEXT.realtimeOn,
  connecting: QUICK_CHAT_TEXT.realtimeConnecting,
  polling: QUICK_CHAT_TEXT.realtimePolling
};

/**
 * plan 94 U-1 — 「실시간」(live) / 「연결 중…」(connecting) / 「폴링」(polling · Tooltip + `aria-label` 힌트).
 * `data-testid='quick-chat-realtime-status'` + `data-state` (AC-09). 액션이 아니라 44px 규칙 대상 아님.
 */
function RealtimeStatusBadge({ status }: { status: QuickRealtimeStatus }) {
  const badge = (
    <Badge
      variant='outline'
      role='status'
      aria-live='polite'
      data-testid='quick-chat-realtime-status'
      data-state={status}
      tabIndex={status === 'polling' ? 0 : undefined}
      aria-label={
        status === 'polling'
          ? `${QUICK_CHAT_TEXT.realtimePolling} — ${QUICK_CHAT_TEXT.realtimePollingHint}`
          : undefined
      }
      className={cn(
        'rounded-full font-normal',
        status === 'live' ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      {status === 'polling' ? <Icons.refresh aria-hidden className='size-3' /> : null}
      {REALTIME_STATUS_LABEL[status]}
    </Badge>
  );

  if (status !== 'polling') {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side='bottom' align='end'>
        {QUICK_CHAT_TEXT.realtimePollingHint}
      </TooltipContent>
    </Tooltip>
  );
}

/** 페이지를 평탄화하고 id로 dedupe (Realtime invalidate 뒤 페이지 경계가 밀려 같은 건이 두 페이지에 걸칠 수 있음) */
function flattenConversations(
  pages: ReadonlyArray<{ conversations: QuickRequestConversation[] }>
): QuickRequestConversation[] {
  const seen = new Set<string>();
  const result: QuickRequestConversation[] = [];
  for (const page of pages) {
    for (const conversation of page.conversations) {
      if (seen.has(conversation.id)) continue;
      seen.add(conversation.id);
      result.push(conversation);
    }
  }
  return result;
}

type QuickChatConversationListProps = {
  filters: QuickRequestConversationsFilters;
  q: string | null;
  tab: QuickChatConversationTab;
  range: QuickRangeValue;
  selectedRequestNo: string | null;
  realtimeStatus: QuickRealtimeStatus;
  onSearchChange: (q: string | null) => void;
  onTabChange: (tab: QuickChatConversationTab) => void;
  onRangeChange: (next: QuickRangeValue) => void;
  onSelect: (requestNo: string) => void;
  className?: string;
};

/** 항목 목록 — plan 97 D-5 커서 무한 목록(20건) + 하단 센티널 */
function ConversationItems({
  filters,
  selectedRequestNo,
  onSelect
}: Pick<QuickChatConversationListProps, 'filters' | 'selectedRequestNo' | 'onSelect'>) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    quickRequestConversationsInfiniteQueryOptions(filters)
  );
  const conversations = useMemo(() => flattenConversations(data.pages), [data.pages]);

  if (conversations.length === 0) {
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
    <>
      <ul role='list' aria-label={QUICK_CHAT_TEXT.listAriaLabel} className='divide-y'>
        {conversations.map((conversation) => (
          <QuickChatConversationItem
            key={conversation.id}
            conversation={conversation}
            selected={conversation.requestNo === selectedRequestNo}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <QuickInfiniteSentinel
        testIdPrefix='quick-chat-list'
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => void fetchNextPage()}
        endMessage={QUICK_CHAT_TEXT.listEnd}
        showEnd={data.pages.length > 1}
        className='border-t'
      />
    </>
  );
}

/** 목록 패널 — 헤더·검색·기간·탭 shell은 Suspense 밖(plan 40), 항목만 compact 스피너 (U-2 · U-10) */
export function QuickChatConversationList({
  filters,
  q,
  tab,
  range,
  selectedRequestNo,
  realtimeStatus,
  onSearchChange,
  onTabChange,
  onRangeChange,
  onSelect,
  className
}: QuickChatConversationListProps) {
  const [searchInput, setSearchInput] = useState(q ?? '');
  const [lastQ, setLastQ] = useState(q);
  // 캐시 구독만 (조회는 본문 useSuspenseInfiniteQuery) — totals는 첫 페이지에만 · tab 무관이라 현재 필터 캐시에서 읽는다
  const { data } = useInfiniteQuery({
    ...quickRequestConversationsInfiniteQueryOptions(filters),
    enabled: false
  });

  if (lastQ !== q) {
    setLastQ(q);
    if ((q ?? '') !== searchInput.trim()) {
      setSearchInput(q ?? '');
    }
  }

  const debouncedSearch = useDebouncedCallback((value: string) => {
    onSearchChange(value.trim() ? value.trim() : null);
  }, SEARCH_DEBOUNCE_MS);

  const totals = data?.pages[0]?.totals;

  return (
    <aside
      aria-label={QUICK_CHAT_TEXT.listAriaLabel}
      className={cn('min-h-0 min-w-0 flex-col rounded-xl border bg-card', className)}
    >
      <div className='shrink-0 px-4 pt-4 pb-3'>
        <div className='flex items-center justify-between gap-2'>
          <h2 className='text-sm font-semibold'>{QUICK_CHAT_TEXT.listTitle}</h2>
          <RealtimeStatusBadge status={realtimeStatus} />
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
      <QuickRangeFilter
        value={range}
        onChange={onRangeChange}
        size='sm'
        testIdPrefix='quick-chat'
        labelPlacement='below'
        className='shrink-0 px-4 pb-2'
      />
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
