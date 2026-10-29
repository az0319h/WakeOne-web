/**
 * plan 103 D-7 — 「내 것 / 내 팀」 판정 순수 함수 (서버 목록 필터 · node --test).
 *
 * - 내 구독(mine): 사람 = 나 · 팀 = (내 소속, 내 부서) · 소속 전체 = 내 소속
 * - 내 장비(mine · `personalOnly`): 나에게 배정된 것만(AC-11 — 팀 배정 장비는 「내 팀 장비」)
 * - 내 팀(team): 팀 = (내 소속, 내 부서) · 사람 = 같은 소속·같은 부서의 active 동료(**나 제외**) · 소속 전체는 포함하지 않음
 * - 부서(rank)나 소속이 없으면 「내 팀」은 성립하지 않는다(빈 목록 + `team_unavailable`)
 */

export type ScopeViewer = {
  user_id: string;
  affiliation: string | null;
  rank: string | null;
};

export type ScopeAssignee = {
  assignee_type: 'user' | 'team' | 'affiliation';
  user_id: string | null;
  affiliation: string | null;
  rank: string | null;
};

export function hasTeam(viewer: ScopeViewer): boolean {
  return Boolean(viewer.affiliation && viewer.rank);
}

export function isMineAssignee(assignee: ScopeAssignee, viewer: ScopeViewer): boolean {
  if (assignee.assignee_type === 'user') {
    return assignee.user_id === viewer.user_id;
  }
  if (assignee.assignee_type === 'team') {
    return (
      hasTeam(viewer) &&
      assignee.affiliation === viewer.affiliation &&
      assignee.rank === viewer.rank
    );
  }
  return Boolean(viewer.affiliation) && assignee.affiliation === viewer.affiliation;
}

export function isTeamAssignee(
  assignee: ScopeAssignee,
  viewer: ScopeViewer,
  teammateIds: ReadonlySet<string>
): boolean {
  if (!hasTeam(viewer)) return false;
  if (assignee.assignee_type === 'team') {
    return assignee.affiliation === viewer.affiliation && assignee.rank === viewer.rank;
  }
  if (assignee.assignee_type === 'user') {
    return (
      assignee.user_id !== null &&
      assignee.user_id !== viewer.user_id &&
      teammateIds.has(assignee.user_id)
    );
  }
  return false;
}

export function matchesAssetScope(
  assignees: readonly ScopeAssignee[],
  scope: 'all' | 'mine' | 'team',
  viewer: ScopeViewer,
  teammateIds: ReadonlySet<string>,
  options: { personalOnly?: boolean } = {}
): boolean {
  if (scope === 'all') return true;
  if (scope === 'mine') {
    if (options.personalOnly) {
      return assignees.some(
        (assignee) => assignee.assignee_type === 'user' && assignee.user_id === viewer.user_id
      );
    }
    return assignees.some((assignee) => isMineAssignee(assignee, viewer));
  }
  return assignees.some((assignee) => isTeamAssignee(assignee, viewer, teammateIds));
}
