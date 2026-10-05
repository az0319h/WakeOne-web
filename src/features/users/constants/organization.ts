import type { z } from 'zod';

export const LEADER_ROLES = ['team_leader', 'part_leader'] as const;

export type LeaderRole = (typeof LEADER_ROLES)[number];

export const LEADER_ROLE_OPTIONS = [
  { value: 'team_leader' as const, label: '팀장 (T)' },
  { value: 'part_leader' as const, label: '파트장 (P)' }
] as const;

export const AFFILIATIONS = ['wake', 'sans', 'sans_foundry'] as const;

export type Affiliation = (typeof AFFILIATIONS)[number];

export const POSITION_LEVEL_BY_AFFILIATION: Record<Affiliation, readonly string[]> = {
  wake: ['CEO', 'COO', '부장', '차장', '과장', '대리', '주임', '사원'],
  sans: ['CEO', '점장', '부점장', '선임매니저', '매니저', '쉐프'],
  sans_foundry: ['CEO', '공장장', '팀장', '차장', '오퍼레이터']
};

export const EXECUTIVE_POSITION_LEVELS = ['CEO', 'COO'] as const;

export const SELECT_NONE_VALUE = '__none__' as const;

export const SELECT_NONE_OPTION = {
  value: SELECT_NONE_VALUE,
  label: '선택 안 함'
} as const;

export const AFFILIATION_OPTIONS = [
  { value: 'wake' as const, label: '웨이크' },
  { value: 'sans' as const, label: '산스' },
  { value: 'sans_foundry' as const, label: '산스파운드리' }
] as const;

export const RANK_BY_AFFILIATION: Record<Affiliation, readonly string[]> = {
  wake: [
    '경영진',
    '사업기획팀',
    '마케팅팀',
    '디자인팀',
    '구매물류팀',
    '인사팀',
    '회계팀',
    '총무'
  ],
  sans: ['익선', '신세계강남'],
  sans_foundry: ['공장장', '생산팀', '품질팀', '공무팀', '지원팀', '물류팀']
};

export function getAffiliationLabel(
  affiliation: Affiliation | null | undefined
): string | null {
  if (!affiliation) return null;
  return AFFILIATION_OPTIONS.find((option) => option.value === affiliation)?.label ?? null;
}

/** user rank Select — 경영진(웨이크)·공장장(산스파운드리) 제외 */
export function ranksForUserSelect(affiliation: Affiliation): readonly string[] {
  const ranks = RANK_BY_AFFILIATION[affiliation];
  if (affiliation === 'wake') {
    return ranks.filter((rank) => rank !== '경영진');
  }
  if (affiliation === 'sans_foundry') {
    return ranks.filter((rank) => rank !== '공장장');
  }
  return ranks;
}

export function resolveRankFromPositionLevel(positionLevel: string): string | null {
  if (positionLevel === 'CEO' || positionLevel === 'COO') {
    return '경영진';
  }
  return null;
}

export function normalizeLeaderRole(value: string | null | undefined): LeaderRole | null {
  if (!value || value === SELECT_NONE_VALUE) return null;
  if (LEADER_ROLES.includes(value as LeaderRole)) {
    return value as LeaderRole;
  }
  return null;
}

type OrganizationFieldValues = {
  affiliation?: Affiliation | null;
  rank?: string | null;
  position_level?: string | null;
};

type PositionFieldValues = {
  affiliation?: Affiliation | null;
  position_level?: string | null;
  leader_role?: string | null;
};

export function validateOrganizationFields(
  data: OrganizationFieldValues,
  ctx: z.RefinementCtx
): void {
  const { affiliation, rank, position_level } = data;

  if (rank == null || rank === '') return;

  if (
    affiliation === 'wake' &&
    rank === '경영진' &&
    (position_level === 'CEO' || position_level === 'COO')
  ) {
    return;
  }

  if (!affiliation) {
    ctx.addIssue({
      code: 'custom',
      message: '부서/사업장을 설정하려면 소속을 먼저 선택해 주세요.',
      path: ['rank']
    });
    return;
  }

  const allowed = ranksForUserSelect(affiliation);
  if (!allowed.includes(rank)) {
    ctx.addIssue({
      code: 'custom',
      message: '소속에 맞지 않는 부서/사업장입니다.',
      path: ['rank']
    });
  }
}

export function validatePositionFields(
  data: PositionFieldValues,
  ctx: z.RefinementCtx
): void {
  const { affiliation, position_level, leader_role } = data;

  if (position_level == null || position_level === '') return;

  if (!affiliation) {
    ctx.addIssue({
      code: 'custom',
      message: '직급을 설정하려면 소속을 먼저 선택해 주세요.',
      path: ['position_level']
    });
    return;
  }

  const allowed = POSITION_LEVEL_BY_AFFILIATION[affiliation];
  if (!allowed.includes(position_level)) {
    ctx.addIssue({
      code: 'custom',
      message: '소속에 맞지 않는 직급입니다.',
      path: ['position_level']
    });
  }

  if (
    leader_role != null &&
    leader_role !== '' &&
    leader_role !== SELECT_NONE_VALUE &&
    !LEADER_ROLES.includes(leader_role as LeaderRole)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: '리더 역할이 올바르지 않습니다.',
      path: ['leader_role']
    });
  }
}
