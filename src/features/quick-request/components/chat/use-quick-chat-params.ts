'use client';

import { useCallback, useMemo } from 'react';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import {
  QUICK_CHAT_CONVERSATION_TABS,
  type QuickChatConversationTab
} from '../../schemas/quick-request-chat';
import type { QuickRequestConversationsFilters } from '../../api/types';
import {
  normalizeQuickRangeParams,
  quickRangeParsers,
  toQuickRangeParams,
  type QuickRangeValue
} from '../../lib/quick-range-search-params';

const quickChatParsers = {
  /** 선택 건 — `history: 'push'`라 브라우저 뒤로가기가 목록으로 돌아간다 (AC-03) */
  request: parseAsString.withOptions({ history: 'push' }),
  q: parseAsString,
  tab: parseAsStringLiteral(QUICK_CHAT_CONVERSATION_TABS).withDefault('all'),
  ...quickRangeParsers
};

/** plan 93/97 — 「퀵 대화」 URL 상태 (`request` · `q` · `tab` · `range`/`from`/`to`) · nuqs shallow */
export function useQuickChatParams() {
  const [params, setParams] = useQueryStates(quickChatParsers, { shallow: true, throttleMs: 50 });

  const request = params.request?.trim() ? params.request.trim() : null;
  const q = params.q?.trim() ? params.q.trim() : null;
  const tab: QuickChatConversationTab = params.tab;
  const { range: rangeParam, from: fromParam, to: toParam } = params;
  const range = useMemo<QuickRangeValue>(
    () => normalizeQuickRangeParams({ range: rangeParam, from: fromParam, to: toParam }),
    [fromParam, rangeParam, toParam]
  );

  const filters = useMemo<QuickRequestConversationsFilters>(
    () => ({ q, tab, range: range.range, from: range.from, to: range.to }),
    [q, tab, range]
  );

  const setRequest = useCallback((next: string | null) => void setParams({ request: next }), [setParams]);
  const setQ = useCallback(
    (next: string | null) => void setParams({ q: next }, { history: 'replace' }),
    [setParams]
  );
  const setTab = useCallback(
    (next: QuickChatConversationTab) =>
      void setParams({ tab: next === 'all' ? null : next }, { history: 'replace' }),
    [setParams]
  );
  const setRange = useCallback(
    (next: QuickRangeValue) => void setParams(toQuickRangeParams(next), { history: 'replace' }),
    [setParams]
  );

  return { request, q, tab, range, filters, setRequest, setQ, setTab, setRange };
}
