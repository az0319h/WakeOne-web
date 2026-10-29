/**
 * plan 103 — 구독·비품 공용 타입 · 라벨 (클라이언트·서버·node --test 공용 · 런타임 의존성 없음).
 * 대상자(구독) / 사용자(비품) 표현 · 「내 것 / 내 팀」 범위 · 권한자 후보 · 대상자 후보 응답.
 */

/** 대상자로 고를 수 있는 소속 — 동방특송 불가 (SQL CHECK와 같음) */
export const LEDGER_AFFILIATIONS = ['wake', 'sans', 'sans_foundry'] as const;
export type LedgerAffiliation = (typeof LEDGER_AFFILIATIONS)[number];

export const LEDGER_AFFILIATION_LABELS: Record<LedgerAffiliation, string> = {
  wake: '웨이크',
  sans: '산스',
  sans_foundry: '산스파운드리'
};

export function isLedgerAffiliation(value: unknown): value is LedgerAffiliation {
  return typeof value === 'string' && (LEDGER_AFFILIATIONS as readonly string[]).includes(value);
}

/** 구독 대상자 종류 — 사람 · 팀(소속+부서) · 소속 전체 */
export const SUBSCRIPTION_ASSIGNEE_TYPES = ['user', 'team', 'affiliation'] as const;
export type SubscriptionAssigneeType = (typeof SUBSCRIPTION_ASSIGNEE_TYPES)[number];

/** 비품 사용자 종류 — 사람 · 팀 (null = 비어 있음/보관) */
export const EQUIPMENT_ASSIGNEE_TYPES = ['user', 'team'] as const;
export type EquipmentAssigneeType = (typeof EQUIPMENT_ASSIGNEE_TYPES)[number];

/** POST/PATCH 입력 (구독 대상자 배열 원소 · 비품 사용자) */
export type AssigneeInput =
  | { assignee_type: 'user'; user_id: string }
  | { assignee_type: 'team'; affiliation: LedgerAffiliation; rank: string }
  | { assignee_type: 'affiliation'; affiliation: LedgerAffiliation };

/** 응답 표현 — 칩 렌더용 라벨 포함 */
export type AssigneeView = {
  assignee_type: SubscriptionAssigneeType;
  user_id: string | null;
  affiliation: LedgerAffiliation | null;
  rank: string | null;
  /** 사람 = 이름(조회 실패 시 「알 수 없음」) · 팀 = 「웨이크 디자인팀」 · 소속 = 「웨이크 전 직원」 */
  label: string;
  /** 사람일 때 이름(= label) · 그 외 null */
  full_name: string | null;
  /** 사람일 때 소속·부서 보조(「웨이크 디자인팀」) · 그 외 null */
  team_label: string | null;
};

export function teamLabel(affiliation: LedgerAffiliation, rank: string): string {
  return `${LEDGER_AFFILIATION_LABELS[affiliation]} ${rank}`;
}

export function affiliationAllLabel(affiliation: LedgerAffiliation): string {
  return `${LEDGER_AFFILIATION_LABELS[affiliation]} 전 직원`;
}

/** 보기 범위 필터 (D-7) */
export const ASSET_SCOPES = ['all', 'mine', 'team'] as const;
export type AssetScope = (typeof ASSET_SCOPES)[number];

export const ASSET_PER_PAGE_OPTIONS = [10, 20, 50] as const;
export const ASSET_DEFAULT_PER_PAGE = 20;

/** 목록 행의 「진행 중 요청」(보는 사람 기준) */
export type AssetOpenRequestBrief = {
  id: number;
  status: 'pending' | 'in_progress';
  request_type: string;
};

/** 보는 사람 기준 진행 중(접수대기·처리중) 요청 요약 — 없으면 null. first = 최신 1건 */
export type AssetOpenRequests = {
  count: number;
  first: AssetOpenRequestBrief;
};

/** `GET /api/asset-ledger/assignee-options` (권한자 전용) */
export type AssigneePersonOption = {
  user_id: string;
  full_name: string;
  affiliation: LedgerAffiliation | null;
  affiliation_label: string | null;
  rank: string | null;
  /** 「웨이크 디자인팀」(부서 없으면 소속만 · 소속 없으면 null) */
  team_label: string | null;
};

export type AssigneeTeamOption = {
  affiliation: LedgerAffiliation;
  rank: string;
  label: string;
};

export type AssigneeAffiliationOption = {
  affiliation: LedgerAffiliation;
  label: string;
};

export type AssigneeOptionsResponse = {
  /** active · 비동방 (applyDongbangScope) · 이름순 */
  people: AssigneePersonOption[];
  /** RANK_BY_AFFILIATION (ORG 소속) */
  teams: AssigneeTeamOption[];
  affiliations: AssigneeAffiliationOption[];
  /** 요청 담당자 후보 = active 권한자(admin·웨이크 인사팀·웨이크 회계팀) */
  managers: AssigneePersonOption[];
};

export type AssigneeOptionsApiResponse = { success: true; data: AssigneeOptionsResponse };

/** 공용 검증 문구 (plan §검증 문구) */
export const ASSET_MESSAGES = {
  forbidden: '권한이 없습니다.',
  dongbangForbidden: '접근 권한이 없습니다.',
  invalidBody: '요청 본문이 올바르지 않습니다.',
  invalidAssignee: '선택할 수 없는 대상자예요.',
  duplicateAssignee: '같은 대상자가 두 번 들어 있어요.',
  notFound: '대상을 찾을 수 없어요.',
  hasRequests: '요청 기록이 있어 삭제할 수 없어요.'
} as const;
