import type { AssetOpenRequests, AssigneeView } from '@/features/asset-ledger/api/types';
import type {
  BillingCycle,
  PayerEntity,
  SubscriptionCategory,
  SubscriptionCurrency,
  SubscriptionItem,
  SubscriptionManagerItem,
  SubscriptionPublicItem,
  SubscriptionStatus
} from './types';

/**
 * plan 103 — 구독 역할별 칸 투영 (**허용 목록 방식** · 목록·단건·POST/PATCH 응답이 모두 이 함수만 쓴다).
 * 일반 직원 응답에는 결제·카드·주계정·관리 메모 **키 자체가 없다**(AC-06). 새 민감 칸을 추가해도
 * public 쪽은 키를 명시적으로 고르므로 자동으로 새지 않는다. (순수 함수 · `node --test`)
 */

/** DB 행 (service role select 결과 · import_key 등 비공개 칸은 여기서 버려진다) */
export type SubscriptionRecord = {
  id: number;
  category: SubscriptionCategory;
  name: string;
  plan_name: string | null;
  purpose: string | null;
  status: SubscriptionStatus;
  expires_on: string | null;
  payer_entity: PayerEntity | null;
  card_last4: string | null;
  billing_cycle: BillingCycle | null;
  billing_day: number | null;
  billing_date: string | null;
  amount: number | string | null;
  currency: SubscriptionCurrency | null;
  amount_varies: boolean;
  started_on: string | null;
  owner_account: string | null;
  manager_memo: string | null;
  source: 'excel_import' | 'manual' | 'e2e';
  created_at: string;
  updated_at: string;
};

export type SubscriptionProjectionExtras = {
  assignees: AssigneeView[];
  open_requests: AssetOpenRequests | null;
  /** 전체 요청 수 — 권한자 투영에만 들어간다 */
  request_count: number;
};

/** 일반 직원 응답 키 (AC-06 판정용 상수) */
export const SUBSCRIPTION_PUBLIC_KEYS = [
  'id',
  'category',
  'name',
  'plan_name',
  'purpose',
  'status',
  'expires_on',
  'assignees',
  'open_requests',
  'created_at',
  'updated_at'
] as const;

/** 권한자에게만 가는 키 */
export const SUBSCRIPTION_MANAGER_ONLY_KEYS = [
  'payer_entity',
  'card_last4',
  'billing_cycle',
  'billing_day',
  'billing_date',
  'amount',
  'currency',
  'amount_varies',
  'started_on',
  'owner_account',
  'manager_memo',
  'source',
  'request_count',
  'has_requests'
] as const;

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toPublicSubscription(
  row: SubscriptionRecord,
  extras: SubscriptionProjectionExtras
): SubscriptionPublicItem {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    plan_name: row.plan_name,
    purpose: row.purpose,
    status: row.status,
    expires_on: row.expires_on,
    assignees: extras.assignees,
    open_requests: extras.open_requests,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function toManagerSubscription(
  row: SubscriptionRecord,
  extras: SubscriptionProjectionExtras
): SubscriptionManagerItem {
  return {
    ...toPublicSubscription(row, extras),
    payer_entity: row.payer_entity,
    card_last4: row.card_last4,
    billing_cycle: row.billing_cycle,
    billing_day: row.billing_day,
    billing_date: row.billing_date,
    amount: toNumberOrNull(row.amount),
    currency: row.currency,
    amount_varies: row.amount_varies,
    started_on: row.started_on,
    owner_account: row.owner_account,
    manager_memo: row.manager_memo,
    source: row.source,
    request_count: extras.request_count,
    has_requests: extras.request_count > 0
  };
}

export function projectSubscription(
  row: SubscriptionRecord,
  extras: SubscriptionProjectionExtras,
  isManager: boolean
): SubscriptionItem {
  return isManager ? toManagerSubscription(row, extras) : toPublicSubscription(row, extras);
}
