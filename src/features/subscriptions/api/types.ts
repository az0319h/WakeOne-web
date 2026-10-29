import type {
  AssetOpenRequests,
  AssetScope,
  AssigneeInput,
  AssigneeView
} from '@/features/asset-ledger/api/types';
import type { AssetRequestListItem } from '@/features/asset-requests/api/types';

/**
 * plan 103 — 구독 관리 타입 (FE·BE 계약).
 * 일반 직원 응답 = `SubscriptionPublicItem`(민감 칸 **키 자체 없음** · AC-06) · 권한자 = `SubscriptionManagerItem`.
 */

export const SUBSCRIPTION_CATEGORIES = ['creative', 'software', 'collaboration', 'etc'] as const;
export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORIES)[number];

/** 탭 순서·라벨 (AC-08) */
export const SUBSCRIPTION_CATEGORY_LABELS: Record<SubscriptionCategory, string> = {
  creative: '크리에이티브 툴',
  software: '소프트웨어',
  collaboration: '협업툴',
  etc: '기타'
};

export const SUBSCRIPTION_STATUSES = ['active', 'cancel_scheduled', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: '사용중',
  cancel_scheduled: '해지 예정',
  canceled: '해지됨'
};

/** 기본 상태 필터 — 해지됨 숨김 (D-10) */
export const SUBSCRIPTION_DEFAULT_STATUSES: SubscriptionStatus[] = ['active', 'cancel_scheduled'];

export const PAYER_ENTITIES = [
  'wake',
  'sans',
  'sans_foundry',
  'kinky',
  'beyond_food',
  'personal_card',
  'unknown'
] as const;
export type PayerEntity = (typeof PAYER_ENTITIES)[number];

export const PAYER_ENTITY_LABELS: Record<PayerEntity, string> = {
  wake: '웨이크',
  sans: '산스',
  sans_foundry: '산스파운드리',
  kinky: '킨키',
  beyond_food: '비욘드푸드',
  personal_card: '개인카드',
  unknown: '미확인'
};

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: '월 결제',
  yearly: '연 결제'
};

export const SUBSCRIPTION_CURRENCIES = ['KRW', 'USD'] as const;
export type SubscriptionCurrency = (typeof SUBSCRIPTION_CURRENCIES)[number];
export const SUBSCRIPTION_CURRENCY_LABELS: Record<SubscriptionCurrency, string> = {
  KRW: '원',
  USD: '달러'
};

export const SUBSCRIPTION_SORTS = ['default', 'name', 'expires_on', 'updated_desc'] as const;
export type SubscriptionSort = (typeof SUBSCRIPTION_SORTS)[number];

/** 일반 직원에게도 보이는 칸 (허용 목록) */
export type SubscriptionPublicItem = {
  id: number;
  category: SubscriptionCategory;
  name: string;
  plan_name: string | null;
  purpose: string | null;
  status: SubscriptionStatus;
  expires_on: string | null;
  assignees: AssigneeView[];
  /** 보는 사람 기준 진행 중(접수대기·처리중) 요청 — 직원: 본인 요청만 · 권한자: 전체 · 없으면 null */
  open_requests: AssetOpenRequests | null;
  created_at: string;
  updated_at: string;
};

/** 권한자 응답 — 결제·카드·주계정·관리 메모 포함 */
export type SubscriptionManagerItem = SubscriptionPublicItem & {
  payer_entity: PayerEntity | null;
  card_last4: string | null;
  billing_cycle: BillingCycle | null;
  billing_day: number | null;
  billing_date: string | null;
  amount: number | null;
  currency: SubscriptionCurrency | null;
  amount_varies: boolean;
  started_on: string | null;
  owner_account: string | null;
  manager_memo: string | null;
  source: 'excel_import' | 'manual' | 'e2e';
  /** 이 줄의 전체 요청 수(상태 무관 · 요청자 무관) */
  request_count: number;
  /** request_count > 0 — 삭제 버튼 비활성 판정(D-11) */
  has_requests: boolean;
};

export type SubscriptionItem = SubscriptionPublicItem | SubscriptionManagerItem;

export function isSubscriptionManagerItem(item: SubscriptionItem): item is SubscriptionManagerItem {
  return 'request_count' in item;
}

export type SubscriptionCounts = Record<'all' | SubscriptionCategory, number>;

export type SubscriptionFilters = {
  category?: SubscriptionCategory | 'all';
  scope?: AssetScope;
  /** 복수 · 비우면 기본(사용중·해지 예정) */
  status?: SubscriptionStatus[];
  /** 결제 카드 끝 4자리 — 권한자 전용(그 외 403) */
  card?: string;
  q?: string;
  page?: number;
  perPage?: number;
  sort?: SubscriptionSort;
};

export type SubscriptionListResponse = {
  items: SubscriptionItem[];
  total: number;
  page: number;
  perPage: number;
  /** 탭 옆 건수 — 범위·상태·검색·카드 필터 기준(구분 필터 제외) */
  counts: SubscriptionCounts;
  /** 상태 필터로 숨겨진 「해지됨」 수(현재 구분·범위·검색·카드 기준) · 해지됨을 고르면 0 */
  hidden_count: number;
  /** scope=team인데 부서가 없음 → 「부서가 정해지지 않아 팀 목록을 볼 수 없어요.」 */
  team_unavailable: boolean;
  is_manager: boolean;
  /** 권한자 전용 — 「결제 카드」 필터 선택지(끝 4자리 · 오름차순) */
  card_options?: string[];
};

export type SubscriptionListApiResponse = { success: true; data: SubscriptionListResponse };

export type SubscriptionDetailResponse = {
  item: SubscriptionItem;
  /** 이 구독의 요청 — 직원: 본인 요청만 · 권한자: 전부 (최신 순) */
  requests: AssetRequestListItem[];
  is_manager: boolean;
};

export type SubscriptionDetailApiResponse = { success: true; data: SubscriptionDetailResponse };

/** POST 본문 (PATCH는 같은 키의 부분 집합 · assignees는 보내면 통째로 교체) */
export type SubscriptionPayload = {
  category: SubscriptionCategory;
  name: string;
  plan_name?: string | null;
  purpose?: string | null;
  status?: SubscriptionStatus;
  expires_on?: string | null;
  assignees?: AssigneeInput[];
  payer_entity?: PayerEntity | null;
  card_last4?: string | null;
  billing_cycle?: BillingCycle | null;
  billing_day?: number | null;
  billing_date?: string | null;
  amount?: number | null;
  currency?: SubscriptionCurrency | null;
  amount_varies?: boolean;
  started_on?: string | null;
  owner_account?: string | null;
  manager_memo?: string | null;
};

export type SubscriptionMutationResponse = {
  success: true;
  message: string;
  item: SubscriptionManagerItem;
};

export type SubscriptionDeleteResponse = { success: true; message: string; id: number };
