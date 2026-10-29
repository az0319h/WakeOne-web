import 'server-only';

import {
  assertAssignableUsers,
  fetchPeopleByIds,
  listTeammateIds,
  toAssigneeView
} from '@/features/asset-ledger/api/assignees.server';
import { AssetLedgerError, PG_FOREIGN_KEY_VIOLATION } from '@/features/asset-ledger/api/errors';
import {
  ASSET_DEFAULT_PER_PAGE,
  ASSET_MESSAGES,
  type AssigneeInput
} from '@/features/asset-ledger/api/types';
import { assigneeKey } from '@/features/asset-ledger/lib/assignee-input';
import { hasTeam, matchesAssetScope, type ScopeAssignee } from '@/features/asset-ledger/lib/scope';
import {
  countRequestsForTarget,
  listRequestsForTarget,
  loadTargetRequestStats,
  type AssetViewer
} from '@/features/asset-requests/api/service.server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { SubscriptionWritableFields } from '../schemas/subscription';
import {
  projectSubscription,
  toManagerSubscription,
  type SubscriptionRecord
} from './projection';
import {
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_DEFAULT_STATUSES,
  type SubscriptionCounts,
  type SubscriptionDetailResponse,
  type SubscriptionFilters,
  type SubscriptionListResponse,
  type SubscriptionManagerItem,
  type SubscriptionStatus
} from './types';

/**
 * plan 103 — 구독 대장 service (service role · Route가 권한을 먼저 확인).
 * 일반 직원 응답은 반드시 `projectSubscription(…, false)`(허용 목록)를 거친다.
 * 규모(수백 행)가 작아 목록은 전체를 읽고 서버 메모리에서 범위·검색·상태·구분 필터를 적용한다.
 */

const SUBSCRIPTION_COLUMNS =
  'id, category, name, plan_name, purpose, status, expires_on, payer_entity, card_last4, billing_cycle, billing_day, billing_date, amount, currency, amount_varies, started_on, owner_account, manager_memo, source, created_at, updated_at';

type AssigneeRow = ScopeAssignee & {
  id: number;
  subscription_id: number;
};

const ASSIGNEE_COLUMNS = 'id, subscription_id, assignee_type, user_id, affiliation, rank';
const MAX_PER_PAGE = 50;
const CATEGORY_ORDER = new Map(SUBSCRIPTION_CATEGORIES.map((category, index) => [category, index]));

async function loadAllSubscriptions(): Promise<SubscriptionRecord[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from('subscriptions').select(SUBSCRIPTION_COLUMNS).limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as SubscriptionRecord[];
}

async function loadSubscriptionRow(id: number): Promise<SubscriptionRecord | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubscriptionRecord | null) ?? null;
}

async function loadAssignees(subscriptionIds?: number[]): Promise<Map<number, AssigneeRow[]>> {
  const supabase = getServiceRoleClient();
  let query = supabase.from('subscription_assignees').select(ASSIGNEE_COLUMNS).order('id', { ascending: true });
  if (subscriptionIds) {
    if (subscriptionIds.length === 0) return new Map();
    query = query.in('subscription_id', subscriptionIds);
  }
  const { data, error } = await query.limit(20000);
  if (error) throw new Error(error.message);
  const map = new Map<number, AssigneeRow[]>();
  for (const row of (data ?? []) as AssigneeRow[]) {
    const list = map.get(row.subscription_id) ?? [];
    list.push(row);
    map.set(row.subscription_id, list);
  }
  return map;
}

function matchesQuery(row: SubscriptionRecord, q: string): boolean {
  const needle = q.toLowerCase();
  return [row.name, row.plan_name, row.purpose].some(
    (value) => typeof value === 'string' && value.toLowerCase().includes(needle)
  );
}

function sortRows(rows: SubscriptionRecord[], sort: SubscriptionFilters['sort']): SubscriptionRecord[] {
  const byName = (a: SubscriptionRecord, b: SubscriptionRecord) =>
    a.name.localeCompare(b.name, 'ko') || a.id - b.id;
  if (sort === 'name') return rows.toSorted(byName);
  if (sort === 'updated_desc') {
    return rows.toSorted((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id);
  }
  if (sort === 'expires_on') {
    return rows.toSorted((a, b) => {
      if (a.expires_on === b.expires_on) return byName(a, b);
      if (!a.expires_on) return 1;
      if (!b.expires_on) return -1;
      return a.expires_on.localeCompare(b.expires_on);
    });
  }
  return rows.toSorted(
    (a, b) =>
      (CATEGORY_ORDER.get(a.category) ?? 99) - (CATEGORY_ORDER.get(b.category) ?? 99) || byName(a, b)
  );
}

async function buildItems(
  rows: SubscriptionRecord[],
  assigneesById: Map<number, AssigneeRow[]>,
  viewer: AssetViewer
) {
  const ids = rows.map((row) => row.id);
  const userIds = rows.flatMap((row) =>
    (assigneesById.get(row.id) ?? []).map((assignee) => assignee.user_id)
  );
  const [people, stats] = await Promise.all([
    fetchPeopleByIds(userIds),
    loadTargetRequestStats('subscription', ids, viewer)
  ]);
  return rows.map((row) =>
    projectSubscription(
      row,
      {
        assignees: (assigneesById.get(row.id) ?? []).map((assignee) => toAssigneeView(assignee, people)),
        open_requests: stats.open.get(row.id) ?? null,
        request_count: stats.totals.get(row.id) ?? 0
      },
      viewer.isManager
    )
  );
}

export async function listSubscriptions(
  filters: SubscriptionFilters,
  viewer: AssetViewer
): Promise<SubscriptionListResponse> {
  const scope = filters.scope ?? 'all';
  const statuses: SubscriptionStatus[] =
    filters.status && filters.status.length > 0 ? filters.status : SUBSCRIPTION_DEFAULT_STATUSES;
  const perPage = Math.min(Math.max(filters.perPage ?? ASSET_DEFAULT_PER_PAGE, 1), MAX_PER_PAGE);
  const q = filters.q?.trim() ?? '';

  const [rows, assigneesById] = await Promise.all([loadAllSubscriptions(), loadAssignees()]);
  const teamUnavailable = scope === 'team' && !hasTeam(viewer);
  const teammateIds = scope === 'team' && !teamUnavailable ? await listTeammateIds(viewer) : new Set<string>();

  // 범위 · 카드 · 검색 (구분·상태 제외) = 탭 건수·숨김 수의 기준
  const base = teamUnavailable
    ? []
    : rows.filter((row) => {
        if (viewer.isManager && filters.card && row.card_last4 !== filters.card) return false;
        if (q && !matchesQuery(row, q)) return false;
        return matchesAssetScope(assigneesById.get(row.id) ?? [], scope, viewer, teammateIds);
      });

  const statusFiltered = base.filter((row) => statuses.includes(row.status));
  const counts = Object.fromEntries([
    ['all', statusFiltered.length],
    ...SUBSCRIPTION_CATEGORIES.map((category) => [
      category,
      statusFiltered.filter((row) => row.category === category).length
    ])
  ]) as SubscriptionCounts;

  const category = filters.category && filters.category !== 'all' ? filters.category : null;
  const inCategory = (row: SubscriptionRecord) => !category || row.category === category;
  const matched = sortRows(statusFiltered.filter(inCategory), filters.sort);
  const hiddenCount = statuses.includes('canceled')
    ? 0
    : base.filter((row) => inCategory(row) && row.status === 'canceled').length;

  const total = matched.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(filters.page ?? 1, 1), lastPage);
  const pageRows = matched.slice((page - 1) * perPage, page * perPage);

  const response: SubscriptionListResponse = {
    items: await buildItems(pageRows, assigneesById, viewer),
    total,
    page,
    perPage,
    counts,
    hidden_count: hiddenCount,
    team_unavailable: teamUnavailable,
    is_manager: viewer.isManager
  };

  if (viewer.isManager) {
    response.card_options = [
      ...new Set(rows.map((row) => row.card_last4).filter((card): card is string => Boolean(card)))
    ].toSorted();
  }

  return response;
}

export async function getSubscriptionDetail(
  id: number,
  viewer: AssetViewer
): Promise<SubscriptionDetailResponse | null> {
  const row = await loadSubscriptionRow(id);
  if (!row) return null;
  const assigneesById = await loadAssignees([id]);
  const [items, requests] = await Promise.all([
    buildItems([row], assigneesById, viewer),
    listRequestsForTarget('subscription', id, viewer)
  ]);
  return { item: items[0], requests, is_manager: viewer.isManager };
}

/** 권한자 응답 1건 (POST/PATCH 응답용) */
export async function getSubscriptionManagerItem(
  id: number,
  viewer: AssetViewer
): Promise<SubscriptionManagerItem | null> {
  const row = await loadSubscriptionRow(id);
  if (!row) return null;
  const assigneesById = await loadAssignees([id]);
  const people = await fetchPeopleByIds((assigneesById.get(id) ?? []).map((assignee) => assignee.user_id));
  const stats = await loadTargetRequestStats('subscription', [id], { ...viewer, isManager: true });
  return toManagerSubscription(row, {
    assignees: (assigneesById.get(id) ?? []).map((assignee) => toAssigneeView(assignee, people)),
    open_requests: stats.open.get(id) ?? null,
    request_count: stats.totals.get(id) ?? 0
  });
}

function assigneeInsertRow(subscriptionId: number, assignee: AssigneeInput, actorId: string) {
  return {
    subscription_id: subscriptionId,
    assignee_type: assignee.assignee_type,
    user_id: assignee.assignee_type === 'user' ? assignee.user_id : null,
    affiliation: assignee.assignee_type === 'user' ? null : assignee.affiliation,
    rank: assignee.assignee_type === 'team' ? assignee.rank : null,
    created_by: actorId
  };
}

function rowKey(row: AssigneeRow): string {
  if (row.assignee_type === 'user') return `user:${row.user_id}`;
  if (row.assignee_type === 'team') return `team:${row.affiliation}:${row.rank}`;
  return `affiliation:${row.affiliation}`;
}

export async function createSubscription(input: {
  fields: SubscriptionWritableFields;
  assignees: AssigneeInput[];
  viewer: AssetViewer;
}): Promise<SubscriptionManagerItem> {
  await assertAssignableUsers(input.assignees);
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      ...input.fields,
      source: 'manual',
      created_by: input.viewer.user_id,
      updated_by: input.viewer.user_id
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? '구독 저장 중 오류가 발생했습니다.');
  const id = (data as { id: number }).id;

  if (input.assignees.length > 0) {
    const { error: assigneeError } = await supabase
      .from('subscription_assignees')
      .insert(input.assignees.map((assignee) => assigneeInsertRow(id, assignee, input.viewer.user_id)));
    if (assigneeError) {
      // 보상 삭제 — 대상자 없는 반쪽 행을 남기지 않는다
      await supabase.from('subscriptions').delete().eq('id', id);
      throw new Error(assigneeError.message);
    }
  }

  const item = await getSubscriptionManagerItem(id, input.viewer);
  if (!item) throw new Error('저장한 구독을 다시 읽지 못했습니다.');
  return item;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return a === b;
}

export async function updateSubscription(input: {
  id: number;
  fields: SubscriptionWritableFields;
  assignees: AssigneeInput[] | undefined;
  viewer: AssetViewer;
}): Promise<{ item: SubscriptionManagerItem; changedFields: string[]; assigneeCount: number } | null> {
  const existing = await loadSubscriptionRow(input.id);
  if (!existing) return null;

  const changedFields = Object.entries(input.fields)
    .filter(([key, value]) => !sameValue((existing as Record<string, unknown>)[key], value))
    .map(([key]) => key);

  const supabase = getServiceRoleClient();
  const currentAssignees = (await loadAssignees([input.id])).get(input.id) ?? [];
  let assigneeCount = currentAssignees.length;

  if (input.assignees) {
    await assertAssignableUsers(input.assignees);
    const nextKeys = new Set(input.assignees.map(assigneeKey));
    const currentKeys = new Set(currentAssignees.map(rowKey));
    const toDelete = currentAssignees.filter((row) => !nextKeys.has(rowKey(row))).map((row) => row.id);
    const toInsert = input.assignees.filter((assignee) => !currentKeys.has(assigneeKey(assignee)));

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('subscription_assignees')
        .insert(toInsert.map((assignee) => assigneeInsertRow(input.id, assignee, input.viewer.user_id)));
      if (error) throw new Error(error.message);
    }
    if (toDelete.length > 0) {
      const { error } = await supabase.from('subscription_assignees').delete().in('id', toDelete);
      if (error) throw new Error(error.message);
    }
    if (toInsert.length > 0 || toDelete.length > 0) {
      changedFields.push('assignees');
    }
    assigneeCount = input.assignees.length;
  }

  // 대상자만 바뀌어도 updated_by·updated_at을 갱신한다
  if (changedFields.length > 0) {
    const patch: Record<string, unknown> = { updated_by: input.viewer.user_id };
    for (const field of changedFields) {
      if (field !== 'assignees') patch[field] = (input.fields as Record<string, unknown>)[field];
    }
    const { error } = await supabase.from('subscriptions').update(patch).eq('id', input.id);
    if (error) throw new Error(error.message);
  }

  const item = await getSubscriptionManagerItem(input.id, input.viewer);
  if (!item) return null;
  return { item, changedFields, assigneeCount };
}

/** 삭제 — 요청이 하나라도 있으면 409 (D-11 · FK on delete restrict가 최종 방어) */
export async function deleteSubscription(id: number): Promise<SubscriptionRecord | null> {
  const existing = await loadSubscriptionRow(id);
  if (!existing) return null;
  if ((await countRequestsForTarget('subscription', id)) > 0) {
    throw new AssetLedgerError(409, ASSET_MESSAGES.hasRequests);
  }
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('subscriptions').delete().eq('id', id);
  if (error) {
    if (error.code === PG_FOREIGN_KEY_VIOLATION) {
      throw new AssetLedgerError(409, ASSET_MESSAGES.hasRequests);
    }
    throw new Error(error.message);
  }
  return existing;
}

export async function getSubscriptionBasic(id: number): Promise<Pick<SubscriptionRecord, 'id' | 'name' | 'category' | 'status'> | null> {
  const row = await loadSubscriptionRow(id);
  return row ? { id: row.id, name: row.name, category: row.category, status: row.status } : null;
}
