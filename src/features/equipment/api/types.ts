import type {
  AssetOpenRequests,
  AssetScope,
  AssigneeInput,
  AssigneeView
} from '@/features/asset-ledger/api/types';
import type { AssetRequestListItem } from '@/features/asset-requests/api/types';

/**
 * plan 103 — 비품 관리 타입 (FE·BE 계약).
 * 일반 직원 응답 = `EquipmentPublicItem`(구입 정보·관리 메모 **키 자체 없음** · AC-07) · 권한자 = `EquipmentManagerItem`.
 */

export const EQUIPMENT_KINDS = [
  'notebook',
  'monitor',
  'desktop',
  'mouse',
  'keyboard',
  'tablet',
  'store_device',
  'etc'
] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

/** 탭 순서·라벨 (AC-09) */
export const EQUIPMENT_KIND_LABELS: Record<EquipmentKind, string> = {
  notebook: '노트북·컴퓨터',
  monitor: '모니터',
  desktop: '본체',
  mouse: '마우스',
  keyboard: '키보드',
  tablet: '태블릿',
  store_device: '매장 기기',
  etc: '기타 장비'
};

/** 품목 ↔ 자산번호 접두사 (SQL `equipment_items_prefix_kind_check`와 같음) */
export const EQUIPMENT_PREFIXES_BY_KIND: Record<EquipmentKind, readonly string[]> = {
  notebook: ['N'],
  monitor: ['M'],
  desktop: ['W'],
  mouse: ['S'],
  keyboard: ['K'],
  tablet: ['T'],
  store_device: ['R', 'F', 'TER'],
  etc: ['A', 'P']
};

export const EQUIPMENT_PREFIX_LABELS: Record<string, string> = {
  N: 'N (노트북·컴퓨터)',
  M: 'M (모니터)',
  W: 'W (본체)',
  S: 'S (마우스)',
  K: 'K (키보드)',
  T: 'T (태블릿)',
  R: 'R (라우터)',
  F: 'F (프론트)',
  TER: 'TER (터미널)',
  A: 'A (외장하드 등)',
  P: 'P (패파카드)'
};

export const EQUIPMENT_PREFIXES = ['N', 'M', 'W', 'S', 'K', 'T', 'R', 'F', 'TER', 'A', 'P'] as const;
export type EquipmentPrefix = (typeof EQUIPMENT_PREFIXES)[number];

export const ASSET_NO_PATTERN = /^(N|M|W|S|K|T|R|F|TER|A|P)-[0-9]{3,4}$/;

export function assetNoPrefix(assetNo: string): string | null {
  const match = /^([A-Z]+)-/.exec(assetNo);
  return match ? match[1] : null;
}

export function kindForPrefix(prefix: string): EquipmentKind | null {
  for (const kind of EQUIPMENT_KINDS) {
    if (EQUIPMENT_PREFIXES_BY_KIND[kind].includes(prefix)) return kind;
  }
  return null;
}

export const EQUIPMENT_STATUSES = ['in_use', 'stored', 'repair', 'lost', 'disposed'] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  in_use: '사용중',
  stored: '보관',
  repair: '수리중',
  lost: '분실',
  disposed: '폐기'
};

/** 기본 상태 필터 — 폐기 숨김 (D-10) */
export const EQUIPMENT_DEFAULT_STATUSES: EquipmentStatus[] = ['in_use', 'stored', 'repair', 'lost'];

export const LEDGER_ENTITIES = ['wake', 'sans', 'sans_foundry', 'kinky', 'beyond_food'] as const;
export type LedgerEntity = (typeof LEDGER_ENTITIES)[number];
export const LEDGER_ENTITY_LABELS: Record<LedgerEntity, string> = {
  wake: '웨이크',
  sans: '산스',
  sans_foundry: '산스파운드리',
  kinky: '킨키',
  beyond_food: '비욘드푸드'
};

export const EQUIPMENT_SORTS = ['default', 'updated_desc'] as const;
export type EquipmentSort = (typeof EQUIPMENT_SORTS)[number];

/** 일반 직원에게도 보이는 칸 (허용 목록) */
export type EquipmentPublicItem = {
  id: number;
  asset_no: string;
  kind: EquipmentKind;
  model_serial: string | null;
  status: EquipmentStatus;
  /** 사람 1명 · 팀 · null(비어 있음) */
  assignee: AssigneeView | null;
  /** 보는 사람 기준 진행 중 요청 — 없으면 null */
  open_requests: AssetOpenRequests | null;
  created_at: string;
  updated_at: string;
};

/** 권한자 응답 — 회계장부·장부코드·구입 금액·구입일·구입처·관리 메모 포함 */
export type EquipmentManagerItem = EquipmentPublicItem & {
  ledger_entity: LedgerEntity | null;
  ledger_code: string | null;
  purchase_amount: number | null;
  purchased_on: string | null;
  vendor: string | null;
  manager_memo: string | null;
  source: 'excel_import' | 'manual' | 'e2e';
  request_count: number;
  /** request_count > 0 — 삭제 버튼 비활성 판정(D-11) */
  has_requests: boolean;
};

export type EquipmentItem = EquipmentPublicItem | EquipmentManagerItem;

export function isEquipmentManagerItem(item: EquipmentItem): item is EquipmentManagerItem {
  return 'request_count' in item;
}

export type EquipmentCounts = Record<'all' | EquipmentKind, number>;

export type EquipmentFilters = {
  kind?: EquipmentKind | 'all';
  scope?: AssetScope;
  status?: EquipmentStatus[];
  /** 자산번호 · 모델·시리얼 */
  q?: string;
  page?: number;
  perPage?: number;
  sort?: EquipmentSort;
};

export type EquipmentListResponse = {
  items: EquipmentItem[];
  total: number;
  page: number;
  perPage: number;
  counts: EquipmentCounts;
  /** 상태 필터로 숨겨진 「폐기」 수 · 폐기를 고르면 0 */
  hidden_count: number;
  team_unavailable: boolean;
  is_manager: boolean;
};

export type EquipmentListApiResponse = { success: true; data: EquipmentListResponse };

export type EquipmentDetailResponse = {
  item: EquipmentItem;
  requests: AssetRequestListItem[];
  is_manager: boolean;
};

export type EquipmentDetailApiResponse = { success: true; data: EquipmentDetailResponse };

export type EquipmentPayload = {
  asset_no: string;
  kind: EquipmentKind;
  model_serial?: string | null;
  status?: EquipmentStatus;
  /** null = 비어 있음 */
  assignee?: Exclude<AssigneeInput, { assignee_type: 'affiliation' }> | null;
  ledger_entity?: LedgerEntity | null;
  ledger_code?: string | null;
  purchase_amount?: number | null;
  purchased_on?: string | null;
  vendor?: string | null;
  manager_memo?: string | null;
};

export type EquipmentMutationResponse = {
  success: true;
  message: string;
  item: EquipmentManagerItem;
};

export type EquipmentDeleteResponse = { success: true; message: string; id: number };

export type EquipmentNextNumberResponse = {
  success: true;
  data: { prefix: EquipmentPrefix; suggested: string };
};
