import 'server-only';

import {
  AFFILIATION_OPTIONS,
  EXECUTIVE_POSITION_LEVELS,
  RANK_BY_AFFILIATION,
  type Affiliation,
  type LeaderRole
} from '@/features/users/constants/organization';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { OrgChartNode, OrgChartProfile } from './types';

const ORG_CHART_PROFILE_SELECT =
  'user_id, full_name, avatar_url, email, phone, affiliation, rank, position_level, leader_role, system_role, status';

function formatPersonLabel(profile: OrgChartProfile): string {
  const suffix =
    profile.leader_role === 'team_leader'
      ? '(T)'
      : profile.leader_role === 'part_leader'
        ? '(P)'
        : '';
  return `${profile.full_name} ${profile.position_level}${suffix}`;
}

function personNode(profile: OrgChartProfile, parentId: string | null): OrgChartNode {
  return {
    id: profile.user_id,
    parentId,
    name: formatPersonLabel(profile),
    nodeType: 'person',
    userId: profile.user_id,
    fullName: profile.full_name,
    positionLevel: profile.position_level,
    leaderRole: profile.leader_role,
    rank: profile.rank,
    avatarUrl: profile.avatar_url,
    email: profile.email,
    phone: profile.phone
  };
}

function teamNode(teamId: string, teamName: string, parentId: string): OrgChartNode {
  return {
    id: teamId,
    parentId,
    name: teamName,
    nodeType: 'team'
  };
}

function rootNode(rootId: string, label: string): OrgChartNode {
  return {
    id: rootId,
    parentId: null,
    name: label,
    nodeType: 'root'
  };
}

export function isEligibleOrgChartMember(profile: {
  status: string;
  system_role: string;
  position_level: string | null;
  rank: string | null;
}): boolean {
  if (profile.status !== 'active') return false;
  if (profile.system_role !== 'user') return false;
  if (!profile.position_level) return false;
  if (
    profile.rank === '경영진' &&
    profile.position_level !== 'CEO' &&
    profile.position_level !== 'COO'
  ) {
    return false;
  }
  return true;
}

function leaderSortScore(leaderRole: LeaderRole | null): number {
  if (leaderRole === 'team_leader') return 0;
  if (leaderRole === 'part_leader') return 1;
  return 2;
}

const WAKE_POSITION_ORDER = ['부장', '차장', '과장', '대리', '주임', '사원'] as const;
const SANS_POSITION_ORDER = ['CEO', '점장', '부점장', '선임매니저', '매니저', '쉐프'] as const;
/** 선임매니저·쉐프 동급 — 매니저는 그 하위 */
const SANS_PEER_TIER = new Set(['선임매니저', '쉐프']);
const FOUNDRY_POSITION_ORDER = ['공장장', '팀장', '차장', '오퍼레이터'] as const;

function positionSortScore(affiliation: Affiliation, positionLevel: string): number {
  if (affiliation === 'sans' && SANS_PEER_TIER.has(positionLevel)) {
    return SANS_POSITION_ORDER.indexOf('선임매니저');
  }

  const order: readonly string[] =
    affiliation === 'wake'
      ? WAKE_POSITION_ORDER
      : affiliation === 'sans'
        ? SANS_POSITION_ORDER
        : FOUNDRY_POSITION_ORDER;

  const index = order.indexOf(positionLevel);
  return index === -1 ? order.length : index;
}

export function sortOrgChartMembers(
  affiliation: Affiliation,
  members: OrgChartProfile[]
): OrgChartProfile[] {
  return [...members].sort((a, b) => {
    const leaderDiff = leaderSortScore(a.leader_role) - leaderSortScore(b.leader_role);
    if (leaderDiff !== 0) return leaderDiff;

    const positionDiff =
      positionSortScore(affiliation, a.position_level) -
      positionSortScore(affiliation, b.position_level);
    if (positionDiff !== 0) return positionDiff;

    return a.full_name.localeCompare(b.full_name, 'ko');
  });
}

function wakeTeamNames(): readonly string[] {
  return RANK_BY_AFFILIATION.wake.filter((rank) => rank !== '경영진');
}

function foundryTeamNames(): readonly string[] {
  return RANK_BY_AFFILIATION.sans_foundry.filter((rank) => rank !== '공장장');
}

function buildWakeTree(members: OrgChartProfile[]): OrgChartNode[] {
  const nodes: OrgChartNode[] = [];
  const ceos = sortOrgChartMembers('wake', members.filter((m) => m.position_level === 'CEO'));
  const coos = sortOrgChartMembers('wake', members.filter((m) => m.position_level === 'COO'));
  const teamMembers = members.filter(
    (m) => m.position_level !== 'CEO' && m.position_level !== 'COO'
  );

  const virtualRootId = 'root:wake';
  let rootId: string;
  let teamsParentId: string;

  if (ceos.length === 1) {
    nodes.push(personNode(ceos[0], null));
    rootId = ceos[0].user_id;

    if (coos.length === 1) {
      nodes.push(personNode(coos[0], rootId));
      teamsParentId = coos[0].user_id;
    } else {
      for (const coo of coos) {
        nodes.push(personNode(coo, rootId));
      }
      teamsParentId = rootId;
    }
  } else {
    nodes.push(rootNode(virtualRootId, '웨이크'));
    rootId = virtualRootId;

    for (const ceo of ceos) {
      nodes.push(personNode(ceo, rootId));
    }

    if (coos.length === 1) {
      nodes.push(personNode(coos[0], rootId));
      teamsParentId = coos[0].user_id;
    } else {
      for (const coo of coos) {
        nodes.push(personNode(coo, rootId));
      }
      teamsParentId = rootId;
    }
  }

  for (const teamName of wakeTeamNames()) {
    const teamId = `team:wake:${teamName}`;
    const grouped = sortOrgChartMembers(
      'wake',
      teamMembers.filter((member) => member.rank === teamName)
    );

    if (grouped.length === 0) continue;

    nodes.push(teamNode(teamId, teamName, teamsParentId));
    for (const member of grouped) {
      nodes.push(personNode(member, teamId));
    }
  }

  return nodes;
}

function buildSansTree(
  members: OrgChartProfile[],
  groupCeo: OrgChartProfile | null
): OrgChartNode[] {
  const nodes: OrgChartNode[] = [];
  let storesParentId: string;

  if (groupCeo) {
    nodes.push(personNode(groupCeo, null));
    storesParentId = groupCeo.user_id;
  } else {
    const rootId = 'root:sans';
    nodes.push(rootNode(rootId, '산스'));
    storesParentId = rootId;
  }

  for (const storeName of RANK_BY_AFFILIATION.sans) {
    const teamId = `team:sans:${storeName}`;
    const grouped = sortOrgChartMembers(
      'sans',
      members.filter((member) => member.rank === storeName)
    );

    if (grouped.length === 0) continue;

    nodes.push(teamNode(teamId, storeName, storesParentId));
    for (const member of grouped) {
      nodes.push(personNode(member, teamId));
    }
  }

  return nodes;
}

function buildSansFoundryTree(
  members: OrgChartProfile[],
  groupCeo: OrgChartProfile | null
): OrgChartNode[] {
  const nodes: OrgChartNode[] = [];
  const factoryHeads = sortOrgChartMembers(
    'sans_foundry',
    members.filter((m) => m.position_level === '공장장')
  );
  const teamMembers = members.filter((m) => m.position_level !== '공장장');

  let teamsParentId: string;
  const ceoParentId = groupCeo?.user_id ?? null;

  if (groupCeo) {
    nodes.push(personNode(groupCeo, null));
  }

  if (factoryHeads.length === 1) {
    nodes.push(personNode(factoryHeads[0], ceoParentId));
    teamsParentId = factoryHeads[0].user_id;
  } else if (factoryHeads.length > 1) {
    const rootId = groupCeo ? groupCeo.user_id : 'root:sans_foundry';
    if (!groupCeo) {
      nodes.push(rootNode('root:sans_foundry', '산스파운드리'));
    }
    for (const head of factoryHeads) {
      nodes.push(personNode(head, rootId));
    }
    teamsParentId = rootId;
  } else if (groupCeo) {
    teamsParentId = groupCeo.user_id;
  } else {
    const rootId = 'root:sans_foundry';
    nodes.push(rootNode(rootId, '산스파운드리'));
    teamsParentId = rootId;
  }

  for (const teamName of foundryTeamNames()) {
    const teamId = `team:sans_foundry:${teamName}`;
    const grouped = sortOrgChartMembers(
      'sans_foundry',
      teamMembers.filter((member) => member.rank === teamName)
    );

    if (grouped.length === 0) continue;

    nodes.push(teamNode(teamId, teamName, teamsParentId));
    for (const member of grouped) {
      nodes.push(personNode(member, teamId));
    }
  }

  return nodes;
}

export function buildOrgChartTree(
  affiliation: Affiliation,
  members: OrgChartProfile[],
  groupCeo: OrgChartProfile | null = null
): OrgChartNode[] {
  const eligible = members.filter(isEligibleOrgChartMember);

  switch (affiliation) {
    case 'wake':
      return buildWakeTree(eligible);
    case 'sans':
      return buildSansTree(eligible, groupCeo);
    case 'sans_foundry':
      return buildSansFoundryTree(eligible, groupCeo);
    default: {
      const _exhaustive: never = affiliation;
      return _exhaustive;
    }
  }
}

export async function fetchGroupCeoProfile(): Promise<OrgChartProfile | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(ORG_CHART_PROFILE_SELECT)
    .eq('status', 'active')
    .eq('system_role', 'user')
    .eq('position_level', 'CEO')
    .order('full_name', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || !isEligibleOrgChartMember(data)) {
    return null;
  }

  return {
    user_id: data.user_id,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    email: data.email,
    phone: data.phone,
    affiliation: data.affiliation as Affiliation,
    rank: data.rank,
    position_level: data.position_level as string,
    leader_role: data.leader_role as LeaderRole | null,
    system_role: 'user' as const,
    status: 'active' as const
  };
}

export async function getOrgChartResponse(affiliation: Affiliation) {
  const profiles = await listOrgChartProfiles(affiliation);
  const groupCeo =
    affiliation === 'sans' || affiliation === 'sans_foundry'
      ? await fetchGroupCeoProfile()
      : null;

  return {
    success: true as const,
    affiliation,
    nodes: buildOrgChartTree(affiliation, profiles, groupCeo)
  };
}

export async function listOrgChartProfiles(
  affiliation: Affiliation
): Promise<OrgChartProfile[]> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(ORG_CHART_PROFILE_SELECT)
    .eq('affiliation', affiliation)
    .eq('status', 'active')
    .eq('system_role', 'user')
    .not('position_level', 'is', null);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter(isEligibleOrgChartMember)
    .map((row) => ({
      user_id: row.user_id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      email: row.email,
      phone: row.phone,
      affiliation: row.affiliation as Affiliation,
      rank: row.rank,
      position_level: row.position_level as string,
      leader_role: row.leader_role as LeaderRole | null,
      system_role: 'user' as const,
      status: 'active' as const
    }));
}

export function getAffiliationQueryLabel(affiliation: Affiliation): string {
  return AFFILIATION_OPTIONS.find((option) => option.value === affiliation)?.label ?? affiliation;
}

export { EXECUTIVE_POSITION_LEVELS };
