import type { QueryClient } from '@tanstack/react-query';
import { quickRequestKeys } from '../api/keys';
import type {
  QuickRequestMessage,
  QuickRequestMessageAttachment,
  QuickRequestMessagesData
} from '../api/types';

/**
 * plan 93 — `quickRequestKeys.messages(no)` 캐시 형태·merge 규칙 (mutations · Realtime · UI 공용).
 * 서버 행은 `id: number`(bigint identity), optimistic 임시 행은 `id: 'temp-{uuid}'`로 구분한다(AC-33).
 * plan 98 — 임시 행의 첨부는 `previewUrl`(ObjectURL · 이미지만)을 들고 있다가 201 교체 후 revoke한다.
 */

export const QUICK_CHAT_TEMP_ID_PREFIX = 'temp-';

export type QuickChatClientState = 'pending' | 'failed';

/** 캐시 안 첨부 — 서버 행 또는 optimistic 임시 행(`previewUrl` = ObjectURL 썸네일) */
export type QuickChatAttachmentItem = QuickRequestMessageAttachment & {
  previewUrl?: string;
};

/** 캐시 안 메시지 — 서버 행 또는 optimistic 임시 행 */
export type QuickChatMessageItem = Omit<QuickRequestMessage, 'id' | 'attachments'> & {
  id: number | string;
  attachments: QuickChatAttachmentItem[];
  clientState?: QuickChatClientState;
};

/** 본문 + 첨부 id 목록 — 임시 행 dedupe 키 (본문 `''` 첨부 메시지가 여러 개여도 오판하지 않는다) */
export function chatMessageDedupeKey(message: {
  body: string;
  attachments: readonly { id: number }[];
}): string {
  return `${message.body}\u0000${message.attachments.map((attachment) => attachment.id).join(',')}`;
}

/**
 * 캐시 형태 (서버 응답 + 임시 메시지) · 404는 null.
 * plan 101 — `participants`·`events`는 서버 응답을 그대로 통과(merge 시 `...incoming`이 서버 값 우선 · 임시 행 없음).
 */
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
          chatMessageDedupeKey(message) === chatMessageDedupeKey(incoming)));
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

/**
 * plan 94 — refetch(Realtime invalidate · polling) 결과와 캐시 merge (`quickRequestMessagesQueryOptions.structuralSharing`).
 * 서버 응답이 기준이되, 캐시의 optimistic 임시 행은 보존한다: 내 `pending` 임시 행과 같은 본문의 서버 행이 왔으면
 * 임시 행을 버리고(dedupe · POST 응답보다 refetch가 먼저 와도 말풍선 2개가 되지 않는다), `failed`·아직 안 온 pending은 남긴다.
 */
export function mergeRefetchedMessages(
  current: QuickChatMessagesCache | null | undefined,
  incoming: QuickRequestMessagesData
): QuickChatMessagesCache {
  if (!current) {
    return incoming;
  }
  const myServerKeys = new Set(
    incoming.messages
      .filter((message) => message.authorUserId === incoming.viewer.userId)
      .map((message) => chatMessageDedupeKey(message))
  );
  const keptTemps = current.messages.filter((message) => {
    if (!isTempMessageId(message.id)) return false;
    if (message.clientState === 'pending' && myServerKeys.has(chatMessageDedupeKey(message))) return false;
    return true;
  });
  return {
    ...incoming,
    myLastReadMessageId: Math.max(current.myLastReadMessageId, incoming.myLastReadMessageId),
    messages: sortChatMessages([...incoming.messages, ...keptTemps])
  };
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
