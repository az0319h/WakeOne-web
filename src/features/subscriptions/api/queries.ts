import { queryOptions } from '@tanstack/react-query';
import { assetLedgerKeys, subscriptionKeys } from './keys';
import { fetchAssigneeOptions, fetchSubscriptionDetail, fetchSubscriptions } from './service';
import type { SubscriptionFilters } from './types';

export { assetLedgerKeys, subscriptionKeys };

export function subscriptionListQueryOptions(filters: SubscriptionFilters = {}) {
  return queryOptions({
    queryKey: subscriptionKeys.list(filters),
    queryFn: () => fetchSubscriptions(filters)
  });
}

export function subscriptionDetailQueryOptions(id: number) {
  return queryOptions({
    queryKey: subscriptionKeys.detail(id),
    queryFn: () => fetchSubscriptionDetail(id)
  });
}

/** 권한자 전용 — 직원 화면에서는 `enabled: false`로 쓴다(403) */
export function assigneeOptionsQueryOptions() {
  return queryOptions({
    queryKey: assetLedgerKeys.assigneeOptions,
    queryFn: fetchAssigneeOptions,
    staleTime: 60_000
  });
}
