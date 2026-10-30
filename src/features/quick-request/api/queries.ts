import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { getMessagesCache, mergeRefetchedMessages } from '../lib/quick-chat-cache';
import { QUICK_PLACE_MAX_PAGE } from '../schemas/quick-request-place';
import { quickRequestKeys } from './keys';
import {
  fetchQuickRequestConversations,
  fetchQuickRequestDetail,
  fetchQuickRequestList,
  fetchQuickRequestMessages,
  fetchQuickRequestNotes,
  fetchQuickRequestParticipantCandidates,
  fetchQuickRequestPlaces,
  fetchQuickRequestRecentAddresses,
  fetchQuickRequestSummary,
  fetchQuickRequestUnreadTotal,
  getQuickChatAttachmentUrl,
  suggestQuickChatReplies
} from './service';
import type { QuickChatViewerRole } from '../schemas/quick-request-chat';
import type {
  QuickRequestConversationsFilters,
  QuickRequestListFilters,
  QuickRequestMessagesData,
  QuickRequestRangeFilters,
  QuickRequestRecentAddressDirection
} from './types';

export { quickRequestKeys };

export function quickRequestNotesQueryOptions() {
  return queryOptions({
    queryKey: quickRequestKeys.notes(),
    queryFn: () => fetchQuickRequestNotes()
  });
}

/** plan 97 D-9 — direction별 무한 목록 (10건 · `nextCursor`) */
export function quickRequestRecentAddressesInfiniteQueryOptions(direction: QuickRequestRecentAddressDirection) {
  return infiniteQueryOptions({
    queryKey: quickRequestKeys.recentAddresses(direction),
    queryFn: ({ pageParam }) => fetchQuickRequestRecentAddresses(direction, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });
}

/**
 * plan 99 — 「장소 검색」 탭 (서버 프록시 · 15건 × 최대 3페이지). 검색어가 계속 바뀌는 목록이라
 * 소비처가 non-suspense `useInfiniteQuery` + `enabled: q.length >= 2`로 읽는다 (designer K7).
 * 502·429에서 자동 재시도는 외부 쿼터만 소모하므로 `retry: false` · 같은 검색어 60초 재호출 억제.
 */
export function quickRequestPlacesInfiniteQueryOptions(q: string) {
  return infiniteQueryOptions({
    queryKey: quickRequestKeys.places(q),
    queryFn: ({ pageParam }) => fetchQuickRequestPlaces(q, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.isEnd || lastPage.page >= QUICK_PLACE_MAX_PAGE ? undefined : lastPage.page + 1,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false
  });
}

// plan 89 — 퀵 대시보드·상세

/** 카드 숫자 — 목록 Suspense 밖에서 non-suspense `useQuery`로 읽는다 (designer K5 · plan 97 기간별) */
export function quickRequestSummaryQueryOptions(filters: QuickRequestRangeFilters = {}) {
  return queryOptions({
    queryKey: quickRequestKeys.summary(filters),
    queryFn: () => fetchQuickRequestSummary(filters)
  });
}

export function quickRequestListQueryOptions(filters: QuickRequestListFilters) {
  return queryOptions({
    queryKey: quickRequestKeys.list(filters),
    queryFn: () => fetchQuickRequestList(filters)
  });
}

/** plan 106 D-9 — 휴대폰 퀵 내역 한 번에 불러오는 건수 */
export const QUICK_REQUEST_LIST_INFINITE_PAGE_SIZE = 20;

/** 휴대폰 무한 목록 필터 — URL `page`/`perPage`는 쓰지 않는다 (plan 106 D-9) */
export type QuickRequestListInfiniteFilters = Omit<QuickRequestListFilters, 'page' | 'limit'>;

/**
 * plan 106 D-9 · designer §3.10 — 휴대폰(lg 미만) 퀵 내역 20건씩 자동 추가 로드.
 * 기존 `GET /api/quick-request?page&perPage=20`을 page 번호로 이어 부른다(BE 변경 없음).
 * 키는 `lists()` 아래 → Realtime·mutation의 `lists()` invalidate가 불러온 페이지 전부를 다시 받는다(새 건이 맨 위).
 */
export function quickRequestListInfiniteQueryOptions(filters: QuickRequestListInfiniteFilters) {
  return infiniteQueryOptions({
    queryKey: [...quickRequestKeys.lists(), 'infinite', filters] as const,
    queryFn: ({ pageParam }) =>
      fetchQuickRequestList({
        ...filters,
        page: pageParam,
        limit: QUICK_REQUEST_LIST_INFINITE_PAGE_SIZE
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined
  });
}

/** 404(권한 없음 포함)는 `null` (designer K6) */
export function quickRequestDetailQueryOptions(requestNo: string) {
  return queryOptions({
    queryKey: quickRequestKeys.detail(requestNo),
    queryFn: () => fetchQuickRequestDetail(requestNo)
  });
}

// plan 93 — 퀵 대화

/** plan 97 D-5 — 커서 무한 목록 (20건). `totals`는 `pages[0].totals` */
export function quickRequestConversationsInfiniteQueryOptions(filters: QuickRequestConversationsFilters) {
  return infiniteQueryOptions({
    queryKey: quickRequestKeys.conversations(filters),
    queryFn: ({ pageParam }) => fetchQuickRequestConversations(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });
}

/**
 * 404(권한 없음 포함)는 `null` → 「대화를 찾을 수 없습니다.」
 * plan 94 — Realtime invalidate·polling refetch가 optimistic 임시 행(pending·failed)을 지우지 않도록 `queryFn`에서
 * 현재 캐시와 merge한다(`mergeRefetchedMessages` · 서버 id dedupe). `structuralSharing`은 `setQueryData`에도 적용돼
 * discard·retry 교체를 되돌리므로 쓰지 않는다. 이 query는 클라이언트에서만 조회한다(서버 prefetch 없음).
 */
export function quickRequestMessagesQueryOptions(requestNo: string) {
  const queryKey = quickRequestKeys.messages(requestNo);
  return queryOptions({
    queryKey,
    queryFn: async (): Promise<QuickRequestMessagesData | null> => {
      const fresh = await fetchQuickRequestMessages(requestNo);
      if (!fresh) {
        return null;
      }
      // 캐시 형태는 임시 행(id `temp-…`)을 포함하는 `QuickChatMessagesCache` — 소비처(`ConversationContent`)가 그 타입으로 읽는다
      return mergeRefetchedMessages(
        getMessagesCache(getQueryClient(), requestNo),
        fresh
      ) as QuickRequestMessagesData;
    }
  });
}

/**
 * plan 98 — 이미지 타일 서명 URL (60초 만료 · `staleTime 50s`). 타일마다 지연 조회하므로 non-suspense `useQuery`
 * (designer §6 · 타일 단위 suspend는 말풍선 전체를 가린다). 만료·403이면 타일이 invalidate 1회.
 */
export function quickRequestAttachmentUrlQueryOptions(requestNo: string, attachmentId: number) {
  return queryOptions({
    queryKey: quickRequestKeys.attachmentUrl(requestNo, attachmentId),
    queryFn: () => getQuickChatAttachmentUrl(requestNo, attachmentId),
    staleTime: 50_000,
    gcTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false
  });
}

/**
 * plan 101 D-2 — 초대 후보 검색 (Combobox · 300ms debounce 뒤 호출). 소비처가 `enabled: q.length > 0` ·
 * `placeholderData: keepPreviousData`로 재검색 중 이전 결과를 유지한다 (designer §4). 403은 Command 안 destructive 텍스트.
 */
export function quickRequestParticipantCandidatesQueryOptions(requestNo: string, q: string) {
  return queryOptions({
    queryKey: quickRequestKeys.participantCandidates(requestNo, q),
    queryFn: () => fetchQuickRequestParticipantCandidates(requestNo, q),
    staleTime: 10_000,
    retry: false,
    refetchOnWindowFocus: false
  });
}

/**
 * plan 100 D-7 — AI 답장 추천 (그 건의 마지막 메시지 id · 보는 사람 역할별 1회). 외부 AI 호출(비용 · 하루 100회)이라
 * 같은 메시지에는 다시 부르지 않는다: `staleTime: Infinity` · 재시도·포커스/재연결/마운트 refetch 0.
 * `suggestQuickChatReplies`는 abort 외에는 throw하지 않고 `{ source:'rules', reason }`을 돌려준다(에러 상태 → 재마운트 재요청 방지).
 * 칩 줄을 가리면 안 되므로 소비처(`use-ai-suggestions.ts`)는 non-suspense `useQuery` + `enabled`(호출 조건 D-2)로 읽는다 (designer §10).
 * 키는 `messages` 밖이라 Realtime invalidate에 휩쓸리지 않는다.
 */
export function quickChatAiSuggestionsQueryOptions(
  requestNo: string,
  lastMessageId: number,
  role: QuickChatViewerRole
) {
  return queryOptions({
    queryKey: quickRequestKeys.aiSuggestions(requestNo, lastMessageId, role),
    queryFn: ({ signal }) => suggestQuickChatReplies(requestNo, lastMessageId, signal),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  });
}

/** 사이드바 배지 — non-suspense `useQuery` (staleTime 30s · refetchOnWindowFocus) */
export function quickRequestUnreadTotalQueryOptions() {
  return queryOptions({
    queryKey: quickRequestKeys.unreadTotal(),
    queryFn: () => fetchQuickRequestUnreadTotal(),
    staleTime: 30_000,
    refetchOnWindowFocus: true
  });
}
