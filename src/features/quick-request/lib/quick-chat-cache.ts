import type { QueryClient } from '@tanstack/react-query';
import { quickRequestKeys } from '../api/keys';
import type { QuickRequestMessage, QuickRequestMessagesData } from '../api/types';

/**
 * plan 93 — `quickRequestKeys.messages(no)` 캐시 형태·merge 규칙 (mutations · Realtime · UI 공용).
 * 서버 행은 `id: number`(bigint identity), optimistic 임시 행은 `id: 'temp-{uuid}'`로 구분한다(AC-33).
 */

export const QUICK_CHAT_TEMP_ID_PREFIX = 'temp-';

export type QuickChatClientState = 'pending' | 'failed';

/** 캐시 안 메시지 — 서버 행 또는 optimistic 임시 행 */
export type QuickChatMessageItem = Omit<QuickRequestMessage, 'id'> & {
  id: number | string;
  clientState?: QuickChatClientState;
};

/** 캐시 형태 (서버 응답 + 임시 메시지) · 404는 null */
export type QuickChatMessagesCache = Omit<QuickRequestMessagesData, 'messages'> & {
  messages: QuickChatMessageItem[];
};

export function isTempMessageId(id: number | string): id is string {
  return typeof id === 'string';
}

export function createTempMessageId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${QUICK_CHAT_TEMP_ID_PREFIX}${uuid}`;
}

/** 서버 행끼리 id 오름차순, 임시 행은 뒤에 (작성 순 유지) */
export function sortChatMessages(messages: readonly QuickChatMessageItem[]): QuickChatMessageItem[] {
  const server = messages.filter((message) => !isTempMessageId(message.id));
  const temps = messages.filter((message) => isTempMessageId(message.id));
  server.sort((a, b) => (a.id as number) - (b.id as number));
  return [...server, ...temps];
}

/**
 * 서버 행 merge — 같은 id는 교체(dedupe), `replaceTempId` 또는 「내 pending 임시 행 + 같은 본문」은 그 임시 행을 교체
 * (Realtime INSERT가 POST 응답보다 먼저 와도 말풍선이 2개가 되지 않는다).
 */
export function mergeServerMessage(
  messages: readonly QuickChatMessageItem[],
  incoming: QuickRequestMessage,
  options: { myUserId: string; replaceTempId?: string | null }
): QuickChatMessageItem[] {
  let replaced = false;
  const next: QuickChatMessageItem[] = [];

  for (const message of messages) {
    if (message.id === incoming.id) {
      if (!replaced) {
        next.push({ ...incoming });
        replaced = true;
      }
      continue;
    }
    const matchesTemp =
      isTempMessageId(message.id) &&
      (message.id === options.replaceTempId ||
        (message.clientState === 'pending' &&
          incoming.authorUserId === options.myUserId &&
          message.authorUserId === options.myUserId &&
          message.body === incoming.body));
    if (matchesTemp) {
      if (!replaced) {
        next.push({ ...incoming });
        replaced = true;
      }
      continue;
    }
    next.push(message);
  }

  if (!replaced) {
    next.push({ ...incoming });
  }
  return sortChatMessages(next);
}

export function getMessagesCache(
  queryClient: QueryClient,
  requestNo: string
): QuickChatMessagesCache | null | undefined {
  return queryClient.getQueryData<QuickChatMessagesCache | null>(quickRequestKeys.messages(requestNo));
}

export function updateMessagesCache(
  queryClient: QueryClient,
  requestNo: string,
  updater: (current: QuickChatMessagesCache) => QuickChatMessagesCache
): void {
  queryClient.setQueryData<QuickChatMessagesCache | null>(quickRequestKeys.messages(requestNo), (current) =>
    current ? updater(current) : current
  );
}
