/**
 * Route 요청 body 구조 파싱 (형식만 — 업무 규칙은 lib/required-rules · lib/approval-line-rules · RPC).
 */
import {
  isWorkflowNotificationSetting,
  type WorkflowApprovalLineInput,
  type WorkflowReferrerInput
} from '../lib/approval-line-rules';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** uuid 배열 (undefined/null → []). 형식이 틀리면 null */
export function parseUuidArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (!isUuid(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

/**
 * 결재선 body 파싱. `steps`: uuid 배열의 배열, `referrers`: [{ user_id, notification_setting }].
 * allowEmptyStep=true면 빈 단계 배열을 그대로 둔다(임시저장).
 */
export function parseApprovalLineBody(
  body: Record<string, unknown>,
  options: { allowEmptyStep?: boolean } = {}
): WorkflowApprovalLineInput | null {
  const rawSteps = body.steps ?? [];
  const rawReferrers = body.referrers ?? [];
  if (!Array.isArray(rawSteps) || !Array.isArray(rawReferrers)) return null;

  const steps: string[][] = [];
  for (const rawStep of rawSteps) {
    if (!Array.isArray(rawStep)) return null;
    const ids: string[] = [];
    for (const id of rawStep) {
      if (!isUuid(id)) return null;
      ids.push(id);
    }
    if (ids.length === 0 && options.allowEmptyStep === false) return null;
    steps.push(ids);
  }

  const referrers: WorkflowReferrerInput[] = [];
  for (const rawReferrer of rawReferrers) {
    const record = asRecord(rawReferrer);
    if (!record || !isUuid(record.user_id)) return null;
    const setting = record.notification_setting ?? 'START_AND_END';
    if (!isWorkflowNotificationSetting(setting)) return null;
    referrers.push({ user_id: record.user_id, notification_setting: setting });
  }

  return { steps, referrers };
}

export function optionalTrimmedString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text.length > maxLength) return undefined;
  return text;
}
