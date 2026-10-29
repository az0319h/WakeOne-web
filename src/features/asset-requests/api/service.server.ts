import 'server-only';

import {
  fetchPeopleByIds,
  isLedgerPersonManager,
  personName,
  personTeamLabel,
  type LedgerPerson
} from '@/features/asset-ledger/api/assignees.server';
import {
  AssetLedgerError,
  PG_UNIQUE_VIOLATION
} from '@/features/asset-ledger/api/errors';
import type { AssetOpenRequestBrief, AssetOpenRequests } from '@/features/asset-ledger/api/types';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  ASSET_COMMENT_BODY_MAX,
  ASSET_REJECT_REASON_MAX,
  ASSET_REQUEST_BODY_MAX,
  ASSET_REQUEST_BODY_MIN,
  ASSET_REQUEST_DONE_STATUSES,
  ASSET_REQUEST_MESSAGES,
  ASSET_REQUEST_OPEN_STATUSES,
  isRequestTypeFor,
  type AssetCommentAuthorRole,
  type AssetRequestComment,
  type AssetRequestDetail,
  type AssetRequestDetailResponse,
  type AssetRequestFilters,
  type AssetRequestListItem,
  type AssetRequestListResponse,
  type AssetRequestStatus,
  type AssetRequestSummary,
  type AssetRequestType,
  type AssetRequestViewerFlags,
  type AssetTargetType
} from './types';

/**
 * plan 103 — 구독·비품 요청 · 댓글 service (service role 전용 · Route가 권한을 먼저 확인한다).
 * 요청은 요청자 본인 + 권한자만 본다. 볼 수 없는 사람에게는 「없음」(404)으로 응답한다(D-13).
 * 본문·반려 사유·댓글 원문은 반환만 하고 로그·알림 metadata로 넘기지 않는다.
 */

export type AssetViewer = {
  user_id: string;
  full_name: string;
  affiliation: string | null;
  rank: string | null;
  isManager: boolean;
};

export type AssetRequestRow = {
  id: number;
  target_type: AssetTargetType;
  subscription_id: number | null;
  equipment_id: number | null;
  target_label: string;
  request_type: AssetRequestType;
  body: string;
  status: AssetRequestStatus;
  requester_user_id: string;
  requester_name: string;
  assignee_user_id: string | null;
  reject_reason: string | null;
  status_updated_at: string | null;
  status_updated_by: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: number;
  request_id: number;
  author_user_id: string;
  parent_id: number | null;
  root_comment_id: number | null;
  path: string;
  depth: number;
  body: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
};

const REQUEST_COLUMNS =
  'id, target_type, subscription_id, equipment_id, target_label, request_type, body, status, requester_user_id, requester_name, assignee_user_id, reject_reason, status_updated_at, status_updated_by, edited_at, created_at, updated_at';

const COMMENT_COLUMNS =
  'id, request_id, author_user_id, parent_id, root_comment_id, path, depth, body, is_deleted, deleted_at, deleted_by, edited_at, created_at, updated_at';

const DELETED_COMMENT_BODY = '삭제된 댓글입니다.';
const MAX_PER_PAGE = 50;

function targetColumn(targetType: AssetTargetType): 'subscription_id' | 'equipment_id' {
  return targetType === 'subscription' ? 'subscription_id' : 'equipment_id';
}

export function targetIdOf(row: Pick<AssetRequestRow, 'target_type' | 'subscription_id' | 'equipment_id'>): number {
  return (row.target_type === 'subscription' ? row.subscription_id : row.equipment_id) ?? 0;
}

export function isTerminalStatus(status: string): boolean {
  return (ASSET_REQUEST_DONE_STATUSES as readonly string[]).includes(status);
}

export function canViewAssetRequest(
  row: Pick<AssetRequestRow, 'requester_user_id'>,
  viewer: Pick<AssetViewer, 'user_id' | 'isManager'>
): boolean {
  return viewer.isManager || row.requester_user_id === viewer.user_id;
}

export function buildViewerFlags(
  row: Pick<AssetRequestRow, 'requester_user_id' | 'status'>,
  viewer: Pick<AssetViewer, 'user_id' | 'isManager'>
): AssetRequestViewerFlags {
  const isRequester = row.requester_user_id === viewer.user_id;
  const pending = row.status === 'pending';
  const inProgress = row.status === 'in_progress';
  return {
    is_manager: viewer.isManager,
    is_requester: isRequester,
    can_edit: isRequester && pending,
    can_cancel: isRequester && pending,
    can_start: viewer.isManager && pending,
    can_complete: viewer.isManager && inProgress,
    can_reject: viewer.isManager && (pending || inProgress),
    can_change_assignee: viewer.isManager && inProgress,
    can_comment: viewer.isManager || isRequester
  };
}

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

export async function getAssetRequestRow(id: number): Promise<AssetRequestRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_requests')
    .select(REQUEST_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AssetRequestRow | null) ?? null;
}

/** 볼 수 있는 요청만 (아니면 null → Route 404) */
export async function getVisibleAssetRequestRow(
  id: number,
  viewer: Pick<AssetViewer, 'user_id' | 'isManager'>
): Promise<AssetRequestRow | null> {
  const row = await getAssetRequestRow(id);
  if (!row || !canViewAssetRequest(row, viewer)) return null;
  return row;
}

async function countCommentsByRequest(requestIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (requestIds.length === 0) return counts;
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_request_comments')
    .select('request_id')
    .in('request_id', requestIds)
    .eq('is_deleted', false);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as { request_id: number }[]) {
    counts.set(row.request_id, (counts.get(row.request_id) ?? 0) + 1);
  }
  return counts;
}

function toListItem(
  row: AssetRequestRow,
  people: Map<string, LedgerPerson>,
  commentCounts: Map<number, number>
): AssetRequestListItem {
  return {
    id: row.id,
    target_type: row.target_type,
    target_id: targetIdOf(row),
    target_label: row.target_label,
    request_type: row.request_type,
    status: row.status,
    requester_user_id: row.requester_user_id,
    requester_name: row.requester_name,
    assignee_user_id: row.assignee_user_id,
    assignee_name: row.assignee_user_id ? personName(people.get(row.assignee_user_id)) : null,
    comment_count: commentCounts.get(row.id) ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function toRequestListItems(rows: AssetRequestRow[]): Promise<AssetRequestListItem[]> {
  if (rows.length === 0) return [];
  const [people, commentCounts] = await Promise.all([
    fetchPeopleByIds(rows.map((row) => row.assignee_user_id)),
    countCommentsByRequest(rows.map((row) => row.id))
  ]);
  return rows.map((row) => toListItem(row, people, commentCounts));
}

export async function toRequestDetail(row: AssetRequestRow): Promise<AssetRequestDetail> {
  const [people, commentCounts] = await Promise.all([
    fetchPeopleByIds([row.assignee_user_id, row.requester_user_id]),
    countCommentsByRequest([row.id])
  ]);
  return {
    ...toListItem(row, people, commentCounts),
    body: row.body,
    requester_team_label: personTeamLabel(people.get(row.requester_user_id)),
    assignee_team_label: row.assignee_user_id ? personTeamLabel(people.get(row.assignee_user_id)) : null,
    reject_reason: row.reject_reason,
    status_updated_at: row.status_updated_at,
    status_updated_by: row.status_updated_by,
    edited_at: row.edited_at
  };
}

export async function getAssetRequestDetail(
  id: number,
  viewer: AssetViewer
): Promise<AssetRequestDetailResponse | null> {
  const row = await getVisibleAssetRequestRow(id, viewer);
  if (!row) return null;
  return { request: await toRequestDetail(row), viewer: buildViewerFlags(row, viewer) };
}

/** 행 Dialog 「이 장비/구독의 요청」 — 직원: 본인 요청만 · 권한자: 전부 (최신 순) */
export async function listRequestsForTarget(
  targetType: AssetTargetType,
  targetId: number,
  viewer: Pick<AssetViewer, 'user_id' | 'isManager'>
): Promise<AssetRequestListItem[]> {
  const supabase = getServiceRoleClient();
  let query = supabase
    .from('asset_requests')
    .select(REQUEST_COLUMNS)
    .eq('target_type', targetType)
    .eq(targetColumn(targetType), targetId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(200);
  if (!viewer.isManager) {
    query = query.eq('requester_user_id', viewer.user_id);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return toRequestListItems((data ?? []) as AssetRequestRow[]);
}

export type TargetRequestStats = {
  /** 보는 사람 기준 진행 중 요청 (최신 1건 + 건수) */
  open: Map<number, AssetOpenRequests>;
  /** 전체 요청 수(권한자 전용 · 삭제 가능 판정) */
  totals: Map<number, number>;
};

/** 대장 목록·단건의 「진행 중 요청」·요청 수 */
export async function loadTargetRequestStats(
  targetType: AssetTargetType,
  targetIds: number[],
  viewer: Pick<AssetViewer, 'user_id' | 'isManager'>
): Promise<TargetRequestStats> {
  const stats: TargetRequestStats = { open: new Map(), totals: new Map() };
  if (targetIds.length === 0) return stats;

  const supabase = getServiceRoleClient();
  const column = targetColumn(targetType);

  let openQuery = supabase
    .from('asset_requests')
    .select(`id, ${column}, status, request_type, requester_user_id, created_at`)
    .eq('target_type', targetType)
    .in(column, targetIds)
    .in('status', [...ASSET_REQUEST_OPEN_STATUSES])
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (!viewer.isManager) {
    openQuery = openQuery.eq('requester_user_id', viewer.user_id);
  }
  const { data: openRows, error: openError } = await openQuery;
  if (openError) throw new Error(openError.message);

  for (const row of (openRows ?? []) as unknown as Record<string, unknown>[]) {
    const targetId = row[column] as number;
    const current = stats.open.get(targetId);
    if (current) {
      current.count += 1;
    } else {
      stats.open.set(targetId, {
        count: 1,
        first: {
          id: row.id as number,
          status: row.status as AssetOpenRequestBrief['status'],
          request_type: row.request_type as string
        }
      });
    }
  }

  if (viewer.isManager) {
    const { data: allRows, error: allError } = await supabase
      .from('asset_requests')
      .select(column)
      .eq('target_type', targetType)
      .in(column, targetIds);
    if (allError) throw new Error(allError.message);
    for (const row of (allRows ?? []) as unknown as Record<string, number>[]) {
      const targetId = row[column];
      stats.totals.set(targetId, (stats.totals.get(targetId) ?? 0) + 1);
    }
  }

  return stats;
}

/** 요청 수(상태 무관) — 대장 삭제 가능 판정(D-11) */
export async function countRequestsForTarget(targetType: AssetTargetType, targetId: number): Promise<number> {
  const supabase = getServiceRoleClient();
  const { count, error } = await supabase
    .from('asset_requests')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq(targetColumn(targetType), targetId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countRequests(build: (query: ReturnType<typeof baseCountQuery>) => ReturnType<typeof baseCountQuery>) {
  const { count, error } = await build(baseCountQuery());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function baseCountQuery() {
  return getServiceRoleClient().from('asset_requests').select('id', { count: 'exact', head: true });
}

export async function listAssetRequests(
  filters: Required<Pick<AssetRequestFilters, 'target_type'>> & AssetRequestFilters,
  viewer: Pick<AssetViewer, 'user_id' | 'isManager'>
): Promise<AssetRequestListResponse> {
  const perPage = Math.min(Math.max(filters.perPage ?? 20, 1), MAX_PER_PAGE);
  const page = Math.max(filters.page ?? 1, 1);
  const statusFilter = filters.status ?? 'open';

  const supabase = getServiceRoleClient();
  let query = supabase
    .from('asset_requests')
    .select(REQUEST_COLUMNS, { count: 'exact' })
    .eq('target_type', filters.target_type);

  if (statusFilter === 'open') {
    query = query.in('status', [...ASSET_REQUEST_OPEN_STATUSES]);
  } else if (statusFilter === 'done') {
    query = query.in('status', [...ASSET_REQUEST_DONE_STATUSES]);
  }
  if (!viewer.isManager) {
    query = query.eq('requester_user_id', viewer.user_id);
  } else if (filters.mine_assigned) {
    query = query.eq('assignee_user_id', viewer.user_id);
  }

  const from = (page - 1) * perPage;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + perPage - 1);
  if (error) throw new Error(error.message);

  const [items, pendingCount, myOpenCount] = await Promise.all([
    toRequestListItems((data ?? []) as AssetRequestRow[]),
    viewer.isManager
      ? countRequests((q) => q.eq('target_type', filters.target_type).eq('status', 'pending'))
      : Promise.resolve(null),
    countRequests((q) =>
      q
        .eq('target_type', filters.target_type)
        .eq('requester_user_id', viewer.user_id)
        .in('status', [...ASSET_REQUEST_OPEN_STATUSES])
    )
  ]);

  return {
    items,
    total: count ?? 0,
    page,
    perPage,
    is_manager: viewer.isManager,
    pending_count: pendingCount,
    my_open_count: myOpenCount
  };
}

export async function getAssetRequestSummary(
  viewer: Pick<AssetViewer, 'user_id' | 'isManager'>
): Promise<AssetRequestSummary> {
  const myOpen = (targetType: AssetTargetType) =>
    countRequests((q) =>
      q
        .eq('target_type', targetType)
        .eq('requester_user_id', viewer.user_id)
        .in('status', [...ASSET_REQUEST_OPEN_STATUSES])
    );
  const pending = (targetType: AssetTargetType) =>
    viewer.isManager
      ? countRequests((q) => q.eq('target_type', targetType).eq('status', 'pending'))
      : Promise.resolve(null);

  const [subscriptionPending, equipmentPending, subscriptionMyOpen, equipmentMyOpen] = await Promise.all([
    pending('subscription'),
    pending('equipment'),
    myOpen('subscription'),
    myOpen('equipment')
  ]);

  return {
    is_manager: viewer.isManager,
    subscription_pending: subscriptionPending,
    equipment_pending: equipmentPending,
    subscription_my_open: subscriptionMyOpen,
    equipment_my_open: equipmentMyOpen
  };
}

// ---------------------------------------------------------------------------
// 요청 쓰기
// ---------------------------------------------------------------------------

export function validateRequestBody(body: unknown): string {
  if (typeof body !== 'string') {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.bodyTooShort, 'body');
  }
  const trimmed = body.trim();
  if (trimmed.length < ASSET_REQUEST_BODY_MIN) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.bodyTooShort, 'body');
  }
  if (trimmed.length > ASSET_REQUEST_BODY_MAX) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.bodyTooLong, 'body');
  }
  return trimmed;
}

function truncateLabel(value: string, max = 200): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

async function loadTargetLabel(targetType: AssetTargetType, targetId: number): Promise<string | null> {
  const supabase = getServiceRoleClient();
  if (targetType === 'subscription') {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, name, plan_name')
      .eq('id', targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as { name: string; plan_name: string | null };
    return truncateLabel(row.plan_name ? `${row.name} · ${row.plan_name}` : row.name);
  }
  const { data, error } = await supabase
    .from('equipment_items')
    .select('id, asset_no, model_serial')
    .eq('id', targetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { asset_no: string; model_serial: string | null };
  return truncateLabel(row.model_serial ? `${row.asset_no} · ${row.model_serial}` : row.asset_no);
}

export async function createAssetRequest(input: {
  viewer: AssetViewer;
  targetType: AssetTargetType;
  targetId: number;
  requestType: unknown;
  body: unknown;
}): Promise<AssetRequestRow> {
  if (!isRequestTypeFor(input.targetType, input.requestType)) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.invalidType, 'request_type');
  }
  const body = validateRequestBody(input.body);

  const targetLabel = await loadTargetLabel(input.targetType, input.targetId);
  if (!targetLabel) {
    throw new AssetLedgerError(404, ASSET_REQUEST_MESSAGES.targetNotFound);
  }

  const supabase = getServiceRoleClient();
  const column = targetColumn(input.targetType);
  const { data: existing, error: existingError } = await supabase
    .from('asset_requests')
    .select('id')
    .eq('requester_user_id', input.viewer.user_id)
    .eq('target_type', input.targetType)
    .eq(column, input.targetId)
    .in('status', [...ASSET_REQUEST_OPEN_STATUSES])
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if ((existing ?? []).length > 0) {
    throw new AssetLedgerError(409, ASSET_REQUEST_MESSAGES.duplicateOpen);
  }

  const { data, error } = await supabase
    .from('asset_requests')
    .insert({
      target_type: input.targetType,
      [column]: input.targetId,
      target_label: targetLabel,
      request_type: input.requestType,
      body,
      status: 'pending',
      requester_user_id: input.viewer.user_id,
      requester_name: input.viewer.full_name?.trim() || '이름 없음'
    })
    .select(REQUEST_COLUMNS)
    .single();

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new AssetLedgerError(409, ASSET_REQUEST_MESSAGES.duplicateOpen);
    }
    throw new Error(error.message);
  }
  return data as AssetRequestRow;
}

/** 요청자 + 접수대기 공통 확인 (수정·취소) — 순서: 404 → 403(요청자 아님) → 400(끝난 요청) → 403(처리중) */
function assertRequesterCanModify(row: AssetRequestRow | null, viewer: AssetViewer): AssetRequestRow {
  if (!row || !canViewAssetRequest(row, viewer)) {
    throw new AssetLedgerError(404, ASSET_REQUEST_MESSAGES.notFound);
  }
  if (row.requester_user_id !== viewer.user_id) {
    throw new AssetLedgerError(403, ASSET_REQUEST_MESSAGES.requesterOnly);
  }
  if (isTerminalStatus(row.status)) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.alreadyDone);
  }
  if (row.status !== 'pending') {
    throw new AssetLedgerError(403, ASSET_REQUEST_MESSAGES.onlyPending);
  }
  return row;
}

export async function updateAssetRequestContent(input: {
  id: number;
  viewer: AssetViewer;
  requestType?: unknown;
  body?: unknown;
}): Promise<{ before: AssetRequestRow; after: AssetRequestRow; changedFields: string[] }> {
  const before = assertRequesterCanModify(await getAssetRequestRow(input.id), input.viewer);

  const patch: Record<string, unknown> = {};
  if (input.requestType !== undefined) {
    if (!isRequestTypeFor(before.target_type, input.requestType)) {
      throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.invalidType, 'request_type');
    }
    patch.request_type = input.requestType;
  }
  if (input.body !== undefined) {
    patch.body = validateRequestBody(input.body);
  }
  if (Object.keys(patch).length === 0) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.bodyTooShort, 'body');
  }

  const changedFields = Object.keys(patch).filter(
    (key) => patch[key] !== (before as Record<string, unknown>)[key]
  );
  if (changedFields.length === 0) {
    return { before, after: before, changedFields };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_requests')
    .update({ ...patch, edited_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('status', 'pending')
    .select(REQUEST_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AssetLedgerError(403, ASSET_REQUEST_MESSAGES.onlyPending);
  return { before, after: data as AssetRequestRow, changedFields };
}

export async function cancelAssetRequest(input: {
  id: number;
  viewer: AssetViewer;
}): Promise<{ before: AssetRequestRow; after: AssetRequestRow }> {
  const before = assertRequesterCanModify(await getAssetRequestRow(input.id), input.viewer);
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_requests')
    .update({
      status: 'canceled',
      status_updated_at: new Date().toISOString(),
      status_updated_by: input.viewer.user_id
    })
    .eq('id', input.id)
    .eq('status', 'pending')
    .select(REQUEST_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AssetLedgerError(403, ASSET_REQUEST_MESSAGES.onlyPending);
  return { before, after: data as AssetRequestRow };
}

const MANAGER_TARGET_STATUSES = ['in_progress', 'completed', 'rejected'] as const;
type ManagerTargetStatus = (typeof MANAGER_TARGET_STATUSES)[number];

export function isManagerTargetStatus(value: unknown): value is ManagerTargetStatus {
  return typeof value === 'string' && (MANAGER_TARGET_STATUSES as readonly string[]).includes(value);
}

/** 권한자 상태 변경 (plan §요청 상태 전이 · 서버 강제). 권한자 확인은 Route가 먼저 한다 */
export async function changeAssetRequestStatus(input: {
  id: number;
  viewer: AssetViewer;
  status: unknown;
  rejectReason?: unknown;
}): Promise<{ before: AssetRequestRow; after: AssetRequestRow }> {
  const before = await getAssetRequestRow(input.id);
  if (!before) {
    throw new AssetLedgerError(404, ASSET_REQUEST_MESSAGES.notFound);
  }
  if (isTerminalStatus(before.status)) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.alreadyDone);
  }
  if (!isManagerTargetStatus(input.status)) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.invalidStatus, 'status');
  }
  if (before.status === 'pending' && input.status === 'completed') {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.startFirst);
  }
  if (before.status === 'in_progress' && input.status === 'in_progress') {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.alreadyInProgress);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    status_updated_at: now,
    status_updated_by: input.viewer.user_id
  };

  if (input.status === 'rejected') {
    const reason = typeof input.rejectReason === 'string' ? input.rejectReason.trim() : '';
    if (reason.length === 0) {
      throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.rejectReasonRequired, 'reject_reason');
    }
    if (reason.length > ASSET_REJECT_REASON_MAX) {
      throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.rejectReasonTooLong, 'reject_reason');
    }
    patch.reject_reason = reason;
  }

  if (input.status === 'in_progress' && !before.assignee_user_id) {
    patch.assignee_user_id = input.viewer.user_id;
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_requests')
    .update(patch)
    .eq('id', input.id)
    .eq('status', before.status)
    .select(REQUEST_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.statusChanged);
  return { before, after: data as AssetRequestRow };
}

/** 담당자 변경 — 처리중만 · 후보 = active 권한자 */
export async function changeAssetRequestAssignee(input: {
  id: number;
  viewer: AssetViewer;
  assigneeUserId: unknown;
}): Promise<{ before: AssetRequestRow; after: AssetRequestRow; changed: boolean }> {
  const before = await getAssetRequestRow(input.id);
  if (!before) {
    throw new AssetLedgerError(404, ASSET_REQUEST_MESSAGES.notFound);
  }
  if (before.status !== 'in_progress') {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.assigneeOnlyInProgress);
  }
  if (typeof input.assigneeUserId !== 'string' || input.assigneeUserId.length === 0) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.invalidAssignee, 'assignee_user_id');
  }
  const people = await fetchPeopleByIds([input.assigneeUserId]);
  const candidate = people.get(input.assigneeUserId);
  if (!candidate || candidate.status !== 'active' || !isLedgerPersonManager(candidate)) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.invalidAssignee, 'assignee_user_id');
  }
  if (before.assignee_user_id === input.assigneeUserId) {
    return { before, after: before, changed: false };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_requests')
    .update({ assignee_user_id: input.assigneeUserId })
    .eq('id', input.id)
    .eq('status', 'in_progress')
    .select(REQUEST_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.assigneeOnlyInProgress);
  return { before, after: data as AssetRequestRow, changed: true };
}

// ---------------------------------------------------------------------------
// 댓글
// ---------------------------------------------------------------------------

function authorRole(row: Pick<CommentRow, 'author_user_id'>, request: AssetRequestRow): AssetCommentAuthorRole {
  if (row.author_user_id === request.requester_user_id) return 'requester';
  if (row.author_user_id === request.assignee_user_id) return 'assignee';
  return 'manager';
}

function mapComment(row: CommentRow, request: AssetRequestRow, people: Map<string, LedgerPerson>): AssetRequestComment {
  const author = people.get(row.author_user_id);
  return {
    id: row.id,
    request_id: row.request_id,
    author_user_id: row.author_user_id,
    author_name: personName(author),
    author_role: authorRole(row, request),
    author_is_manager: author ? isLedgerPersonManager(author) : false,
    parent_id: row.parent_id,
    root_comment_id: row.root_comment_id,
    path: row.path,
    depth: row.depth,
    body: row.is_deleted ? '' : row.body,
    is_deleted: row.is_deleted,
    edited_at: row.edited_at,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function listAssetRequestComments(request: AssetRequestRow): Promise<AssetRequestComment[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_request_comments')
    .select(COMMENT_COLUMNS)
    .eq('request_id', request.id)
    .order('path', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CommentRow[];
  const people = await fetchPeopleByIds(rows.map((row) => row.author_user_id));
  return rows.map((row) => mapComment(row, request, people));
}

async function getCommentRow(requestId: number, commentId: number): Promise<CommentRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_request_comments')
    .select(COMMENT_COLUMNS)
    .eq('request_id', requestId)
    .eq('id', commentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CommentRow | null) ?? null;
}

async function mapSingleComment(row: CommentRow, request: AssetRequestRow): Promise<AssetRequestComment> {
  const people = await fetchPeopleByIds([row.author_user_id]);
  return mapComment(row, request, people);
}

export function validateCommentBody(body: unknown): string {
  if (typeof body !== 'string' || body.trim().length === 0) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.commentRequired, 'body');
  }
  const trimmed = body.trim();
  if (trimmed.length > ASSET_COMMENT_BODY_MAX) {
    throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.commentTooLong, 'body');
  }
  return trimmed;
}

export async function createAssetRequestComment(input: {
  request: AssetRequestRow;
  authorUserId: string;
  body: unknown;
  parentId?: number | null;
}): Promise<AssetRequestComment> {
  const body = validateCommentBody(input.body);
  if (input.parentId) {
    const parent = await getCommentRow(input.request.id, input.parentId);
    if (!parent) throw new AssetLedgerError(404, ASSET_REQUEST_MESSAGES.commentNotFound);
    if (parent.is_deleted) throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.commentDeleted);
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_request_comments')
    .insert({
      request_id: input.request.id,
      author_user_id: input.authorUserId,
      parent_id: input.parentId ?? null,
      body
    })
    .select(COMMENT_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? '댓글 등록 중 오류가 발생했습니다.');
  return mapSingleComment(data as CommentRow, input.request);
}

export async function updateAssetRequestComment(input: {
  request: AssetRequestRow;
  commentId: number;
  viewer: AssetViewer;
  body: unknown;
}): Promise<AssetRequestComment> {
  const existing = await getCommentRow(input.request.id, input.commentId);
  if (!existing) throw new AssetLedgerError(404, ASSET_REQUEST_MESSAGES.commentNotFound);
  if (existing.author_user_id !== input.viewer.user_id) {
    throw new AssetLedgerError(403, ASSET_REQUEST_MESSAGES.commentAuthorOnly);
  }
  if (existing.is_deleted) throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.commentDeleted);
  const body = validateCommentBody(input.body);

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_request_comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('request_id', input.request.id)
    .eq('id', input.commentId)
    .eq('is_deleted', false)
    .select(COMMENT_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AssetLedgerError(400, ASSET_REQUEST_MESSAGES.commentDeleted);
  return mapSingleComment(data as CommentRow, input.request);
}

export async function deleteAssetRequestComment(input: {
  request: AssetRequestRow;
  commentId: number;
  viewer: AssetViewer;
}): Promise<{ comment: AssetRequestComment; deletedByManager: boolean }> {
  const existing = await getCommentRow(input.request.id, input.commentId);
  if (!existing) throw new AssetLedgerError(404, ASSET_REQUEST_MESSAGES.commentNotFound);
  const isAuthor = existing.author_user_id === input.viewer.user_id;
  if (!isAuthor && !input.viewer.isManager) {
    throw new AssetLedgerError(403, ASSET_REQUEST_MESSAGES.commentDeleteForbidden);
  }
  const deletedByManager = !isAuthor;
  if (existing.is_deleted) {
    return { comment: await mapSingleComment(existing, input.request), deletedByManager };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('asset_request_comments')
    .update({
      body: DELETED_COMMENT_BODY,
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: input.viewer.user_id
    })
    .eq('request_id', input.request.id)
    .eq('id', input.commentId)
    .select(COMMENT_COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? '댓글 삭제 중 오류가 발생했습니다.');
  return { comment: await mapSingleComment(data as CommentRow, input.request), deletedByManager };
}
