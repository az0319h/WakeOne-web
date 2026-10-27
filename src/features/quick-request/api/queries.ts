import { queryOptions } from '@tanstack/react-query';
import { quickRequestKeys } from './keys';
import {
  fetchQuickRequestConversations,
  fetchQuickRequestDetail,
  fetchQuickRequestList,
  fetchQuickRequestMessages,
  fetchQuickRequestNotes,
  fetchQuickRequestRecentAddresses,
  fetchQuickRequestSummary,
  fetchQuickRequestUnreadTotal
} from './service';
import type { QuickRequestConversationsFilters, QuickRequestListFilters } from './types';

export { quickRequestKeys };

export function quickRequestNotesQueryOptions() {
  return queryOptions({
    queryKey: quickRequestKeys.notes(),
    queryFn: () => fetchQuickRequestNotes()
  });
}

export function quickRequestRecentAddressesQueryOptions() {
  return queryOptions({
    queryKey: quickRequestKeys.recentAddresses(),
    queryFn: () => fetchQuickRequestRecentAddresses()
  });
}

// plan 89 — 퀵 대시보드·상세

/** 카드 숫자 — 목록 Suspense 밖에서 non-suspense `useQuery`로 읽는다 (designer K5) */
export function quickRequestSummaryQueryOptions() {
  return queryOptions({
    queryKey: quickRequestKeys.summary(),
    queryFn: () => fetchQuickRequestSummary()
  });
}

export function quickRequestListQueryOptions(filters: QuickRequestListFilters) {
  return queryOptions({
    queryKey: quickRequestKeys.list(filters),
    queryFn: () => fetchQuickRequestList(filters)
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

export function quickRequestConversationsQueryOptions(filters: QuickRequestConversationsFilters) {
  return queryOptions({
    queryKey: quickRequestKeys.conversations(filters),
    queryFn: () => fetchQuickRequestConversations(filters)
  });
}

/** 404(권한 없음 포함)는 `null` → 「대화를 찾을 수 없습니다.」 */
export function quickRequestMessagesQueryOptions(requestNo: string) {
  return queryOptions({
    queryKey: quickRequestKeys.messages(requestNo),
    queryFn: () => fetchQuickRequestMessages(requestNo)
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
