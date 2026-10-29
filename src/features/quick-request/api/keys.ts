import type { QuickChatViewerRole } from '../schemas/quick-request-chat';
import type {
  QuickRequestConversationsFilters,
  QuickRequestListFilters,
  QuickRequestRangeFilters,
  QuickRequestRecentAddressDirection
} from './types';

export const quickRequestKeys = {
  all: ['quick-request'] as const,
  notes: () => [...quickRequestKeys.all, 'notes'] as const,
  /** plan 97 — 최근 주소 전체 (invalidate 용) · direction별 무한 목록 */
  recentAddressesAll: () => [...quickRequestKeys.all, 'recent-addresses'] as const,
  recentAddresses: (direction: QuickRequestRecentAddressDirection) =>
    [...quickRequestKeys.recentAddressesAll(), direction] as const,
  /** plan 89/97 — 대시보드 카드 숫자 (status·search 무시 · 기간별) */
  summaries: () => [...quickRequestKeys.all, 'summary'] as const,
  summary: (filters: QuickRequestRangeFilters) => [...quickRequestKeys.summaries(), filters] as const,
  lists: () => [...quickRequestKeys.all, 'list'] as const,
  list: (filters: QuickRequestListFilters) => [...quickRequestKeys.lists(), filters] as const,
  details: () => [...quickRequestKeys.all, 'detail'] as const,
  detail: (requestNo: string) => [...quickRequestKeys.details(), requestNo] as const,
  /** plan 93/97 — 「퀵 대화」 목록 (q·tab·range · 무한 목록) */
  conversationsAll: () => [...quickRequestKeys.all, 'conversations'] as const,
  conversations: (filters: QuickRequestConversationsFilters) =>
    [...quickRequestKeys.conversationsAll(), filters] as const,
  /** plan 93 — 건별 대화 (Messenger·상세 공유 · Realtime merge 대상) */
  messagesAll: () => [...quickRequestKeys.all, 'messages'] as const,
  messages: (requestNo: string) => [...quickRequestKeys.messagesAll(), requestNo] as const,
  /** plan 93 — 사이드바 「퀵 대화」 배지 */
  unreadTotal: () => [...quickRequestKeys.all, 'unread-total'] as const,
  /** plan 101 D-2 — 초대 후보 검색 (요청 건 · 검색어별 · messages 키 밖) */
  participantCandidatesAll: () => [...quickRequestKeys.all, 'participant-candidates'] as const,
  participantCandidates: (requestNo: string, q: string) =>
    [...quickRequestKeys.participantCandidatesAll(), requestNo, q] as const,
  /** plan 99 — 「장소 검색」 (검색어별 무한 목록 · page 1~3) */
  places: (q: string) => [...quickRequestKeys.all, 'places', q] as const,
  /** plan 98 — 첨부 서명 URL(60초) · messages 키 밖에 두어 Realtime invalidate에 휩쓸리지 않는다 */
  attachmentUrls: () => [...quickRequestKeys.all, 'attachment-url'] as const,
  attachmentUrl: (requestNo: string, attachmentId: number) =>
    [...quickRequestKeys.attachmentUrls(), requestNo, attachmentId] as const,
  /** plan 100 D-7 — AI 답장 추천 (lastMessageId·role별 · staleTime Infinity) · messages 키 밖 = Realtime invalidate에 휩쓸리지 않는다 */
  aiSuggestionsAll: () => [...quickRequestKeys.all, 'ai-suggestions'] as const,
  aiSuggestions: (requestNo: string, lastMessageId: number, role: QuickChatViewerRole) =>
    [...quickRequestKeys.aiSuggestionsAll(), requestNo, lastMessageId, role] as const
};
