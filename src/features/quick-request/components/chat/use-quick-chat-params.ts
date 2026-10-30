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
import { QUICK_CHAT_PATH } from '../../lib/quick-mobile-routes';
import { useQuickBack } from '../mobile/use-quick-back';

const quickChatParsers = {
  /** 선택 건 — `history: 'push'`라 브라우저 뒤로가기가 목록으로 돌아간다 (AC-03) */
  request: parseAsString.withOptions({ history: 'push' }),
  q: parseAsString,
  tab: parseAsStringLiteral(QUICK_CHAT_CONVERSATION_TABS).withDefault('all'),
  ...quickRangeParsers
};

/**
 * 대화방 「뒤로」 부모(바로 들어온 경우 replace 대상 · designer §7.1): 지금 URL에서 `request`만 뺀 대화 목록
 * (q·tab·range·from·to 유지). 클릭 시점에 계산한다.
 */
function quickChatListParentHref(): string {
  const params = new URLSearchParams(window.location.search);
  params.delete('request');
  const search = params.toString();
  return search ? `${QUICK_CHAT_PATH}?${search}` : QUICK_CHAT_PATH;
}

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
  /**
   * plan 106 D-5 · T5 — 대화방 닫기. `setRequest(null)`(push)은 [목록, 방, 목록]을 쌓아 폰 뒤로가기가 닫은 방을 다시 연다 →
   * 퀵 안 기록이 있으면 `router.back()`, 바로 들어온 방(알림·주소창)이면 목록으로 `replace` (`useQuickBack`).
   */
  const closeRequest = useQuickBack(quickChatListParentHref);
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

  return { request, q, tab, range, filters, setRequest, closeRequest, setQ, setTab, setRange };
}
