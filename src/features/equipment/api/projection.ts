import type { AssetOpenRequests, AssigneeView } from '@/features/asset-ledger/api/types';
import type {
  EquipmentItem,
  EquipmentKind,
  EquipmentManagerItem,
  EquipmentPublicItem,
  EquipmentStatus,
  LedgerEntity
} from './types';

/**
 * plan 103 — 비품 역할별 칸 투영 (**허용 목록 방식** · 목록·단건·POST/PATCH 응답 공용).
 * 일반 직원 응답에는 회계장부·장부코드·구입 금액·구입일·구입처·관리 메모 **키 자체가 없다**(AC-07). (순수 함수 · `node --test`)
 */

export type EquipmentRecord = {
  id: number;
  asset_no: string;
  kind: EquipmentKind;
  model_serial: string | null;
  status: EquipmentStatus;
  assignee_type: 'user' | 'team' | null;
  assignee_user_id: string | null;
  assignee_affiliation: string | null;
  assignee_rank: string | null;
  ledger_entity: LedgerEntity | null;
  ledger_code: string | null;
  purchase_amount: number | string | null;
  purchased_on: string | null;
  vendor: string | null;
  manager_memo: string | null;
  source: 'excel_import' | 'manual' | 'e2e';
  created_at: string;
  updated_at: string;
};

export type EquipmentProjectionExtras = {
  assignee: AssigneeView | null;
  open_requests: AssetOpenRequests | null;
  /** 전체 요청 수 — 권한자 투영에만 들어간다 */
  request_count: number;
};

export const EQUIPMENT_PUBLIC_KEYS = [
  'id',
  'asset_no',
  'kind',
  'model_serial',
  'status',
  'assignee',
  'open_requests',
  'created_at',
  'updated_at'
] as const;

export const EQUIPMENT_MANAGER_ONLY_KEYS = [
  'ledger_entity',
  'ledger_code',
  'purchase_amount',
  'purchased_on',
  'vendor',
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

export function toPublicEquipment(
  row: EquipmentRecord,
  extras: EquipmentProjectionExtras
): EquipmentPublicItem {
  return {
    id: row.id,
    asset_no: row.asset_no,
    kind: row.kind,
    model_serial: row.model_serial,
    status: row.status,
    assignee: extras.assignee,
    open_requests: extras.open_requests,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function toManagerEquipment(
  row: EquipmentRecord,
  extras: EquipmentProjectionExtras
): EquipmentManagerItem {
  return {
    ...toPublicEquipment(row, extras),
    ledger_entity: row.ledger_entity,
    ledger_code: row.ledger_code,
    purchase_amount: toNumberOrNull(row.purchase_amount),
    purchased_on: row.purchased_on,
    vendor: row.vendor,
    manager_memo: row.manager_memo,
    source: row.source,
    request_count: extras.request_count,
    has_requests: extras.request_count > 0
  };
}

export function projectEquipment(
  row: EquipmentRecord,
  extras: EquipmentProjectionExtras,
  isManager: boolean
): EquipmentItem {
  return isManager ? toManagerEquipment(row, extras) : toPublicEquipment(row, extras);
}
