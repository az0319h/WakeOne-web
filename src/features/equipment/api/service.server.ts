import 'server-only';

import {
  assertAssignableUsers,
  fetchPeopleByIds,
  listTeammateIds,
  toAssigneeView
} from '@/features/asset-ledger/api/assignees.server';
import {
  AssetLedgerError,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION
} from '@/features/asset-ledger/api/errors';
import { ASSET_DEFAULT_PER_PAGE, ASSET_MESSAGES } from '@/features/asset-ledger/api/types';
import { hasTeam, matchesAssetScope, type ScopeAssignee } from '@/features/asset-ledger/lib/scope';
import {
  countRequestsForTarget,
  listRequestsForTarget,
  loadTargetRequestStats,
  type AssetViewer
} from '@/features/asset-requests/api/service.server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  EQUIPMENT_FIELD_MESSAGES,
  isPrefixAllowedForKind,
  type EquipmentWritableFields
} from '../schemas/equipment';
import { projectEquipment, toManagerEquipment, type EquipmentRecord } from './projection';
import {
  EQUIPMENT_DEFAULT_STATUSES,
  EQUIPMENT_KINDS,
  EQUIPMENT_PREFIXES,
  type EquipmentCounts,
  type EquipmentDetailResponse,
  type EquipmentFilters,
  type EquipmentListResponse,
  type EquipmentManagerItem,
  type EquipmentPayload,
  type EquipmentPrefix,
  type EquipmentStatus
} from './types';

/**
 * plan 103 — 비품 대장 service (service role · Route가 권한을 먼저 확인).
 * 일반 직원 응답은 반드시 `projectEquipment(…, false)`(허용 목록)를 거친다.
 */

const EQUIPMENT_COLUMNS =
  'id, asset_no, kind, model_serial, status, assignee_type, assignee_user_id, assignee_affiliation, assignee_rank, ledger_entity, ledger_code, purchase_amount, purchased_on, vendor, manager_memo, source, created_at, updated_at';

const MAX_PER_PAGE = 50;
const PREFIX_ORDER = new Map<string, number>(EQUIPMENT_PREFIXES.map((prefix, index) => [prefix, index]));

function assigneeOf(row: EquipmentRecord): ScopeAssignee | null {
  if (!row.assignee_type) return null;
  return {
    assignee_type: row.assignee_type,
    user_id: row.assignee_user_id,
    affiliation: row.assignee_affiliation,
    rank: row.assignee_rank
  };
}

function parseAssetNo(assetNo: string): { prefix: string; number: number } {
  const [prefix, digits] = assetNo.split('-');
  return { prefix, number: Number(digits) };
}

/** 정렬 기본: 자산번호(접두사 → 번호) */
function compareAssetNo(a: EquipmentRecord, b: EquipmentRecord): number {
  const left = parseAssetNo(a.asset_no);
  const right = parseAssetNo(b.asset_no);
  return (
    (PREFIX_ORDER.get(left.prefix) ?? 99) - (PREFIX_ORDER.get(right.prefix) ?? 99) ||
    left.number - right.number ||
    a.id - b.id
  );
}

async function loadAllEquipment(): Promise<EquipmentRecord[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from('equipment_items').select(EQUIPMENT_COLUMNS).limit(10000);
  if (error) throw new Error(error.message);
  return (data ?? []) as EquipmentRecord[];
}

async function loadEquipmentRow(id: number): Promise<EquipmentRecord | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('equipment_items')
    .select(EQUIPMENT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EquipmentRecord | null) ?? null;
}

function matchesQuery(row: EquipmentRecord, q: string): boolean {
  const needle = q.toLowerCase();
  return [row.asset_no, row.model_serial].some(
    (value) => typeof value === 'string' && value.toLowerCase().includes(needle)
  );
}

async function buildItems(rows: EquipmentRecord[], viewer: AssetViewer) {
  const [people, stats] = await Promise.all([
    fetchPeopleByIds(rows.map((row) => row.assignee_user_id)),
    loadTargetRequestStats(
      'equipment',
      rows.map((row) => row.id),
      viewer
    )
  ]);
  return rows.map((row) => {
    const assignee = assigneeOf(row);
    return projectEquipment(
      row,
      {
        assignee: assignee ? toAssigneeView(assignee, people) : null,
        open_requests: stats.open.get(row.id) ?? null,
        request_count: stats.totals.get(row.id) ?? 0
      },
      viewer.isManager
    );
  });
}

export async function listEquipment(
  filters: EquipmentFilters,
  viewer: AssetViewer
): Promise<EquipmentListResponse> {
  const scope = filters.scope ?? 'all';
  const statuses: EquipmentStatus[] =
    filters.status && filters.status.length > 0 ? filters.status : EQUIPMENT_DEFAULT_STATUSES;
  const perPage = Math.min(Math.max(filters.perPage ?? ASSET_DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
  const q = filters.q?.trim() ?? '';

  const rows = await loadAllEquipment();
  const teamUnavailable = scope === 'team' && !hasTeam(viewer);
  const teammateIds = scope === 'team' && !teamUnavailable ? await listTeammateIds(viewer) : new Set<string>();

  const base = teamUnavailable
    ? []
    : rows.filter((row) => {
        if (q && !matchesQuery(row, q)) return false;
        const assignee = assigneeOf(row);
        return matchesAssetScope(assignee ? [assignee] : [], scope, viewer, teammateIds, {
          personalOnly: true
        });
      });

  const statusFiltered = base.filter((row) => statuses.includes(row.status));
  const counts = Object.fromEntries([
    ['all', statusFiltered.length],
    ...EQUIPMENT_KINDS.map((kind) => [kind, statusFiltered.filter((row) => row.kind === kind).length])
  ]) as EquipmentCounts;

  const kind = filters.kind && filters.kind !== 'all' ? filters.kind : null;
  const inKind = (row: EquipmentRecord) => !kind || row.kind === kind;
  const filtered = statusFiltered.filter(inKind);
  const matched =
    filters.sort === 'updated_desc'
      ? filtered.toSorted((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)
      : filtered.toSorted(compareAssetNo);
  const hiddenCount = statuses.includes('disposed')
    ? 0
    : base.filter((row) => inKind(row) && row.status === 'disposed').length;

  const total = matched.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(filters.page ?? 1, 1), lastPage);
  const pageRows = matched.slice((page - 1) * perPage, page * perPage);

  return {
    items: await buildItems(pageRows, viewer),
    total,
    page,
    perPage,
    counts,
    hidden_count: hiddenCount,
    team_unavailable: teamUnavailable,
    is_manager: viewer.isManager
  };
}

export async function getEquipmentDetail(
  id: number,
  viewer: AssetViewer
): Promise<EquipmentDetailResponse | null> {
  const row = await loadEquipmentRow(id);
  if (!row) return null;
  const [items, requests] = await Promise.all([
    buildItems([row], viewer),
    listRequestsForTarget('equipment', id, viewer)
  ]);
  return { item: items[0], requests, is_manager: viewer.isManager };
}

export async function getEquipmentManagerItem(
  id: number,
  viewer: AssetViewer
): Promise<EquipmentManagerItem | null> {
  const row = await loadEquipmentRow(id);
  if (!row) return null;
  const assignee = assigneeOf(row);
  const [people, stats] = await Promise.all([
    fetchPeopleByIds([row.assignee_user_id]),
    loadTargetRequestStats('equipment', [id], { ...viewer, isManager: true })
  ]);
  return toManagerEquipment(row, {
    assignee: assignee ? toAssigneeView(assignee, people) : null,
    open_requests: stats.open.get(id) ?? null,
    request_count: stats.totals.get(id) ?? 0
  });
}

function assigneeColumns(assignee: EquipmentPayload['assignee']) {
  if (!assignee) {
    return { assignee_type: null, assignee_user_id: null, assignee_affiliation: null, assignee_rank: null };
  }
  if (assignee.assignee_type === 'user') {
    return {
      assignee_type: 'user',
      assignee_user_id: assignee.user_id,
      assignee_affiliation: null,
      assignee_rank: null
    };
  }
  return {
    assignee_type: 'team',
    assignee_user_id: null,
    assignee_affiliation: assignee.affiliation,
    assignee_rank: assignee.rank
  };
}

async function assertAssetNoAvailable(assetNo: string, exceptId?: number): Promise<void> {
  const supabase = getServiceRoleClient();
  let query = supabase.from('equipment_items').select('id').eq('asset_no', assetNo).limit(1);
  if (exceptId) query = query.neq('id', exceptId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if ((data ?? []).length > 0) {
    throw new AssetLedgerError(409, EQUIPMENT_FIELD_MESSAGES.duplicateAssetNo, 'asset_no');
  }
}

export async function createEquipment(input: {
  fields: EquipmentWritableFields;
  assignee: EquipmentPayload['assignee'] | undefined;
  viewer: AssetViewer;
}): Promise<EquipmentManagerItem> {
  const assetNo = input.fields.asset_no as string;
  if (input.assignee) await assertAssignableUsers([input.assignee]);
  await assertAssetNoAvailable(assetNo);

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('equipment_items')
    .insert({
      ...input.fields,
      ...assigneeColumns(input.assignee ?? null),
      source: 'manual',
      created_by: input.viewer.user_id,
      updated_by: input.viewer.user_id
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new AssetLedgerError(409, EQUIPMENT_FIELD_MESSAGES.duplicateAssetNo, 'asset_no');
    }
    throw new Error(error.message);
  }
  const item = await getEquipmentManagerItem((data as { id: number }).id, input.viewer);
  if (!item) throw new Error('저장한 비품을 다시 읽지 못했습니다.');
  return item;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return a === b;
}

export async function updateEquipment(input: {
  id: number;
  fields: EquipmentWritableFields;
  assignee: EquipmentPayload['assignee'] | undefined;
  viewer: AssetViewer;
}): Promise<{ item: EquipmentManagerItem; changedFields: string[] } | null> {
  const existing = await loadEquipmentRow(input.id);
  if (!existing) return null;

  const nextKind = input.fields.kind ?? existing.kind;
  const nextAssetNo = input.fields.asset_no ?? existing.asset_no;
  if (!isPrefixAllowedForKind(nextKind, nextAssetNo)) {
    throw new AssetLedgerError(400, EQUIPMENT_FIELD_MESSAGES.prefixMismatch, 'asset_no');
  }

  const changedFields = Object.entries(input.fields)
    .filter(([key, value]) => !sameValue((existing as Record<string, unknown>)[key], value))
    .map(([key]) => key);

  const patch: Record<string, unknown> = {};
  for (const field of changedFields) {
    patch[field] = (input.fields as Record<string, unknown>)[field];
  }

  if (input.assignee !== undefined) {
    const columns = assigneeColumns(input.assignee);
    const assigneeChanged = Object.entries(columns).some(
      ([key, value]) => !sameValue((existing as Record<string, unknown>)[key], value)
    );
    if (assigneeChanged) {
      if (input.assignee) await assertAssignableUsers([input.assignee]);
      Object.assign(patch, columns);
      changedFields.push('assignee');
    }
  }

  if (changedFields.includes('asset_no')) {
    await assertAssetNoAvailable(nextAssetNo, input.id);
  }

  if (changedFields.length > 0) {
    const supabase = getServiceRoleClient();
    const { error } = await supabase
      .from('equipment_items')
      .update({ ...patch, updated_by: input.viewer.user_id })
      .eq('id', input.id);
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        throw new AssetLedgerError(409, EQUIPMENT_FIELD_MESSAGES.duplicateAssetNo, 'asset_no');
      }
      throw new Error(error.message);
    }
  }

  const item = await getEquipmentManagerItem(input.id, input.viewer);
  if (!item) return null;
  return { item, changedFields };
}

export async function deleteEquipment(id: number): Promise<EquipmentRecord | null> {
  const existing = await loadEquipmentRow(id);
  if (!existing) return null;
  if ((await countRequestsForTarget('equipment', id)) > 0) {
    throw new AssetLedgerError(409, ASSET_MESSAGES.hasRequests);
  }
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('equipment_items').delete().eq('id', id);
  if (error) {
    if (error.code === PG_FOREIGN_KEY_VIOLATION) {
      throw new AssetLedgerError(409, ASSET_MESSAGES.hasRequests);
    }
    throw new Error(error.message);
  }
  return existing;
}

export async function getEquipmentBasic(
  id: number
): Promise<Pick<EquipmentRecord, 'id' | 'asset_no' | 'kind' | 'status'> | null> {
  const row = await loadEquipmentRow(id);
  return row ? { id: row.id, asset_no: row.asset_no, kind: row.kind, status: row.status } : null;
}

/** 같은 접두사 최대 번호 + 1 · 3자리 zero-pad (4자리 넘으면 그대로) */
export async function suggestNextAssetNo(prefix: EquipmentPrefix): Promise<string> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('equipment_items')
    .select('asset_no')
    .like('asset_no', `${prefix}-%`)
    .limit(10000);
  if (error) throw new Error(error.message);
  let max = 0;
  for (const row of (data ?? []) as { asset_no: string }[]) {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(row.asset_no);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
