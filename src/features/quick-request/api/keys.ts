import type { QuickRequestConversationsFilters, QuickRequestListFilters } from './types';

export const quickRequestKeys = {
  all: ['quick-request'] as const,
  notes: () => [...quickRequestKeys.all, 'notes'] as const,
  recentAddresses: () => [...quickRequestKeys.all, 'recent-addresses'] as const,
  /** plan 89 — 대시보드 카드 숫자 (status·search 무시) */
  summary: () => [...quickRequestKeys.all, 'summary'] as const,
  lists: () => [...quickRequestKeys.all, 'list'] as const,
  list: (filters: QuickRequestListFilters) => [...quickRequestKeys.lists(), filters] as const,
  details: () => [...quickRequestKeys.all, 'detail'] as const,
  detail: (requestNo: string) => [...quickRequestKeys.details(), requestNo] as const,
  /** plan 93 — 「퀵 대화」 목록 (q·tab) */
  conversationsAll: () => [...quickRequestKeys.all, 'conversations'] as const,
  conversations: (filters: QuickRequestConversationsFilters) =>
    [...quickRequestKeys.conversationsAll(), filters] as const,
  /** plan 93 — 건별 대화 (Messenger·상세 공유 · Realtime merge 대상) */
  messagesAll: () => [...quickRequestKeys.all, 'messages'] as const,
  messages: (requestNo: string) => [...quickRequestKeys.messagesAll(), requestNo] as const,
  /** plan 93 — 사이드바 「퀵 대화」 배지 */
  unreadTotal: () => [...quickRequestKeys.all, 'unread-total'] as const
};
