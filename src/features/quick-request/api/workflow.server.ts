import 'server-only';

import type { AuthProfile } from '@/features/auth/api/types';
import {
  canCreateQuickRequest,
  canOperateQuickRequests,
  canViewAllQuickRequests,
  isQuickAdmin
} from '@/features/auth/api/quick-access.server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { buildQuickRouteSummary } from '../lib/quick-request-route-label';
import type { QuickRange } from '../lib/quick-request-range';
import {
  QUICK_REQUEST_EDITABLE_STATUSES,
  QUICK_REQUEST_LIST_DEFAULT_LIMIT,
  QUICK_REQUEST_LIST_MAX_LIMIT,
  QUICK_REQUEST_STATUSES,
  type QuickRequestCreateBody,
  type QuickRequestStatus
} from '../schemas/quick-request-workflow';
import type {
  QuickRequestActorRef,
  QuickRequestDestinationDetail,
  QuickRequestDetail,
  QuickRequestListRow,
  QuickRequestLocation,
  QuickRequestOriginDetail,
  QuickRequestPermissions,
  QuickRequestRangeEcho,
  QuickRequestRowActions,
  QuickRequestStatusCounts,
  QuickRequestSummary,
  QuickRequestViewer
} from './types';

/**
 * plan 89 — 퀵 요청 서버 데이터 접근 (service role).
 * 조회 범위·권한은 여기서 계산하고, Route Handler는 응답·로그·분기만 맡는다.
 */

const TABLE = 'quick_requests';
/** PostgREST: offset이 전체 건수를 넘으면 416 (빈 페이지로 처리) */
const RANGE_NOT_SATISFIABLE = 'PGRST103';

export const QUICK_REQUEST_COLUMNS =
  'id, request_no, status, requester_user_id, requester_name, requester_phone, goods_size, item_description, vehicle_types, vehicle_other_text, vehicle_count, freight_payment, origin, stopovers, destination, requested_at, estimated_amount, final_amount, dispatch_vehicle_info, driver_name, driver_phone, accepted_at, accepted_by, dispatched_at, dispatched_by, final_amount_set_at, final_amount_set_by, approved_at, approved_by, cancelled_at, cancelled_by, cancel_reason, created_at, updated_at';

type JsonLocation = Partial<QuickRequestLocation> & {
  schedule?: { mode: string; datetimeIso?: string };
  notes?: unknown;
  memo?: string | null;
};

export type QuickRequestRow = {
  id: string;
  request_no: string;
  status: QuickRequestStatus;
  requester_user_id: string;
  requester_name: string;
  requester_phone: string | null;
  goods_size: QuickRequestDetail['goodsSize'];
  item_description: string;
  vehicle_types: string[];
  vehicle_other_text: string | null;
  vehicle_count: number;
  freight_payment: 'monthly' | 'collect';
  origin: JsonLocation;
  stopovers: JsonLocation[];
  destination: JsonLocation;
  requested_at: string;
  estimated_amount: number | null;
  final_amount: number | null;
  dispatch_vehicle_info: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  dispatched_at: string | null;
  dispatched_by: string | null;
  final_amount_set_at: string | null;
  final_amount_set_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// 권한
// ---------------------------------------------------------------------------

export type QuickViewerProfile = Pick<
  AuthProfile,
  'user_id' | 'system_role' | 'affiliation' | 'rank' | 'status'
>;

export function buildQuickRequestViewer(profile: QuickViewerProfile): QuickRequestViewer {
  return {
    scope: canViewAllQuickRequests(profile) ? 'all' : 'own',
    canOperate: canOperateQuickRequests(profile),
    canCreate: canCreateQuickRequest(profile)
  };
}

/** 규칙만으로 판정되는 조회 권한 (요청자 본인 · viewer-all). 초대 참여자는 `resolveQuickRequestAccess`(DB 조회)로 확인한다 */
export function canViewQuickRequest(profile: QuickViewerProfile, row: QuickRequestRow): boolean {
  return row.requester_user_id === profile.user_id || canViewAllQuickRequests(profile);
}

export type QuickRequestAccess = {
  canView: boolean;
  /** plan 101 — 활성 초대 참여자(`quick_request_participants.removed_at null`) · 요청자·viewer-all이면 false */
  isParticipant: boolean;
};

/** 활성 초대 참여자 여부 (SQL 97 `private.is_quick_request_participant`와 같은 조건 · service role) */
export async function isActiveQuickRequestParticipant(userId: string, requestId: string): Promise<boolean> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('quick_request_participants')
    .select('id')
    .eq('quick_request_id', requestId)
    .eq('user_id', userId)
    .is('removed_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return Boolean(data);
}

/** 내가 활성 참여자인 건 id 전체 (대시보드·대화 목록 범위 · 부분 인덱스 idx_qrp_user_active) */
export async function listParticipantRequestIds(userId: string): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('quick_request_participants')
    .select('quick_request_id')
    .eq('user_id', userId)
    .is('removed_at', null);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row.quick_request_id as string);
}

/**
 * plan 101 D-11 — 조회 권한 = 요청자 OR viewer-all OR 활성 초대 참여자 (`private.can_view_quick_request`와 같은 규칙).
 * 규칙으로 통과하면 DB를 보지 않는다. `isParticipant`는 규칙 통과자에게는 항상 false(요청자·admin은 초대 대상이 아니다).
 */
export async function resolveQuickRequestAccess(
  profile: QuickViewerProfile,
  row: QuickRequestRow
): Promise<QuickRequestAccess> {
  if (canViewQuickRequest(profile, row)) {
    return { canView: true, isParticipant: false };
  }
  const isParticipant = await isActiveQuickRequestParticipant(profile.user_id, row.id);
  return { canView: isParticipant, isParticipant };
}

export function isQuickRequestLocked(status: QuickRequestStatus): boolean {
  return status === 'approved' || status === 'cancelled';
}

export function isQuickRequestEditableStatus(status: QuickRequestStatus): boolean {
  return (QUICK_REQUEST_EDITABLE_STATUSES as readonly string[]).includes(status);
}

/** 승인 가능한 역할 (요청자 본인 · admin). 동방특송은 불가 */
export function canApproveRole(profile: QuickViewerProfile, row: QuickRequestRow): boolean {
  if (profile.affiliation === 'dongbang') return false;
  return row.requester_user_id === profile.user_id || isQuickAdmin(profile);
}

export function buildQuickRequestPermissions(
  profile: QuickViewerProfile,
  row: QuickRequestRow,
  isParticipant = false
): QuickRequestPermissions {
  const operate = canOperateQuickRequests(profile);
  const isRequester = row.requester_user_id === profile.user_id;
  const editable = isQuickRequestEditableStatus(row.status);

  // plan 101 D-4 — 초대 참여자는 읽기·대화만 (permissions 전부 false + isParticipant)
  if (isParticipant) {
    return {
      canEdit: false,
      canAccept: false,
      canDispatch: false,
      canSetFinal: false,
      canApprove: false,
      canCancel: false,
      canOperate: false,
      isParticipant: true
    };
  }

  return {
    canEdit: operate && editable,
    canAccept: operate && row.status === 'requested',
    canDispatch: operate && row.status === 'dispatching',
    canSetFinal: operate && row.status === 'dispatched',
    canApprove: canApproveRole(profile, row) && row.status === 'dispatched',
    canCancel: (operate && editable) || (isRequester && row.status === 'requested'),
    canOperate: operate,
    isParticipant: false
  };
}

function buildRowActions(profile: QuickViewerProfile, row: QuickRequestRow): QuickRequestRowActions {
  const operate = canOperateQuickRequests(profile);
  return {
    accept: operate && row.status === 'requested',
    dispatch: operate && row.status === 'dispatching',
    setFinal: operate && row.status === 'dispatched' && row.final_amount == null,
    approve: canApproveRole(profile, row) && row.status === 'dispatched'
  };
}

// ---------------------------------------------------------------------------
// 매핑
// ---------------------------------------------------------------------------

function toLocation(value: JsonLocation | null | undefined): QuickRequestLocation {
  return {
    roadAddress: value?.roadAddress ?? '',
    detailAddress: value?.detailAddress ?? '',
    contactName: value?.contactName ?? '',
    contactPhone: value?.contactPhone ?? ''
  };
}

function toNotes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toOriginDetail(value: JsonLocation): QuickRequestOriginDetail {
  const schedule =
    value?.schedule?.mode === 'scheduled' && value.schedule.datetimeIso
      ? { mode: 'scheduled' as const, datetimeIso: value.schedule.datetimeIso }
      : { mode: 'immediate' as const };
  return {
    ...toLocation(value),
    schedule,
    notes: toNotes(value?.notes),
    memo: value?.memo?.trim() ? value.memo : null
  };
}

function toDestinationDetail(value: JsonLocation): QuickRequestDestinationDetail {
  const schedule =
    value?.schedule?.mode === 'scheduled' && value.schedule.datetimeIso
      ? { mode: 'scheduled' as const, datetimeIso: value.schedule.datetimeIso }
      : { mode: 'asap' as const };
  return {
    ...toLocation(value),
    schedule,
    notes: toNotes(value?.notes),
    memo: value?.memo?.trim() ? value.memo : null
  };
}

export function toQuickRequestListRow(
  profile: QuickViewerProfile,
  row: QuickRequestRow,
  unreadMessageCount = 0,
  isParticipant = false
): QuickRequestListRow {
  return {
    id: row.id,
    unreadMessageCount,
    isParticipant,
    requestNo: row.request_no,
    status: row.status,
    requestedAt: row.requested_at,
    requester: { userId: row.requester_user_id, name: row.requester_name },
    route: buildQuickRouteSummary(row.origin, row.destination, row.stopovers),
    goodsSize: row.goods_size,
    itemDescription: row.item_description,
    vehicleTypes: row.vehicle_types ?? [],
    vehicleOtherText: row.vehicle_other_text,
    vehicleCount: row.vehicle_count,
    estimatedAmount: row.estimated_amount,
    finalAmount: row.final_amount,
    actions: isParticipant
      ? { accept: false, dispatch: false, setFinal: false, approve: false }
      : buildRowActions(profile, row)
  };
}

// ---------------------------------------------------------------------------
// 조회 (plan 97 D-3 — 기간·상태·검색·권한을 DB에서 필터 + `range()` + `count:'exact'`)
// ---------------------------------------------------------------------------

export async function getQuickRequestByNo(requestNo: string): Promise<QuickRequestRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(QUICK_REQUEST_COLUMNS)
    .eq('request_no', requestNo)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as QuickRequestRow | null) ?? null;
}

function emptyCounts(): QuickRequestStatusCounts {
  return Object.fromEntries(QUICK_REQUEST_STATUSES.map((status) => [status, 0])) as QuickRequestStatusCounts;
}

export function normalizeQuickRequestSearch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** LIKE 메타문자 이스케이프 (`\` → `\\`, `%` → `\%`, `_` → `\_`) — Postgres 기본 escape 문자는 `\` */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function toQuickRequestRangeEcho(range: QuickRange): QuickRequestRangeEcho {
  return { kind: range.kind, from: range.from, to: range.to };
}

export type QuickRequestListQuery = {
  range: QuickRange;
  status?: QuickRequestStatus | null;
  search?: string | null;
  page?: number;
  limit?: number;
};

type QuickRequestFilterParams = {
  range: QuickRange;
  status?: QuickRequestStatus | null;
  keyword?: string;
  /** plan 101 — 내가 활성 참여자인 건 id (비-viewer-all만 사용 · `listParticipantRequestIds`) */
  participantRequestIds?: readonly string[];
};

type PostgrestFilter =
  | { kind: 'filter'; column: string; operator: string; value: string }
  | { kind: 'or'; filters: string };

/**
 * 기간(KST · `requested_at`) + 조회 범위(본인 | viewer-all) + 상태 + 검색 → PostgREST 필터 목록.
 * 검색은 SQL 95 generated column `search_text`(요청번호·요청자·출발/경유/도착 도로명+상세 · lower) `ilike` — OQ-1 결정.
 * plan 101 D-11 — 비-viewer-all은 `requester_user_id = me OR id in (활성 참여 건)`.
 */
function buildQuickRequestFilters(
  profile: QuickViewerProfile,
  params: QuickRequestFilterParams
): PostgrestFilter[] {
  const filters: PostgrestFilter[] = [];
  if (params.range.fromIso) {
    filters.push({ kind: 'filter', column: 'requested_at', operator: 'gte', value: params.range.fromIso });
  }
  if (params.range.toIso) {
    filters.push({ kind: 'filter', column: 'requested_at', operator: 'lt', value: params.range.toIso });
  }
  if (!canViewAllQuickRequests(profile)) {
    const participantIds = params.participantRequestIds ?? [];
    if (participantIds.length > 0) {
      filters.push({
        kind: 'or',
        filters: `requester_user_id.eq.${profile.user_id},id.in.(${participantIds.join(',')})`
      });
    } else {
      filters.push({ kind: 'filter', column: 'requester_user_id', operator: 'eq', value: profile.user_id });
    }
  }
  if (params.status) filters.push({ kind: 'filter', column: 'status', operator: 'eq', value: params.status });
  if (params.keyword) {
    filters.push({
      kind: 'filter',
      column: 'search_text',
      operator: 'ilike',
      value: `%${escapeLikePattern(params.keyword)}%`
    });
  }
  return filters;
}

/** 비-viewer-all 사용자만 참여 건 id를 조회한다 (viewer-all은 범위 필터가 없다) */
async function resolveParticipantRequestIds(profile: QuickViewerProfile): Promise<string[]> {
  return canViewAllQuickRequests(profile) ? [] : listParticipantRequestIds(profile.user_id);
}

export function clampQuickRequestListLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? QUICK_REQUEST_LIST_DEFAULT_LIMIT, 1), QUICK_REQUEST_LIST_MAX_LIMIT);
}

export async function listQuickRequestsForViewer(
  profile: QuickViewerProfile,
  filters: QuickRequestListQuery
): Promise<{
  rows: QuickRequestListRow[];
  total: number;
  page: number;
  limit: number;
  range: QuickRequestRangeEcho;
  viewer: QuickRequestViewer;
}> {
  const keyword = filters.search ? normalizeQuickRequestSearch(filters.search) : '';
  const limit = clampQuickRequestListLimit(filters.limit);
  const page = Math.max(filters.page ?? 1, 1);
  const start = (page - 1) * limit;
  const supabase = getServiceRoleClient();
  const participantRequestIds = await resolveParticipantRequestIds(profile);
  const participantSet = new Set(participantRequestIds);

  let query = supabase.from(TABLE).select(QUICK_REQUEST_COLUMNS, { count: 'exact' });
  for (const filter of buildQuickRequestFilters(profile, {
    range: filters.range,
    status: filters.status,
    keyword,
    participantRequestIds
  })) {
    query = filter.kind === 'or' ? query.or(filter.filters) : query.filter(filter.column, filter.operator, filter.value);
  }
  const { data, error, count } = await query
    .order('requested_at', { ascending: false })
    .order('request_seq', { ascending: false })
    .range(start, start + limit - 1);

  let pageRows = (data ?? []) as QuickRequestRow[];
  let total = count ?? 0;

  if (error) {
    if (error.code !== RANGE_NOT_SATISFIABLE) {
      throw new Error(error.message);
    }
    // offset이 전체 건수를 넘는 페이지 — 빈 행 + 정확한 total
    pageRows = [];
    total = await countQuickRequests(profile, {
      range: filters.range,
      status: filters.status,
      keyword,
      participantRequestIds
    });
  }

  // plan 93 — 화면에 있는 건 id만 RPC 1회 (안 읽은 수 집계 비용 완화 ②)
  const unread = await fetchQuickRequestUnreadCounts(
    profile.user_id,
    pageRows.map((row) => row.id)
  );

  return {
    rows: pageRows.map((row) =>
      toQuickRequestListRow(
        profile,
        row,
        unread.get(row.id) ?? 0,
        participantSet.has(row.id) && row.requester_user_id !== profile.user_id
      )
    ),
    total,
    page,
    limit,
    range: toQuickRequestRangeEcho(filters.range),
    viewer: buildQuickRequestViewer(profile)
  };
}

async function countQuickRequests(
  profile: QuickViewerProfile,
  params: QuickRequestFilterParams
): Promise<number> {
  const supabase = getServiceRoleClient();
  let query = supabase.from(TABLE).select('id', { count: 'exact', head: true });
  for (const filter of buildQuickRequestFilters(profile, params)) {
    query = filter.kind === 'or' ? query.or(filter.filters) : query.filter(filter.column, filter.operator, filter.value);
  }
  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

/** 카드 숫자 — 선택 기간 기준 5상태 count (상태별 head count 병렬 · status·search 무관) */
export async function getQuickRequestSummaryForViewer(
  profile: QuickViewerProfile,
  range: QuickRange
): Promise<QuickRequestSummary> {
  const counts = emptyCounts();
  const participantRequestIds = await resolveParticipantRequestIds(profile);
  const results = await Promise.all(
    QUICK_REQUEST_STATUSES.map((status) => countQuickRequests(profile, { range, status, participantRequestIds }))
  );
  QUICK_REQUEST_STATUSES.forEach((status, index) => {
    counts[status] = results[index];
  });

  return {
    counts,
    range: { kind: range.kind, fromDate: range.from, toDate: range.to },
    viewer: buildQuickRequestViewer(profile)
  };
}

async function fetchProfileNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', unique);

  if (error) {
    throw new Error(error.message);
  }

  for (const profile of data ?? []) {
    const name = (profile.full_name as string | null)?.trim() || (profile.email as string | null) || '알 수 없음';
    names.set(profile.user_id as string, name);
  }
  return names;
}

export async function buildQuickRequestDetail(
  profile: QuickViewerProfile,
  row: QuickRequestRow,
  options: { isParticipant?: boolean } = {}
): Promise<QuickRequestDetail> {
  const permissions = buildQuickRequestPermissions(profile, row, options.isParticipant ?? false);
  const names = await fetchProfileNames(
    [
      row.accepted_by,
      row.dispatched_by,
      row.final_amount_set_by,
      row.approved_by,
      row.cancelled_by
    ].filter((id): id is string => Boolean(id))
  );
  const ref = (id: string | null): QuickRequestActorRef =>
    id ? { name: names.get(id) ?? '알 수 없음' } : null;

  return {
    id: row.id,
    requestNo: row.request_no,
    status: row.status,
    requestedAt: row.requested_at,
    requester: {
      userId: row.requester_user_id,
      name: row.requester_name,
      phone: row.requester_phone
    },
    goodsSize: row.goods_size,
    itemDescription: row.item_description,
    vehicleTypes: row.vehicle_types ?? [],
    vehicleOtherText: row.vehicle_other_text,
    vehicleCount: row.vehicle_count,
    freightPayment: row.freight_payment,
    origin: toOriginDetail(row.origin),
    stopovers: (Array.isArray(row.stopovers) ? row.stopovers : []).map(toLocation),
    destination: toDestinationDetail(row.destination),
    dispatch: {
      estimatedAmount: row.estimated_amount,
      vehicleInfo: row.dispatch_vehicle_info,
      driverName: row.driver_name,
      driverPhone: row.driver_phone
    },
    finalAmount: row.final_amount,
    history: {
      acceptedAt: row.accepted_at,
      acceptedBy: ref(row.accepted_by),
      dispatchedAt: row.dispatched_at,
      dispatchedBy: ref(row.dispatched_by),
      finalAmountSetAt: row.final_amount_set_at,
      finalAmountSetBy: ref(row.final_amount_set_by),
      approvedAt: row.approved_at,
      approvedBy: ref(row.approved_by),
      cancelledAt: row.cancelled_at,
      cancelledBy: ref(row.cancelled_by),
      cancelReason: row.cancel_reason
    },
    permissions
  };
}

// ---------------------------------------------------------------------------
// 쓰기
// ---------------------------------------------------------------------------

export class QuickRequestRequesterForbiddenError extends Error {
  constructor() {
    super('quick_request_requester_forbidden');
  }
}

/** 번호 발급 + insert (RPC 한 트랜잭션). 요청자 이름·연락처는 profiles 스냅샷 */
export async function createQuickRequestRecord(
  requesterUserId: string,
  body: QuickRequestCreateBody
): Promise<QuickRequestRow> {
  const supabase = getServiceRoleClient();
  const payload = {
    goodsSize: body.goodsSize,
    itemDescription: body.goodsSize === 'other' ? body.itemDescription.trim() : '',
    vehicleTypes: body.vehicleTypes,
    vehicleOtherText: body.vehicleTypes.includes('기타') ? body.vehicleOtherText?.trim() ?? '' : '',
    vehicleCount: body.vehicleCount,
    freightPayment: body.freightPayment,
    origin: body.origin,
    stopovers: body.stopovers,
    destination: body.destination
  };

  const { data, error } = await supabase.rpc('create_quick_request', {
    p_requester: requesterUserId,
    p_payload: payload
  });

  if (error) {
    if (error.message?.includes('quick_request_requester_forbidden')) {
      throw new QuickRequestRequesterForbiddenError();
    }
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as QuickRequestRow | null;
  if (!row?.id) {
    throw new Error('create_quick_request returned no row');
  }

  // RPC 반환 행에는 jsonb가 그대로 온다. 컬럼 집합을 맞추기 위해 다시 읽지 않는다
  return row;
}

/**
 * 조건부 update (`where id = ? and status = 기대값`). 경합으로 0행이면 null.
 * Postgres 행 잠금 후 WHERE 재평가로 동시 요청 중 하나만 성공한다 (AC-21).
 */
export async function updateQuickRequestIfStatus(
  id: string,
  expectedStatus: QuickRequestStatus,
  values: Record<string, unknown>
): Promise<QuickRequestRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update(values)
    .eq('id', id)
    .eq('status', expectedStatus)
    .select(QUICK_REQUEST_COLUMNS)
    .maybeSingle();

  if (error) {
    // 잠금 trigger(approved/cancelled)·전이 위반은 경합으로 본다
    if (
      error.message?.includes('quick_request_locked') ||
      error.message?.includes('quick_request_invalid_transition')
    ) {
      return null;
    }
    throw new Error(error.message);
  }

  return (data as QuickRequestRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// 알림 수신자 (plan 92 D-4 · active만)
// ---------------------------------------------------------------------------

async function listActiveUserIds(match: Record<string, string>): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('status', 'active')
    .match(match);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.user_id as string);
}

/** 동방특송 전원 (`affiliation='dongbang'`) */
export function listActiveDongbangUserIds(): Promise<string[]> {
  return listActiveUserIds({ affiliation: 'dongbang' });
}

/** admin 전원 (`system_role='admin'` · OQ-2) */
export function listActiveQuickAdminUserIds(): Promise<string[]> {
  return listActiveUserIds({ system_role: 'admin' });
}

/** 웨이크 구매물류팀 (89 D-11 `isLogisticsViewer`와 동일 판별) */
export function listActiveLogisticsUserIds(): Promise<string[]> {
  return listActiveUserIds({ affiliation: 'wake', rank: '구매물류팀', system_role: 'user' });
}

// ---------------------------------------------------------------------------
// plan 93 — 안 읽은 대화 수 (지정한 건 목록 · SQL 92 `quick_request_unread_counts`)
// ---------------------------------------------------------------------------

/** 건 id → 내가 안 읽은 메시지 수 (작성자≠본인 · id > 내 읽음 위치). 없는 건은 0 */
export async function fetchQuickRequestUnreadCounts(
  userId: string,
  requestIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (requestIds.length === 0) return map;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.rpc('quick_request_unread_counts', {
    p_user: userId,
    p_request_ids: requestIds
  });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as { quick_request_id: string; unread_count: number }[]) {
    map.set(row.quick_request_id, Number(row.unread_count));
  }
  return map;
}
