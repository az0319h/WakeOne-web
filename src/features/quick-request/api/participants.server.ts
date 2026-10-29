import 'server-only';

import { isDongbang, isQuickAdmin } from '@/features/auth/api/quick-access.server';
import { applyDongbangScope } from '@/features/users/api/profile-scope.server';
import { getAffiliationLabel, type Affiliation } from '@/features/users/constants/organization';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { QUICK_CHAT_CANDIDATE_LIMIT } from '../schemas/quick-request-participant';
import type {
  QuickRequestParticipant,
  QuickRequestParticipantCandidate,
  QuickRequestParticipantEvent,
  QuickRequestParticipantsData
} from './types';
import { escapeLikePattern, type QuickRequestRow } from './workflow.server';

/**
 * plan 101 — 퀵 대화 초대 참여자 서버 데이터 접근 (service role · SQL 97 `quick_request_participants`).
 * 요청자·동방·admin은 93 규칙으로 계산하고(테이블에 없음), 초대 참여자만 행으로 둔다.
 * 쓰기(초대·제외)는 모두 여기서 — 클라이언트 직접 INSERT 없음. Route는 응답·로그·분기만 맡는다.
 * `messages.server.ts`가 이 모듈을 import한다(역방향 import 금지 — 순환 방지).
 */

const TABLE = 'quick_request_participants';
const PARTICIPANT_COLUMNS = 'id, quick_request_id, user_id, invited_by, invited_at, removed_at, removed_by';
const UNIQUE_VIOLATION = '23505';
const NAME_MAX_LENGTH = 100;

export type QuickRequestParticipantRow = {
  id: number;
  quick_request_id: string;
  user_id: string;
  invited_by: string;
  invited_at: string;
  removed_at: string | null;
  removed_by: string | null;
};

type ParticipantProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  system_role: 'admin' | 'user';
  affiliation: Affiliation | null;
  rank: string | null;
  status: string | null;
};

const PROFILE_COLUMNS = 'user_id, full_name, email, system_role, affiliation, rank, status';

/** 표시 이름 — `resolveChatAuthorName`과 같은 규칙 (full_name → email) */
function displayName(profile: Pick<ParticipantProfileRow, 'full_name' | 'email'> | undefined): string {
  const name = profile?.full_name?.trim() || profile?.email || '알 수 없음';
  return name.slice(0, NAME_MAX_LENGTH);
}

async function fetchParticipantProfiles(userIds: readonly string[]): Promise<Map<string, ParticipantProfileRow>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, ParticipantProfileRow>();
  if (unique.length === 0) return map;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).in('user_id', unique);

  if (error) {
    throw new Error(error.message);
  }
  for (const row of (data ?? []) as ParticipantProfileRow[]) {
    map.set(row.user_id, row);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

/** 그 건의 참여자 행 전부 (제외된 행 포함 · invited_at 오름차순) */
export async function listQuickRequestParticipantRows(requestId: string): Promise<QuickRequestParticipantRow[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(PARTICIPANT_COLUMNS)
    .eq('quick_request_id', requestId)
    .order('invited_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as QuickRequestParticipantRow[];
}

/** 활성(removed_at null) 초대 참여자 user id — 알림 수신 규칙 `participantIds` · 읽음 role 판정 */
export async function listActiveParticipantUserIds(requestId: string): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from(TABLE).select('user_id').eq('quick_request_id', requestId).is('removed_at', null);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row.user_id as string);
}

async function listActiveDongbangProfiles(): Promise<ParticipantProfileRow[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('status', 'active')
    .eq('affiliation', 'dongbang');

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as ParticipantProfileRow[];
}

/** 그 건에 `author_role='admin'` 메시지를 쓴 admin (93 규칙 · `messages.server.listChatAdminParticipantIds`와 같은 조회) */
async function listAdminAuthorIds(requestId: string): Promise<string[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('quick_request_messages')
    .select('author_user_id')
    .eq('quick_request_id', requestId)
    .eq('author_role', 'admin');

  if (error) {
    throw new Error(error.message);
  }
  return [...new Set((data ?? []).map((row) => row.author_user_id as string))];
}

function toEvent(row: QuickRequestParticipantRow, name: string): QuickRequestParticipantEvent[] {
  const events: QuickRequestParticipantEvent[] = [{ type: 'joined', userId: row.user_id, name, at: row.invited_at }];
  if (row.removed_at) {
    events.push({
      type: row.removed_by === row.user_id ? 'left' : 'removed',
      userId: row.user_id,
      name,
      at: row.removed_at
    });
  }
  return events;
}

/**
 * 참여자 목록(요청자 → 동방 전원(이름순) → 글 쓴 admin → 초대 참여자(invitedAt순)) + 이벤트(시각순 · 제외된 행의 joined/removed 포함).
 * 재초대는 같은 행 복구(D-3)라 직전 제외 이력은 남지 않는다 — 복구 후 joined 1건만 보인다.
 */
export async function buildQuickRequestParticipantsData(row: QuickRequestRow): Promise<QuickRequestParticipantsData> {
  const [rows, dongbang, adminIds] = await Promise.all([
    listQuickRequestParticipantRows(row.id),
    listActiveDongbangProfiles(),
    listAdminAuthorIds(row.id)
  ]);
  const profiles = await fetchParticipantProfiles([
    ...rows.map((item) => item.user_id),
    ...rows.map((item) => item.invited_by),
    ...adminIds
  ]);

  const participants: QuickRequestParticipant[] = [
    { userId: row.requester_user_id, name: row.requester_name, role: 'requester', invitedBy: null, invitedAt: null }
  ];
  const seen = new Set<string>([row.requester_user_id]);

  const dongbangSorted = [...dongbang].sort((a, b) => displayName(a).localeCompare(displayName(b), 'ko'));
  for (const profile of dongbangSorted) {
    if (seen.has(profile.user_id)) continue;
    seen.add(profile.user_id);
    participants.push({ userId: profile.user_id, name: displayName(profile), role: 'dongbang', invitedBy: null, invitedAt: null });
  }

  for (const adminId of adminIds) {
    if (seen.has(adminId)) continue;
    const profile = profiles.get(adminId);
    if (profile && profile.status !== 'active') continue;
    seen.add(adminId);
    participants.push({ userId: adminId, name: displayName(profile), role: 'admin', invitedBy: null, invitedAt: null });
  }

  const events: QuickRequestParticipantEvent[] = [];
  for (const item of rows) {
    const name = displayName(profiles.get(item.user_id));
    events.push(...toEvent(item, name));
    if (item.removed_at || seen.has(item.user_id)) continue;
    seen.add(item.user_id);
    participants.push({
      userId: item.user_id,
      name,
      role: 'participant',
      invitedBy: { userId: item.invited_by, name: displayName(profiles.get(item.invited_by)) },
      invitedAt: item.invited_at
    });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));

  return { participants, events };
}

// ---------------------------------------------------------------------------
// 후보 (D-2 r1 — 서버 측 제외 · 후보 Route와 초대 Route가 같은 규칙)
// ---------------------------------------------------------------------------

function affiliationLabelOf(profile: Pick<ParticipantProfileRow, 'affiliation' | 'rank'>): string | null {
  const label = getAffiliationLabel(profile.affiliation);
  const rank = profile.rank?.trim();
  if (label && rank) return `${label} · ${rank}`;
  return label ?? rank ?? null;
}

/** 초대 가능 여부 — active · 동방 아님 · admin 아님 · 요청자 아님 · 초대하는 본인 아님 */
export function isInvitableProfile(
  profile: Pick<ParticipantProfileRow, 'user_id' | 'status' | 'system_role' | 'affiliation'>,
  row: Pick<QuickRequestRow, 'requester_user_id'>,
  actorUserId: string
): boolean {
  if (profile.status !== 'active') return false;
  if (isDongbang(profile)) return false;
  if (isQuickAdmin(profile)) return false;
  if (profile.user_id === row.requester_user_id) return false;
  if (profile.user_id === actorUserId) return false;
  return true;
}

/** PostgREST `or=` 값 — 따옴표·역슬래시 제거 후 LIKE 메타문자 이스케이프 · 큰따옴표로 감싼다(쉼표·괄호 보호) */
function toIlikePattern(query: string): string {
  const cleaned = query.replace(/["\\]/g, '').trim();
  return `"%${escapeLikePattern(cleaned)}%"`;
}

/**
 * 이름·이메일 부분 일치 ≤ 20 (D-2). `q` 빈 값은 `[]`.
 * 서버 제외: pending/inactive · 동방(`applyDongbangScope`) · admin · 요청자 · 본인 · 활성 참여 중.
 */
export async function listQuickRequestParticipantCandidates(input: {
  row: QuickRequestRow;
  actorUserId: string;
  q: string;
}): Promise<QuickRequestParticipantCandidate[]> {
  const keyword = input.q.trim();
  if (!keyword) return [];

  const activeIds = await listActiveParticipantUserIds(input.row.id);
  const excluded = [...new Set([input.row.requester_user_id, input.actorUserId, ...activeIds])];
  const pattern = toIlikePattern(keyword);

  const supabase = getServiceRoleClient();
  let query = supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('status', 'active')
    .neq('system_role', 'admin')
    .not('user_id', 'in', `(${excluded.join(',')})`)
    .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
    .order('full_name', { ascending: true })
    .limit(QUICK_CHAT_CANDIDATE_LIMIT);
  query = applyDongbangScope(query);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ParticipantProfileRow[])
    .filter((profile) => isInvitableProfile(profile, input.row, input.actorUserId) && !activeIds.includes(profile.user_id))
    .map((profile) => ({
      userId: profile.user_id,
      name: displayName(profile),
      email: profile.email ?? '',
      affiliationLabel: affiliationLabelOf(profile)
    }));
}

// ---------------------------------------------------------------------------
// 초대 (D-2 검증 → upsert/복구) · 제외 (D-3 soft)
// ---------------------------------------------------------------------------

export type InviteParticipantResult =
  | { ok: true; participant: QuickRequestParticipant; recovered: boolean }
  | { ok: false; reason: 'user_not_found' | 'not_invitable' | 'already_participant' };

export async function inviteQuickRequestParticipant(input: {
  row: QuickRequestRow;
  actorUserId: string;
  userId: string;
}): Promise<InviteParticipantResult> {
  const profiles = await fetchParticipantProfiles([input.userId, input.actorUserId]);
  const target = profiles.get(input.userId);
  if (!target) {
    return { ok: false, reason: 'user_not_found' };
  }
  if (!isInvitableProfile(target, input.row, input.actorUserId)) {
    return { ok: false, reason: 'not_invitable' };
  }

  const supabase = getServiceRoleClient();
  const { data: existing, error: existingError } = await supabase
    .from(TABLE)
    .select(PARTICIPANT_COLUMNS)
    .eq('quick_request_id', input.row.id)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message);
  }

  const current = existing as QuickRequestParticipantRow | null;
  if (current && current.removed_at === null) {
    return { ok: false, reason: 'already_participant' };
  }

  let saved: QuickRequestParticipantRow | null = null;
  if (current) {
    // 재초대 — 같은 행 복구 (removed_at null · invited_at 갱신). 경합으로 이미 복구됐으면 0행 → 409
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        invited_by: input.actorUserId,
        invited_at: new Date().toISOString(),
        removed_at: null,
        removed_by: null
      })
      .eq('id', current.id)
      .not('removed_at', 'is', null)
      .select(PARTICIPANT_COLUMNS)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    saved = (data as QuickRequestParticipantRow | null) ?? null;
    if (!saved) {
      return { ok: false, reason: 'already_participant' };
    }
  } else {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ quick_request_id: input.row.id, user_id: input.userId, invited_by: input.actorUserId })
      .select(PARTICIPANT_COLUMNS)
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { ok: false, reason: 'already_participant' };
      }
      throw new Error(error.message);
    }
    saved = data as QuickRequestParticipantRow;
  }

  return {
    ok: true,
    recovered: Boolean(current),
    participant: {
      userId: saved.user_id,
      name: displayName(target),
      role: 'participant',
      invitedBy: { userId: saved.invited_by, name: displayName(profiles.get(input.actorUserId)) },
      invitedAt: saved.invited_at
    }
  };
}

export type RemoveParticipantResult = { ok: true; row: QuickRequestParticipantRow } | { ok: false; reason: 'not_participant' };

/** soft 제외 — 활성 행만(0행이면 not_participant). 권한(초대자·admin·본인)은 Route가 판정한다 */
export async function removeQuickRequestParticipant(input: {
  requestId: string;
  userId: string;
  actorUserId: string;
}): Promise<RemoveParticipantResult> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ removed_at: new Date().toISOString(), removed_by: input.actorUserId })
    .eq('quick_request_id', input.requestId)
    .eq('user_id', input.userId)
    .is('removed_at', null)
    .select(PARTICIPANT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  const row = (data as QuickRequestParticipantRow | null) ?? null;
  return row ? { ok: true, row } : { ok: false, reason: 'not_participant' };
}
