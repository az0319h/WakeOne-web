import { NextResponse, type NextRequest } from 'next/server';
import {
  actorFromProfile,
  ANONYMOUS_ACTOR,
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import type {
  ActivityAction,
  ActivityLogErrorCode,
  ActivityLogMetadata,
  ActivityTargetType
} from '@/features/activity-logs/api/types';
import type { AuthProfile } from '@/features/auth/api/types';
import {
  WORKFLOW_GROUPS,
  WORKFLOW_SCOPES,
  WORKFLOW_SORTS,
  WORKFLOW_TABS,
  type WorkflowGroup,
  type WorkflowScope,
  type WorkflowSort,
  type WorkflowTab
} from '@/features/workflow/api/types';
import { WorkflowRpcError, type WorkflowListParams } from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import type { WorkflowValidationError } from '@/features/workflow/lib/required-rules';
import { getKstTodayDateString } from '@/lib/kst';

export type WorkflowAction = Extract<ActivityAction, `workflow.${string}`>;
export type WorkflowTargetType = Extract<ActivityTargetType, `workflow_${string}`>;

export function workflowTargetLabel(input: {
  code?: string | null;
  id?: string | null;
  templateName?: string | null;
}): string {
  const ref = input.code?.trim() || input.id?.trim() || 'unknown';
  const name = input.templateName?.trim() || 'unknown';
  return `workflow:${ref}:${name}`;
}

function errorCodeForStatus(status: number): ActivityLogErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'internal_error';
  return 'validation';
}

/**
 * CUD Route 전 분기 감사 로그 헬퍼 (plan 08 · 88). 모든 응답에 x-request-id.
 * metadata는 allowlist(document_id·document_code·template_key·step·starred·changed_field_keys·attachment_count·error_code)만.
 */
export class WorkflowRouteLog {
  readonly requestId = createRequestId();
  private actor: { actorUserId: string | null; actorEmail: string; actorDisplayName: string | null } = {
    ...ANONYMOUS_ACTOR
  };
  private targetLabel = 'workflow:unknown:unknown';
  private targetUserId: string | null = null;
  private baseMetadata: ActivityLogMetadata = {};

  constructor(
    private readonly opts: {
      action: WorkflowAction;
      targetType: WorkflowTargetType;
      method: string;
      path: string;
    }
  ) {}

  setActor(profile: AuthProfile) {
    this.actor = actorFromProfile(profile);
  }

  setTarget(label: string, targetUserId: string | null = null) {
    this.targetLabel = label;
    this.targetUserId = targetUserId;
  }

  setMetadata(metadata: ActivityLogMetadata) {
    this.baseMetadata = { ...this.baseMetadata, ...metadata };
  }

  private logInput(metadata: ActivityLogMetadata) {
    return {
      ...this.actor,
      action: this.opts.action,
      targetType: this.opts.targetType as ActivityTargetType,
      targetUserId: this.targetUserId,
      targetLabel: this.targetLabel,
      httpMethod: this.opts.method,
      httpPath: this.opts.path,
      metadata
    };
  }

  /** requireSession 계열 실패 응답(401/403/500)을 그대로 기록하고 x-request-id를 붙인다 */
  async authFailure(response: NextResponse): Promise<NextResponse> {
    const status = response.status;
    const actor = await resolveLoggingActor(status);
    this.actor = actor;
    return finishWithActivityLog(
      this.requestId,
      this.logInput({ ...this.baseMetadata, ...buildErrorMetadata(errorCodeForStatus(status)) }),
      response
    );
  }

  async success(body: Record<string, unknown>, status: number, metadata?: ActivityLogMetadata) {
    return jsonWithActivityLog(
      this.requestId,
      this.logInput({ ...this.baseMetadata, ...metadata }),
      { success: true, ...body },
      status
    );
  }

  async fail(
    status: number,
    message: string,
    extra: { fieldKey?: string; errors?: WorkflowValidationError[] } = {}
  ) {
    return jsonWithActivityLog(
      this.requestId,
      // metadata allowlist(plan 88): error_code만 — 응답 문구(message)는 넣지 않는다
      this.logInput({ ...this.baseMetadata, ...buildErrorMetadata(errorCodeForStatus(status)) }),
      {
        success: false,
        message,
        error: message,
        ...(extra.fieldKey ? { field_key: extra.fieldKey } : {}),
        ...(extra.errors ? { errors: extra.errors } : {})
      },
      status
    );
  }

  /** RPC 오류(WF{HTTP}) → 같은 status, 그 외 → 500 */
  async fromError(error: unknown, fallbackMessage = '처리 중 오류가 발생했습니다.') {
    if (error instanceof WorkflowRpcError) {
      return this.fail(error.status, error.message);
    }
    const message = error instanceof Error && error.message ? error.message : fallbackMessage;
    return this.fail(500, message);
  }
}

/** Read Route 공통 JSON (감사 로그 없음) */
export function workflowJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(status < 400 ? { success: true, ...body } : body, { status });
}

export function workflowReadError(status: number, message: string) {
  return NextResponse.json({ success: false, message, error: message }, { status });
}

export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const INVALID_BODY_MESSAGE = '요청 본문이 올바르지 않습니다.';

// ---------------------------------------------------------------------------
// 목록 query 파싱
// ---------------------------------------------------------------------------
function readMulti(searchParams: URLSearchParams, key: string): string[] {
  const values = [...searchParams.getAll(key), ...searchParams.getAll(`${key}[]`)];
  return [
    ...new Set(
      values
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ];
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function kstStartOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 업데이트일 필터 (KST): today · 7d · 1m · 3m · month:YYYY-MM · range:YYYY-MM-DD..YYYY-MM-DD
 * 반환: [from, to) ISO. 형식 오류면 null.
 */
export function parseUpdatedFilter(
  raw: string | null
): { from: string | null; to: string | null } | null {
  if (!raw) return { from: null, to: null };
  const today = getKstTodayDateString();
  const tomorrow = addDays(today, 1);

  if (raw === 'today') return { from: kstStartOfDayIso(today), to: kstStartOfDayIso(tomorrow) };
  if (raw === '7d') return { from: kstStartOfDayIso(addDays(today, -6)), to: null };
  if (raw === '1m') return { from: kstStartOfDayIso(addMonths(today, -1)), to: null };
  if (raw === '3m') return { from: kstStartOfDayIso(addMonths(today, -3)), to: null };

  const month = /^month:(\d{4})-(\d{2})$/.exec(raw);
  if (month) {
    const first = `${month[1]}-${month[2]}-01`;
    if (Number(month[2]) < 1 || Number(month[2]) > 12) return null;
    return { from: kstStartOfDayIso(first), to: kstStartOfDayIso(addMonths(first, 1)) };
  }

  const range = /^range:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(raw);
  if (range && DATE_RE.test(range[1]) && DATE_RE.test(range[2]) && range[1] <= range[2]) {
    return { from: kstStartOfDayIso(range[1]), to: kstStartOfDayIso(addDays(range[2], 1)) };
  }

  return null;
}

export type ParsedListQuery =
  | { ok: true; params: WorkflowListParams }
  | { ok: false; status: number; message: string };

export function parseWorkflowListQuery(
  searchParams: URLSearchParams,
  options: { isWorkflowAdmin: boolean }
): ParsedListQuery {
  const scope = pick<WorkflowScope>(searchParams.get('scope'), WORKFLOW_SCOPES, 'related');
  if (scope === 'company' && !options.isWorkflowAdmin) {
    return { ok: false, status: 403, message: '워크플로우 관리자 권한이 필요합니다.' };
  }

  const updated = parseUpdatedFilter(searchParams.get('updated'));
  if (!updated) {
    return { ok: false, status: 400, message: '업데이트일 조건이 올바르지 않습니다.' };
  }

  const writerIds = readMulti(searchParams, 'writer');
  if (writerIds.some((id) => !isUuid(id))) {
    return { ok: false, status: 400, message: '작성자 조건이 올바르지 않습니다.' };
  }

  const groupRaw = searchParams.get('group');
  const group = groupRaw ? pick<WorkflowGroup | 'none'>(groupRaw, WORKFLOW_GROUPS, 'none') : 'none';
  if (groupRaw && group === 'none') {
    return { ok: false, status: 400, message: '그룹 조건이 올바르지 않습니다.' };
  }

  const exclude = searchParams.get('exclude');
  const cursor = Number(searchParams.get('cursor') ?? '0');
  const limit = Number(searchParams.get('limit') ?? '20');
  const q = searchParams.get('q')?.trim() ?? '';

  return {
    ok: true,
    params: {
      tab: pick<WorkflowTab>(searchParams.get('tab'), WORKFLOW_TABS, 'in_progress'),
      scope,
      group: group === 'none' ? null : group,
      q: q ? q.slice(0, 200) : null,
      writerIds,
      templateKeys: readMulti(searchParams, 'template').slice(0, 50),
      updatedFrom: updated.from,
      updatedTo: updated.to,
      sort: pick<WorkflowSort>(searchParams.get('sort'), WORKFLOW_SORTS, 'updated_desc'),
      limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20,
      offset: Number.isInteger(cursor) && cursor > 0 ? cursor : 0,
      excludeId: exclude && isUuid(exclude) ? exclude : null
    }
  };
}
