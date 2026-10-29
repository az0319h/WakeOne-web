import { toSearchParams } from '@/features/asset-ledger/api/filter-utils';
import type {
  AssigneeOptionsApiResponse,
  AssigneeOptionsResponse
} from '@/features/asset-ledger/api/types';
import { apiClientWithMessage } from '@/lib/api-client';
import type {
  SubscriptionDeleteResponse,
  SubscriptionDetailApiResponse,
  SubscriptionDetailResponse,
  SubscriptionFilters,
  SubscriptionListApiResponse,
  SubscriptionListResponse,
  SubscriptionMutationResponse,
  SubscriptionPayload
} from './types';

/**
 * plan 103 — 구독 API 클라이언트 (컴포넌트는 이 파일·queries·mutations만 쓴다).
 * 직원 화면에서는 `card` 필터를 보내지 않는다(403 방지 · 권한자 전용).
 */

export function serializeSubscriptionFilters(filters: SubscriptionFilters): URLSearchParams {
  return toSearchParams({
    category: filters.category && filters.category !== 'all' ? filters.category : undefined,
    scope: filters.scope && filters.scope !== 'all' ? filters.scope : undefined,
    status: filters.status,
    card: filters.card,
    q: filters.q?.trim(),
    page: filters.page && filters.page > 1 ? filters.page : undefined,
    perPage: filters.perPage,
    sort: filters.sort && filters.sort !== 'default' ? filters.sort : undefined
  });
}

export async function fetchSubscriptions(filters: SubscriptionFilters = {}): Promise<SubscriptionListResponse> {
  const query = serializeSubscriptionFilters(filters).toString();
  const response = await apiClientWithMessage<SubscriptionListApiResponse>(
    `/subscriptions${query ? `?${query}` : ''}`
  );
  return response.data;
}

export async function fetchSubscriptionDetail(id: number): Promise<SubscriptionDetailResponse> {
  const response = await apiClientWithMessage<SubscriptionDetailApiResponse>(`/subscriptions/${id}`);
  return response.data;
}

export function createSubscription(payload: SubscriptionPayload) {
  return apiClientWithMessage<SubscriptionMutationResponse>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateSubscription(id: number, payload: Partial<SubscriptionPayload>) {
  return apiClientWithMessage<SubscriptionMutationResponse>(`/subscriptions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function deleteSubscription(id: number) {
  return apiClientWithMessage<SubscriptionDeleteResponse>(`/subscriptions/${id}`, { method: 'DELETE' });
}

/** 권한자 전용 — 대상자 피커 · 담당자 변경 후보(managers) */
export async function fetchAssigneeOptions(): Promise<AssigneeOptionsResponse> {
  const response = await apiClientWithMessage<AssigneeOptionsApiResponse>('/asset-ledger/assignee-options');
  return response.data;
}
