import { RANK_BY_AFFILIATION } from '@/features/users/constants/organization';
import {
  ASSET_MESSAGES,
  isLedgerAffiliation,
  type AssigneeInput,
  type LedgerAffiliation
} from '../api/types';

/**
 * plan 103 — 대상자(구독)·사용자(비품) 입력 구조 검증 (순수 함수 · 서버/폼 공용).
 * 사람(user_id)의 실존·active·비동방 확인은 서버(`assignees.server.ts`)가 따로 한다.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_SUBSCRIPTION_ASSIGNEES = 100;

export function isValidTeam(affiliation: unknown, rank: unknown): affiliation is LedgerAffiliation {
  return (
    isLedgerAffiliation(affiliation) &&
    typeof rank === 'string' &&
    RANK_BY_AFFILIATION[affiliation].includes(rank)
  );
}

export function parseAssigneeInput(
  raw: unknown,
  options: { allowAffiliation: boolean }
): AssigneeInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;

  if (value.assignee_type === 'user') {
    return typeof value.user_id === 'string' && UUID_PATTERN.test(value.user_id)
      ? { assignee_type: 'user', user_id: value.user_id.toLowerCase() }
      : null;
  }
  if (value.assignee_type === 'team') {
    return isValidTeam(value.affiliation, value.rank)
      ? { assignee_type: 'team', affiliation: value.affiliation, rank: value.rank as string }
      : null;
  }
  if (value.assignee_type === 'affiliation' && options.allowAffiliation) {
    return isLedgerAffiliation(value.affiliation)
      ? { assignee_type: 'affiliation', affiliation: value.affiliation }
      : null;
  }
  return null;
}

export function assigneeKey(assignee: AssigneeInput): string {
  if (assignee.assignee_type === 'user') return `user:${assignee.user_id}`;
  if (assignee.assignee_type === 'team') return `team:${assignee.affiliation}:${assignee.rank}`;
  return `affiliation:${assignee.affiliation}`;
}

export type AssigneeListResult =
  | { ok: true; value: AssigneeInput[] }
  | { ok: false; message: string };

/** 구독 대상자 배열 — 형식 오류·동방 등 → 「선택할 수 없는 대상자예요.」 · 중복 → 「같은 대상자가 두 번 들어 있어요.」 */
export function parseSubscriptionAssigneeList(raw: unknown): AssigneeListResult {
  if (!Array.isArray(raw) || raw.length > MAX_SUBSCRIPTION_ASSIGNEES) {
    return { ok: false, message: ASSET_MESSAGES.invalidAssignee };
  }
  const seen = new Set<string>();
  const value: AssigneeInput[] = [];
  for (const item of raw) {
    const parsed = parseAssigneeInput(item, { allowAffiliation: true });
    if (!parsed) return { ok: false, message: ASSET_MESSAGES.invalidAssignee };
    const key = assigneeKey(parsed);
    if (seen.has(key)) return { ok: false, message: ASSET_MESSAGES.duplicateAssignee };
    seen.add(key);
    value.push(parsed);
  }
  return { ok: true, value };
}

export type EquipmentAssigneeResult =
  | { ok: true; value: Exclude<AssigneeInput, { assignee_type: 'affiliation' }> | null }
  | { ok: false; message: string };

/** 비품 사용자 — null(비어 있음) · 사람 · 팀 */
export function parseEquipmentAssignee(raw: unknown): EquipmentAssigneeResult {
  if (raw === null) return { ok: true, value: null };
  const parsed = parseAssigneeInput(raw, { allowAffiliation: false });
  if (!parsed || parsed.assignee_type === 'affiliation') {
    return { ok: false, message: ASSET_MESSAGES.invalidAssignee };
  }
  return { ok: true, value: parsed };
}
