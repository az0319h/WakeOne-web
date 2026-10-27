import 'server-only';

import type { AuthProfile } from '@/features/auth/api/types';
import {
  canCreateQuickRequest,
  canOperateQuickRequests,
  canViewAllQuickRequests,
  isQuickAdmin
} from '@/features/auth/api/quick-access.server';
import { getKstTodayDateString } from '@/lib/kst';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { buildQuickRouteSummary } from '../lib/quick-request-route-label';
import {
  QUICK_REQUEST_DASHBOARD_DAYS,
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
  QuickRequestListFilters,
  QuickRequestListRow,
  QuickRequestLocation,
  QuickRequestOriginDetail,
  QuickRequestPermissions,
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
/** 7일 window 안전 상한 (in-memory 검색·페이지) */
const WINDOW_ROW_LIMIT = 2_000;

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

export function canViewQuickRequest(profile: QuickViewerProfile, row: QuickRequestRow): boolean {
  return row.requester_user_id === profile.user_id || canViewAllQuickRequests(profile);
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
  row: QuickRequestRow
): QuickRequestPermissions {
  const operate = canOperateQuickRequests(profile);
  const isRequester = row.requester_user_id === profile.user_id;
  const editable = isQuickRequestEditableStatus(row.status);

  return {
    canEdit: operate && editable,
    canAccept: operate && row.status === 'requested',
    canDispatch: operate && row.status === 'dispatching',
    canSetFinal: operate && row.status === 'dispatched',
    canApprove: canApproveRole(profile, row) && row.status === 'dispatched',
    canCancel: (operate && editable) || (isRequester && row.status === 'requested'),
    canOperate: operate
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
  row: QuickRequestRow
): QuickRequestListRow {
  return {
    id: row.id,
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
    actions: buildRowActions(profile, row)
  };
}

// ---------------------------------------------------------------------------
// 기간 (KST 오늘 포함 7일)
// ---------------------------------------------------------------------------

export function getQuickDashboardRange(now = new Date()): {
  fromDate: string;
  toDate: string;
  fromIso: string;
} {
  const toDate = getKstTodayDateString(now);
  const [year, month, day] = toDate.split('-').map(Number);
  const from = new Date(Date.UTC(year, month - 1, day - (QUICK_REQUEST_DASHBOARD_DAYS - 1)));
  const fromDate = from.toISOString().slice(0, 10);
  return { fromDate, toDate, fromIso: `${fromDate}T00:00:00+09:00` };
}

// ---------------------------------------------------------------------------
// 조회
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

async function listWindowRows(profile: QuickViewerProfile): Promise<QuickRequestRow[]> {
  const { fromIso } = getQuickDashboardRange();
  const supabase = getServiceRoleClient();
  let query = supabase
    .from(TABLE)
    .select(QUICK_REQUEST_COLUMNS)
    .gte('requested_at', fromIso)
    .order('requested_at', { ascending: false })
    .order('request_seq', { ascending: false })
    .limit(WINDOW_ROW_LIMIT);

  if (!canViewAllQuickRequests(profile)) {
    query = query.eq('requester_user_id', profile.user_id);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as QuickRequestRow[];
}

function emptyCounts(): QuickRequestStatusCounts {
  return Object.fromEntries(QUICK_REQUEST_STATUSES.map((status) => [status, 0])) as QuickRequestStatusCounts;
}

function countByStatus(rows: QuickRequestRow[]): QuickRequestStatusCounts {
  const counts = emptyCounts();
  for (const row of rows) {
    counts[row.status] += 1;
  }
  return counts;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesSearch(row: QuickRequestRow, keyword: string): boolean {
  const locations = [row.origin, row.destination, ...(Array.isArray(row.stopovers) ? row.stopovers : [])];
  const haystack = [
    row.request_no,
    row.requester_name,
    ...locations.flatMap((location) => [location?.roadAddress ?? '', location?.detailAddress ?? ''])
  ]
    .join('\n')
    .toLowerCase();
  return haystack.includes(keyword);
}

export async function listQuickRequestsForViewer(
  profile: QuickViewerProfile,
  filters: QuickRequestListFilters
): Promise<{
  rows: QuickRequestListRow[];
  total: number;
  page: number;
  limit: number;
  counts: QuickRequestStatusCounts;
  viewer: QuickRequestViewer;
}> {
  const windowRows = await listWindowRows(profile);
  const counts = countByStatus(windowRows);

  const keyword = filters.search ? normalizeSearch(filters.search) : '';
  const filtered = windowRows.filter(
    (row) =>
      (!filters.status || row.status === filters.status) &&
      (!keyword || matchesSearch(row, keyword))
  );

  const limit = Math.min(
    Math.max(filters.limit ?? QUICK_REQUEST_LIST_DEFAULT_LIMIT, 1),
    QUICK_REQUEST_LIST_MAX_LIMIT
  );
  const page = Math.max(filters.page ?? 1, 1);
  const start = (page - 1) * limit;

  return {
    rows: filtered.slice(start, start + limit).map((row) => toQuickRequestListRow(profile, row)),
    total: filtered.length,
    page,
    limit,
    counts,
    viewer: buildQuickRequestViewer(profile)
  };
}

export async function getQuickRequestSummaryForViewer(
  profile: QuickViewerProfile
): Promise<QuickRequestSummary> {
  const windowRows = await listWindowRows(profile);
  const { fromDate, toDate } = getQuickDashboardRange();
  return {
    counts: countByStatus(windowRows),
    range: { fromDate, toDate },
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
  row: QuickRequestRow
): Promise<QuickRequestDetail> {
  const permissions = buildQuickRequestPermissions(profile, row);
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
