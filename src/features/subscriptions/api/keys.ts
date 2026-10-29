import type { SubscriptionFilters } from './types';

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  lists: () => [...subscriptionKeys.all, 'list'] as const,
  list: (filters: SubscriptionFilters) => [...subscriptionKeys.lists(), filters] as const,
  details: () => [...subscriptionKeys.all, 'detail'] as const,
  detail: (id: number) => [...subscriptionKeys.details(), id] as const
};

/** 대상자·담당자 후보 (권한자 전용 · 구독·비품 공용) */
export const assetLedgerKeys = {
  assigneeOptions: ['asset-ledger', 'assignee-options'] as const
};
