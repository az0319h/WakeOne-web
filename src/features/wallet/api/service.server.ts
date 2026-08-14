import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { normalizePersonName } from '@/lib/normalize-person-name';
import { WALLET_SYNCS_PAGE_SIZE } from './keys';
import type {
  WalletLimitSnapshot,
  WalletSummary,
  WalletSyncItemResult,
  WalletSyncItemStatus,
  WalletSyncLogEntry,
  WalletSyncPayload,
  WalletSyncResult,
  WalletSyncsFilters,
  WalletSyncsListResponse
} from './types';

const WALLET_SYNCS_MAX_LIMIT = 50;

const WALLET_SYNC_SELECT =
  'id, matched_name, monthly_limit, monthly_remaining, previous_remaining, status, source, synced_at';

/**
 * 접근 제어: 비-admin 은 항상 본인(viewer), admin 은 requestedUserId 로 전환 가능.
 * service role 로 조회하므로 여기서 대상 user_id 를 명시적으로 확정한다(활동 로그와 동일 패턴).
 */
function resolveWalletTargetUserId(
  viewerUserId: string,
  isAdmin: boolean,
  requestedUserId: string | null
): string {
  return isAdmin && requestedUserId && requestedUserId !== 'self' ? requestedUserId : viewerUserId;
}

function mapWalletSyncRow(row: Record<string, unknown>): WalletSyncLogEntry {
  return {
    id: Number(row.id),
    monthly_limit: Number(row.monthly_limit),
    monthly_remaining: Number(row.monthly_remaining),
    previous_remaining: row.previous_remaining == null ? null : Number(row.previous_remaining),
    status: row.status as WalletSyncItemStatus,
    source: row.source as string,
    synced_at: row.synced_at as string
  };
}

/** Hero 스냅샷 — 대상 사용자의 가장 최근 동기화 1건. */
export async function getWalletSummaryServer(
  viewerUserId: string,
  isAdmin: boolean,
  requestedUserId: string | null
): Promise<WalletSummary> {
  const targetUserId = resolveWalletTargetUserId(viewerUserId, isAdmin, requestedUserId);

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('wallet_syncs')
    .select(WALLET_SYNC_SELECT)
    .eq('user_id', targetUserId)
    .eq('status', 'matched')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const snapshot: WalletLimitSnapshot | null = data
    ? {
        monthly_limit: Number(data.monthly_limit),
        monthly_remaining: Number(data.monthly_remaining),
        matched_name: data.matched_name as string,
        source: data.source as string,
        synced_at: data.synced_at as string
      }
    : null;

  return { snapshot, viewer: { userId: viewerUserId, isAdmin, targetUserId } };
}

/** 동기화 기록 무한 스크롤 — id desc cursor 페이징(알림 패턴과 동일). */
export async function listWalletSyncs(
  viewerUserId: string,
  isAdmin: boolean,
  filters: WalletSyncsFilters = {}
): Promise<WalletSyncsListResponse> {
  const limit = Math.min(Math.max(filters.limit ?? WALLET_SYNCS_PAGE_SIZE, 1), WALLET_SYNCS_MAX_LIMIT);
  const targetUserId = resolveWalletTargetUserId(viewerUserId, isAdmin, filters.user ?? null);

  const supabase = getServiceRoleClient();
  let query = supabase
    .from('wallet_syncs')
    .select(WALLET_SYNC_SELECT)
    .eq('user_id', targetUserId)
    .eq('status', 'matched')
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (filters.cursor) {
    const cursorId = Number(filters.cursor);
    if (Number.isFinite(cursorId)) {
      query = query.lt('id', cursorId);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((row) => mapWalletSyncRow(row as Record<string, unknown>));
  const hasMore = rows.length > limit;
  const syncs = hasMore ? rows.slice(0, limit) : rows;
  const last = syncs.at(-1);

  return {
    syncs,
    nextCursor: hasMore && last ? String(last.id) : null,
    hasMore
  };
}

interface ProfileNameIndex {
  /** 정규화 이름 → user_id (유일 매칭만) */
  byName: Map<string, string>;
  /** 동명이인 등 모호한 정규화 이름 (안전하게 매칭 제외) */
  ambiguous: Set<string>;
}

async function buildProfileNameIndex(
  supabase: ReturnType<typeof getServiceRoleClient>
): Promise<ProfileNameIndex> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .not('full_name', 'is', null);

  if (error) {
    throw new Error(error.message);
  }

  const byName = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const row of data ?? []) {
    const fullName = row.full_name?.trim();
    if (!fullName) {
      continue;
    }

    const key = normalizePersonName(fullName);
    if (byName.has(key)) {
      ambiguous.add(key);
    } else {
      byName.set(key, row.user_id);
    }
  }

  return { byName, ambiguous };
}

async function fetchLatestRemaining(
  supabase: ReturnType<typeof getServiceRoleClient>,
  userId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('wallet_syncs')
    .select('monthly_remaining')
    .eq('user_id', userId)
    .eq('status', 'matched')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? Number(data.monthly_remaining) : null;
}

interface WalletSyncInsertRow {
  request_id: string;
  user_id: string | null;
  matched_name: string;
  monthly_limit: number;
  monthly_remaining: number;
  previous_remaining: number | null;
  status: 'matched' | 'unmatched';
  synced_at: string;
}

export async function syncWalletLimits(
  payload: WalletSyncPayload,
  requestId: string
): Promise<WalletSyncResult> {
  const supabase = getServiceRoleClient();
  const { byName, ambiguous } = await buildProfileNameIndex(supabase);

  const rows: WalletSyncInsertRow[] = [];
  const results: WalletSyncItemResult[] = [];
  const unmatched: string[] = [];

  for (const item of payload.items) {
    const key = normalizePersonName(item.name);
    const userId = ambiguous.has(key) ? null : (byName.get(key) ?? null);

    if (!userId) {
      unmatched.push(item.name);
      rows.push({
        request_id: requestId,
        user_id: null,
        matched_name: item.name,
        monthly_limit: item.monthly_limit,
        monthly_remaining: item.monthly_remaining,
        previous_remaining: null,
        status: 'unmatched',
        synced_at: payload.synced_at
      });
      results.push({
        name: item.name,
        status: 'unmatched',
        user_id: null,
        monthly_limit: item.monthly_limit,
        monthly_remaining: item.monthly_remaining,
        previous_remaining: null
      });
      continue;
    }

    const previousRemaining = await fetchLatestRemaining(supabase, userId);

    rows.push({
      request_id: requestId,
      user_id: userId,
      matched_name: item.name,
      monthly_limit: item.monthly_limit,
      monthly_remaining: item.monthly_remaining,
      previous_remaining: previousRemaining,
      status: 'matched',
      synced_at: payload.synced_at
    });
    results.push({
      name: item.name,
      status: 'matched',
      user_id: userId,
      monthly_limit: item.monthly_limit,
      monthly_remaining: item.monthly_remaining,
      previous_remaining: previousRemaining
    });
  }

  const { error: insertError } = await supabase.from('wallet_syncs').insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    synced_at: payload.synced_at,
    matched: results.filter((result) => result.status === 'matched').length,
    unmatched,
    results
  };
}
