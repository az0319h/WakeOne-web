'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getKstTodayDateString } from '@/lib/kst';
import { quickChatAiSuggestionsQueryOptions } from '../../api/queries';
import type { QuickChatAiSuggestResult } from '../../api/types';
import { isTempMessageId, type QuickChatMessageItem } from '../../lib/quick-chat-cache';
import { QUICK_CHAT_AI_DAILY_LIMIT, type QuickChatViewerRole } from '../../schemas/quick-request-chat';
import {
  QUICK_CHAT_AI_DEBOUNCE_MS,
  QUICK_CHAT_AI_LIMIT_STORAGE_PREFIX,
  QUICK_CHAT_AI_STORAGE_PREFIX
} from './quick-chat-constants';
import { useDocumentVisible } from './use-document-visible';

/**
 * designer §3 상태
 * - `off`: env OFF 또는 쓰기 권한 없음 (`aiSuggest.enabled=false`) → 호출 0
 * - `idle`: 메시지 0 · 마지막이 내 메시지/전송 중 임시 행 · 탭 숨김(호출 전) · 오늘 한도 소진 → 규칙 칩
 * - `loading`: 1초 debounce 대기 또는 호출 중 → 규칙 칩 + (300ms 뒤) 오른쪽 스피너
 * - `ready`: 200 `source:'ai'` → AI 4개 + 「AI 추천」 배지
 * - `fallback`: 200 rules · 409 · 429 · 502 · 503 · 네트워크 → 규칙 칩 (토스트 0)
 */
export type QuickChatAiState = 'off' | 'idle' | 'loading' | 'ready' | 'fallback';

export type QuickChatAiSuggestions =
  | { state: 'ready'; suggestions: string[] }
  | { state: Exclude<QuickChatAiState, 'ready'>; suggestions: null };

type UseAiSuggestionsParams = {
  requestNo: string;
  /** `GET …/messages` `aiSuggest.enabled` (env ON && canWrite) */
  enabled: boolean;
  canWrite: boolean;
  role: QuickChatViewerRole;
  viewerUserId: string;
  /** 캐시 메시지 (서버 행 오름차순 + 임시 행 뒤) */
  messages: readonly QuickChatMessageItem[];
};

const OFF: QuickChatAiSuggestions = { state: 'off', suggestions: null };
const IDLE: QuickChatAiSuggestions = { state: 'idle', suggestions: null };
const LOADING: QuickChatAiSuggestions = { state: 'loading', suggestions: null };
const FALLBACK: QuickChatAiSuggestions = { state: 'fallback', suggestions: null };

/** 추천 대상 = 마지막 메시지가 서버 행이고 남이 보낸 것 (D-2 ③). 서버도 같은 조건을 409로 검증한다 */
function resolveCandidateId(messages: readonly QuickChatMessageItem[], viewerUserId: string): number | null {
  const last = messages[messages.length - 1];
  if (!last || isTempMessageId(last.id) || last.authorUserId === viewerUserId) {
    return null;
  }
  return last.id;
}

// ---------------------------------------------------------------------------
// sessionStorage — 모든 접근은 try/catch (사파리 개인 모드·차단·SSR에서도 동작은 그대로)
// ---------------------------------------------------------------------------

/** 건별 최신 1건 (designer §10 ⑥) */
type StoredAiSuggestion = {
  lastMessageId: number;
  role: QuickChatViewerRole;
  source: QuickChatAiSuggestResult['source'];
  suggestions: string[];
  usage?: { count: number; limit: number };
};

function suggestionStorageKey(requestNo: string): string {
  return `${QUICK_CHAT_AI_STORAGE_PREFIX}${requestNo}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function readStoredSuggestion(
  requestNo: string,
  lastMessageId: number,
  role: QuickChatViewerRole
): QuickChatAiSuggestResult | undefined {
  try {
    const raw = window.sessionStorage.getItem(suggestionStorageKey(requestNo));
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as Partial<StoredAiSuggestion> | null;
    if (!stored || stored.lastMessageId !== lastMessageId || stored.role !== role) {
      return undefined;
    }
    if (stored.source === 'ai' && isStringArray(stored.suggestions) && stored.suggestions.length > 0) {
      return {
        source: 'ai',
        lastMessageId,
        suggestions: stored.suggestions,
        usage: stored.usage ?? { count: 0, limit: QUICK_CHAT_AI_DAILY_LIMIT }
      };
    }
    if (stored.source === 'rules') {
      return { source: 'rules', lastMessageId, reason: 'no_ai' };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 200 응답만 저장 (`ai` · AI 문장 0개였던 `no_ai`). 409·429·502·503·네트워크 실패는 저장하지 않는다 —
 * 새로고침하면 다시 시도할 수 있고, 한도는 아래 날짜 플래그가 따로 막는다.
 */
function writeStoredSuggestion(requestNo: string, role: QuickChatViewerRole, result: QuickChatAiSuggestResult) {
  const stored: StoredAiSuggestion =
    result.source === 'ai'
      ? {
          lastMessageId: result.lastMessageId,
          role,
          source: 'ai',
          suggestions: result.suggestions,
          usage: result.usage
        }
      : { lastMessageId: result.lastMessageId, role, source: 'rules', suggestions: [] };
  try {
    window.sessionStorage.setItem(suggestionStorageKey(requestNo), JSON.stringify(stored));
  } catch {
    // 저장 실패 — 메모리 캐시(React Query)만으로 동작
  }
}

function limitStorageKey(day: string): string {
  return `${QUICK_CHAT_AI_LIMIT_STORAGE_PREFIX}${day}`;
}

/** 429를 받은 KST 날짜 — 렌더마다 storage를 읽지 않도록 탭(모듈) 단위로 한 번만 읽는다. `undefined` = 아직 안 읽음 */
let limitedDayCache: string | null | undefined;

function isLimitedToday(): boolean {
  if (typeof window === 'undefined') return false;
  if (limitedDayCache === undefined) {
    try {
      const today = getKstTodayDateString();
      limitedDayCache = window.sessionStorage.getItem(limitStorageKey(today)) ? today : null;
    } catch {
      limitedDayCache = null;
    }
  }
  return limitedDayCache !== null && limitedDayCache === getKstTodayDateString();
}

function markLimitedToday() {
  try {
    const today = getKstTodayDateString();
    limitedDayCache = today;
    window.sessionStorage.setItem(limitStorageKey(today), '1');
  } catch {
    // storage 실패 — 모듈 캐시만으로 이 탭에서는 막힌다
  }
}

/** D-2 — 같은 후보가 1초 동안 유지되면 확정 (상대 연속 메시지 묶기 · 대화를 처음 열 때도 1초 뒤) */
function useSettledCandidate(candidateId: number | null): number | null {
  const [settledId, setSettledId] = useState<number | null>(null);

  useEffect(() => {
    if (candidateId === null) return;
    const timer = setTimeout(() => setSettledId(candidateId), QUICK_CHAT_AI_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [candidateId]);

  return settledId;
}

/**
 * plan 100 D-2·D-7·D-8 — 빠른 답장 칩 AI 추천 호출 조건 + 상태.
 * 호출 조건: enabled && canWrite · 마지막 메시지가 서버 행이고 남의 것 · 그 id가 1초 유지 · 탭 visible · 오늘 한도 플래그 없음.
 * 같은 (requestNo, lastMessageId, role)은 React Query 캐시(`staleTime: Infinity`) + sessionStorage 1건(같은 탭 새로고침)으로 재호출 0.
 * 실패·한도·OFF는 조용히 규칙 칩 (토스트 0).
 */
export function useAiSuggestions({
  requestNo,
  enabled,
  canWrite,
  role,
  viewerUserId,
  messages
}: UseAiSuggestionsParams): QuickChatAiSuggestions {
  const active = enabled && canWrite;
  const candidateId = active ? resolveCandidateId(messages, viewerUserId) : null;
  const settledId = useSettledCandidate(candidateId);
  const visible = useDocumentVisible();
  const limited = candidateId !== null && isLimitedToday();

  // 후보가 없으면 id 0(서버 id는 양의 정수라 겹치지 않음) 키로 두고 호출하지 않는다
  const query = useQuery({
    ...quickChatAiSuggestionsQueryOptions(requestNo, candidateId ?? 0, role),
    enabled: candidateId !== null && settledId === candidateId && visible && !limited,
    initialData: () =>
      candidateId === null ? undefined : readStoredSuggestion(requestNo, candidateId, role)
  });
  const data = candidateId === null ? undefined : query.data;

  // 외부 저장소 동기화 — 200은 다음 새로고침용으로 저장, 429는 오늘 날짜 플래그
  useEffect(() => {
    if (!data) return;
    if (data.source === 'ai' || data.reason === 'no_ai') {
      writeStoredSuggestion(requestNo, role, data);
    } else if (data.reason === 'limit') {
      markLimitedToday();
    }
  }, [data, requestNo, role]);

  if (!active) return OFF;
  if (candidateId === null) return IDLE;
  if (data) {
    return data.source === 'ai' && data.suggestions.length > 0
      ? { state: 'ready', suggestions: data.suggestions }
      : FALLBACK;
  }
  if (query.isError) return FALLBACK;
  if (limited || !visible) return IDLE;
  return LOADING;
}
