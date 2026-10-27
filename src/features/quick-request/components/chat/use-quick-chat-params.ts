'use client';

import { useMemo } from 'react';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import {
  QUICK_CHAT_CONVERSATION_TABS,
  type QuickChatConversationTab
} from '../../schemas/quick-request-chat';
import type { QuickRequestConversationsFilters } from '../../api/types';

const quickChatParsers = {
  /** 선택 건 — `history: 'push'`라 브라우저 뒤로가기가 목록으로 돌아간다 (AC-03) */
  request: parseAsString.withOptions({ history: 'push' }),
  q: parseAsString,
  tab: parseAsStringLiteral(QUICK_CHAT_CONVERSATION_TABS).withDefault('all')
};

/** plan 93 — 「퀵 대화」 URL 상태 (`request` · `q` · `tab`) · nuqs shallow */
export function useQuickChatParams() {
  const [params, setParams] = useQueryStates(quickChatParsers, { shallow: true, throttleMs: 50 });

  const request = params.request?.trim() ? params.request.trim() : null;
  const q = params.q?.trim() ? params.q.trim() : null;
  const tab: QuickChatConversationTab = params.tab;

  const filters = useMemo<QuickRequestConversationsFilters>(() => ({ q, tab }), [q, tab]);

  const setRequest = (next: string | null) => void setParams({ request: next });
  const setQ = (next: string | null) => void setParams({ q: next }, { history: 'replace' });
  const setTab = (next: QuickChatConversationTab) =>
    void setParams({ tab: next === 'all' ? null : next }, { history: 'replace' });

  return { request, q, tab, filters, setRequest, setQ, setTab };
}
