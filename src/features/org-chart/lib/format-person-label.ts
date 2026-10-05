import type { LeaderRole } from '@/features/users/constants/organization';

export function formatLeaderSuffix(leaderRole: LeaderRole | null | undefined): string {
  if (leaderRole === 'team_leader') return '(T)';
  if (leaderRole === 'part_leader') return '(P)';
  return '';
}

export function formatPersonLabel(input: {
  fullName: string;
  positionLevel: string;
  leaderRole?: LeaderRole | null;
}): string {
  return `${input.fullName} ${input.positionLevel}${formatLeaderSuffix(input.leaderRole)}`;
}

export function formatLeaderRoleLabel(
  leaderRole: LeaderRole | null | undefined
): string | null {
  if (leaderRole === 'team_leader') return '팀장 (T)';
  if (leaderRole === 'part_leader') return '파트장 (P)';
  return null;
}
