import 'server-only';

import { isAssetManager } from '@/features/auth/api/asset-access.server';
import { applyDongbangScope } from '@/features/users/api/profile-scope.server';
import { RANK_BY_AFFILIATION } from '@/features/users/constants/organization';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { AssetLedgerError } from './errors';
import {
  ASSET_MESSAGES,
  LEDGER_AFFILIATIONS,
  LEDGER_AFFILIATION_LABELS,
  affiliationAllLabel,
  isLedgerAffiliation,
  teamLabel,
  type AssigneeInput,
  type AssigneeOptionsResponse,
  type AssigneePersonOption,
  type AssigneeView,
  type LedgerAffiliation
} from './types';

/**
 * plan 103 — 대상자·사용자·요청자·담당자 이름 조회 (service role · 동방 제외).
 * `from('profiles')` 호출은 이 파일에만 둔다 → plan 95 §감사표 S-18~S-21 등재.
 */

export type LedgerPerson = {
  user_id: string;
  full_name: string;
  affiliation: string | null;
  rank: string | null;
  status: string;
  system_role: 'admin' | 'user';
};

const PERSON_COLUMNS = 'user_id, full_name, affiliation, rank, status, system_role';
const UNKNOWN_PERSON_LABEL = '알 수 없음';

/** S-21 — 대상자·사용자·요청자·담당자·댓글 작성자 이름 표시 조인 (id 목록 · 동방 제외 → 미조인 = 「알 수 없음」) */
export async function fetchPeopleByIds(userIds: readonly (string | null | undefined)[]): Promise<Map<string, LedgerPerson>> {
  const unique = [...new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (unique.length === 0) return new Map();

  const supabase = getServiceRoleClient();
  const result = new Map<string, LedgerPerson>();
  for (let offset = 0; offset < unique.length; offset += 200) {
    const batch = unique.slice(offset, offset + 200);
    const { data, error } = await applyDongbangScope(
      supabase.from('profiles').select(PERSON_COLUMNS).in('user_id', batch)
    );
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as LedgerPerson[]) {
      result.set(row.user_id, row);
    }
  }
  return result;
}

/** S-19 — 「내 팀」 동료 id (같은 소속·같은 부서 · active · 동방 제외 · 본인 포함 → 판정 함수가 본인을 뺀다) */
export async function listTeammateIds(viewer: {
  affiliation: string | null;
  rank: string | null;
}): Promise<Set<string>> {
  if (!viewer.affiliation || !viewer.rank) return new Set();
  const supabase = getServiceRoleClient();
  const { data, error } = await applyDongbangScope(
    supabase
      .from('profiles')
      .select('user_id')
      .eq('status', 'active')
      .eq('affiliation', viewer.affiliation)
      .eq('rank', viewer.rank)
  );
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { user_id: string }[]).map((row) => row.user_id));
}

/** S-18·S-20 — active · 비동방 전체(대상자 후보 · 권한자 후보 계산용) */
async function listActivePeople(): Promise<LedgerPerson[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await applyDongbangScope(
    supabase.from('profiles').select(PERSON_COLUMNS).eq('status', 'active').order('full_name', { ascending: true })
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerPerson[];
}

function personSubLabel(person: Pick<LedgerPerson, 'affiliation' | 'rank'>): string | null {
  if (!isLedgerAffiliation(person.affiliation)) return null;
  const affiliationLabel = LEDGER_AFFILIATION_LABELS[person.affiliation];
  return person.rank ? `${affiliationLabel} ${person.rank}` : affiliationLabel;
}

/** 권한자 판정용 — profiles 행에 TS 헬퍼 적용 (SQL private.is_asset_manager와 같은 규칙) */
export function isLedgerPersonManager(person: LedgerPerson): boolean {
  return isAssetManager({
    system_role: person.system_role,
    affiliation: person.affiliation as never,
    rank: person.rank,
    status: person.status
  });
}

/** S-20 — active 권한자(admin · 웨이크 인사팀 · 웨이크 회계팀) */
export async function listActiveAssetManagers(): Promise<LedgerPerson[]> {
  return (await listActivePeople()).filter(isLedgerPersonManager);
}

export async function listActiveAssetManagerUserIds(): Promise<string[]> {
  return (await listActiveAssetManagers()).map((person) => person.user_id);
}

function toPersonOption(person: LedgerPerson): AssigneePersonOption {
  const affiliation = isLedgerAffiliation(person.affiliation) ? person.affiliation : null;
  return {
    user_id: person.user_id,
    full_name: person.full_name?.trim() || UNKNOWN_PERSON_LABEL,
    affiliation,
    affiliation_label: affiliation ? LEDGER_AFFILIATION_LABELS[affiliation] : null,
    rank: person.rank,
    team_label: personSubLabel(person)
  };
}

export function listTeamOptions() {
  return LEDGER_AFFILIATIONS.flatMap((affiliation) =>
    RANK_BY_AFFILIATION[affiliation].map((rank) => ({
      affiliation,
      rank,
      label: teamLabel(affiliation, rank)
    }))
  );
}

/** `GET /api/asset-ledger/assignee-options` (권한자 전용) */
export async function listAssigneeOptions(): Promise<AssigneeOptionsResponse> {
  const people = await listActivePeople();
  return {
    people: people.map(toPersonOption),
    teams: listTeamOptions(),
    affiliations: LEDGER_AFFILIATIONS.map((affiliation) => ({
      affiliation,
      label: affiliationAllLabel(affiliation)
    })),
    managers: people.filter(isLedgerPersonManager).map(toPersonOption)
  };
}

/** 사람 대상자 = active · 비동방 프로필만 (아니면 400 「선택할 수 없는 대상자예요.」 · AC-22) */
export async function assertAssignableUsers(assignees: readonly AssigneeInput[]): Promise<void> {
  const userIds = assignees
    .filter((assignee): assignee is Extract<AssigneeInput, { assignee_type: 'user' }> => assignee.assignee_type === 'user')
    .map((assignee) => assignee.user_id);
  if (userIds.length === 0) return;
  const people = await fetchPeopleByIds(userIds);
  for (const userId of userIds) {
    const person = people.get(userId);
    if (!person || person.status !== 'active') {
      throw new AssetLedgerError(400, ASSET_MESSAGES.invalidAssignee, 'assignees');
    }
  }
}

export type AssigneeShape = {
  assignee_type: 'user' | 'team' | 'affiliation';
  user_id: string | null;
  affiliation: string | null;
  rank: string | null;
};

export function toAssigneeView(assignee: AssigneeShape, people: Map<string, LedgerPerson>): AssigneeView {
  const affiliation: LedgerAffiliation | null = isLedgerAffiliation(assignee.affiliation)
    ? assignee.affiliation
    : null;

  if (assignee.assignee_type === 'user') {
    const person = assignee.user_id ? people.get(assignee.user_id) : undefined;
    const name = person?.full_name?.trim() || UNKNOWN_PERSON_LABEL;
    return {
      assignee_type: 'user',
      user_id: assignee.user_id,
      affiliation: null,
      rank: null,
      label: name,
      full_name: name,
      team_label: person ? personSubLabel(person) : null
    };
  }

  if (assignee.assignee_type === 'team') {
    return {
      assignee_type: 'team',
      user_id: null,
      affiliation,
      rank: assignee.rank,
      label: affiliation && assignee.rank ? teamLabel(affiliation, assignee.rank) : (assignee.rank ?? ''),
      full_name: null,
      team_label: null
    };
  }

  return {
    assignee_type: 'affiliation',
    user_id: null,
    affiliation,
    rank: null,
    label: affiliation ? affiliationAllLabel(affiliation) : '',
    full_name: null,
    team_label: null
  };
}

/** 요청자 소속 팀 라벨 (「웨이크 디자인팀」) */
export function personTeamLabel(person: LedgerPerson | undefined): string | null {
  return person ? personSubLabel(person) : null;
}

export function personName(person: LedgerPerson | undefined, fallback = UNKNOWN_PERSON_LABEL): string {
  return person?.full_name?.trim() || fallback;
}
