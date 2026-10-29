import 'server-only';

import { createHash } from 'node:crypto';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { isPushGroupKey, type PushGroupKey } from '../lib/push-groups';
import { pushOwnerHashInput, truncatePushOwnerHash } from '../lib/push-resume-decision';

/**
 * plan 91 — push_subscriptions · push_notification_preferences 접근 (service_role 전용).
 * endpoint는 비밀값에 준한다 — 로그·응답에는 host 또는 sha256 앞 16자만 노출한다.
 */

export type PushSubscriptionRow = {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type PushDeviceView = {
  id: number;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
  endpoint_hash: string;
};

const SUBSCRIPTION_COLUMNS = 'id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at';

export function hashEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 16);
}

export function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'invalid';
  }
}

export function toDeviceView(row: PushSubscriptionRow): PushDeviceView {
  return {
    id: row.id,
    user_agent: row.user_agent,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    endpoint_hash: hashEndpoint(row.endpoint)
  };
}

export async function countPushSubscriptions(userId: string): Promise<number> {
  const supabase = getServiceRoleClient();
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listPushSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PushSubscriptionRow[];
}

/** 여러 사용자의 구독을 한 번에 (dispatch용) */
export async function listPushSubscriptionsByUsers(
  userIds: string[]
): Promise<PushSubscriptionRow[]> {
  if (userIds.length === 0) return [];
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .in('user_id', userIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as PushSubscriptionRow[];
}

/**
 * endpoint 기준 upsert. 같은 기기가 다른 계정으로 로그인하면 user_id가 넘어간다 (plan A6).
 * 반환 `created`: 새 행이면 true (201), 기존 갱신이면 false (200).
 */
export async function upsertPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}): Promise<{ id: number; created: boolean }> {
  const supabase = getServiceRoleClient();

  const { data: existing, error: lookupError } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', input.endpoint)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  if (existing) {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({
        user_id: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent
      })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id as number, created: false };
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: input.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent
      },
      { onConflict: 'endpoint' }
    )
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as number, created: true };
}

/** 소유자 범위 삭제 — 타인의 endpoint/id는 0행(404) */
export async function deletePushSubscription(input: {
  userId: string;
  endpoint?: string;
  id?: number;
}): Promise<{ deleted: boolean; endpoint: string | null }> {
  const supabase = getServiceRoleClient();
  let query = supabase.from('push_subscriptions').delete().eq('user_id', input.userId);
  if (typeof input.id === 'number') {
    query = query.eq('id', input.id);
  } else if (input.endpoint) {
    query = query.eq('endpoint', input.endpoint);
  } else {
    return { deleted: false, endpoint: null };
  }
  const { data, error } = await query.select('endpoint');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ endpoint: string }>;
  return { deleted: rows.length > 0, endpoint: rows[0]?.endpoint ?? null };
}

export async function deletePushSubscriptionsByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('push_subscriptions').delete().in('id', ids);
  if (error) throw new Error(error.message);
}

export async function touchPushSubscriptions(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from('push_subscriptions')
    .update({ last_used_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(error.message);
}

/** 계정 비활성화 → 전 기기 삭제 (plan 57 연동). 실패는 throw — 호출부가 응답을 바꾸지 않도록 catch한다 */
export async function purgePushSubscriptionsByUser(userId: string): Promise<number> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

// ---------------------------------------------------------------------------
// plan 105 — 재로그인 자동 복구 · 이전 사용자 연결 해제 (detach) · 비활성화 이력
// ---------------------------------------------------------------------------

/**
 * 기기 표시 owner hash — sha256('wakeone-push-owner:' + user_id) hex 앞 16자.
 * 클라이언트(`push-resume.ts` Web Crypto)와 같은 접두사·길이(`push-resume-decision.ts`)를 쓴다.
 */
export function hashPushOwner(userId: string): string {
  return truncatePushOwnerHash(createHash('sha256').update(pushOwnerHashInput(userId)).digest('hex'));
}

export type PushSubscriptionOwnerRow = { id: number; user_id: string };

/** endpoint(unique)로 행 1건 — 없으면 null */
export async function findPushSubscriptionByEndpoint(
  endpoint: string
): Promise<PushSubscriptionOwnerRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id')
    .eq('endpoint', endpoint)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PushSubscriptionOwnerRow | null) ?? null;
}

export type DetachForeignPushSubscriptionResult =
  | { result: 'none' }
  | { result: 'mine' }
  | { result: 'detached'; previousOwnerId: string };

/**
 * 이 기기(endpoint)에 남은 **다른 계정**의 행을 지운다 (D-4).
 * - 행 없음 → `none` · 내 행 → `mine`(변경 없음) · 다른 계정 → 삭제 후 `detached`.
 * - 조회와 삭제 사이에 행이 바뀌면(다른 탭 upsert 등) 삭제가 0행 → 1회만 다시 판정한다.
 */
export async function detachForeignPushSubscription(input: {
  userId: string;
  endpoint: string;
}): Promise<DetachForeignPushSubscriptionResult> {
  const supabase = getServiceRoleClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const row = await findPushSubscriptionByEndpoint(input.endpoint);
    if (!row) return { result: 'none' };
    if (row.user_id === input.userId) return { result: 'mine' };

    const { data, error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('id', row.id)
      .eq('user_id', row.user_id)
      .select('id');
    if (error) throw new Error(error.message);
    if ((data ?? []).length > 0) {
      return { result: 'detached', previousOwnerId: row.user_id };
    }
  }

  const finalRow = await findPushSubscriptionByEndpoint(input.endpoint);
  if (!finalRow) return { result: 'none' };
  if (finalRow.user_id === input.userId) return { result: 'mine' };
  throw new Error('push subscription detach conflict');
}

/**
 * `sinceIso` **이후** 이 사용자를 대상으로 성공(2xx)한 `user.deactivate` 로그가 있으면 true (91 AC-15 · D-5 ①).
 * `activity_logs`는 append-only(UPDATE/DELETE 트리거 차단 · 보존 cron 없음)라 판정 근거로 쓴다.
 * 인덱스 `idx_activity_logs_target_created (target_user_id, created_at desc)`를 탄다.
 */
export async function hasDeactivationSince(userId: string, sinceIso: string): Promise<boolean> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id')
    .eq('target_user_id', userId)
    .eq('action', 'user.deactivate')
    .gte('http_status', 200)
    .lt('http_status', 300)
    .gt('created_at', sinceIso)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function getDisabledPushGroups(userId: string): Promise<PushGroupKey[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('push_notification_preferences')
    .select('disabled_groups')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const groups = (data?.disabled_groups as unknown[] | undefined) ?? [];
  return groups.filter(isPushGroupKey);
}

/** 여러 사용자의 끈 그룹 (dispatch용). 행 없음 = 전부 ON */
export async function getDisabledPushGroupsByUsers(
  userIds: string[]
): Promise<Map<string, Set<PushGroupKey>>> {
  const result = new Map<string, Set<PushGroupKey>>();
  if (userIds.length === 0) return result;
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('push_notification_preferences')
    .select('user_id, disabled_groups')
    .in('user_id', userIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ user_id: string; disabled_groups: unknown[] }>) {
    result.set(row.user_id, new Set((row.disabled_groups ?? []).filter(isPushGroupKey)));
  }
  return result;
}

export async function upsertDisabledPushGroups(
  userId: string,
  disabledGroups: PushGroupKey[]
): Promise<PushGroupKey[]> {
  const supabase = getServiceRoleClient();
  const unique = [...new Set(disabledGroups)];
  const { error } = await supabase.from('push_notification_preferences').upsert(
    {
      user_id: userId,
      disabled_groups: unique,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(error.message);
  return unique;
}
