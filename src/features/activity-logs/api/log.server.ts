import "server-only";

import { NextResponse } from "next/server";
import type { AuthProfile } from "@/features/auth/api/types";
import { getSessionProfile } from "@/features/auth/api/session.server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  ActivityAction,
  ActivityLogErrorCode,
  ActivityLogMetadata,
  ActivityTargetType,
} from "./types";

const METADATA_ALLOWLIST = new Set([
  "error_code",
  "message",
  "validation_errors",
  "changed_fields",
  "attempted_target",
  "asset_number",
  "asset_name",
  "document_number",
  "source_message_id",
  "task_key",
  "benefit_type",
  "benefit_month",
  "benefit_month_reason",
  "source_type",
  "file_name",
  "recipient_email",
  "missing_document_numbers",
  "status",
  "unmatched_count",
  "unmatched_author_names",
  "notification_id",
  "count",
  "duplicate_run",
  "announcement_id",
  "support_request_id",
  "comment_id",
  "parent_id",
  "root_comment_id",
  "depth",
  "deleted_by_admin",
  "body_length",
  "previous_status",
  "new_status",
  "title",
  "must_change",
  "target_user_id",
  "enabled",
  "hour",
  "minute",
  "exclude_weekends",
  "run_id",
  "recipient_status",
  "due_count",
  "sent_count",
  "failed_count",
  "blocked_count",
  "skipped_count",
  "deleted_count",
  "google_email",
  "tasklist_id",
  "task_id",
  "parent_task_id",
  "previous_tasklist_id",
  "approval_source",
  "rejection_reason",
  "birthday_set",
  "affiliation",
  "document_id",
  "document_code",
  "template_key",
  "step",
  "starred",
  "changed_field_keys",
  "attachment_count",
  "quick_request_no",
  "changedFields",
  "recentAddressesRecorded",
  "message_id",
  "total_bytes",
  "attachment_id",
  "participant_user_id",
  "self",
  "created",
  "device_count",
  "endpoint_host",
  "disabled_groups",
  "attempted",
  "sent",
  "removed",
  // plan 100 — 퀵 대화 AI 답장 추천 (본문·추천 문장 금지)
  "source",
  "message_count",
  "latency_ms",
  "input_tokens",
  "output_tokens",
  // plan 105 — 휴대폰 알림 자동 복구 · detach (`source`는 plan 100 키 공용 · 식별자 문자열만 · 자유 문장 금지)
  "result",
  "reason",
]);

/** plan 105 — `source`·`result`·`reason`은 코드 식별자(`auto_resume`·`detached`·`owned_by_other` 등)만 남긴다 */
const METADATA_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

const SENSITIVE_FIELD_PATTERN =
  /password|token|secret|temporary_password|current_password|new_password/i;

export type RecordActivityLogInput = {
  requestId: string;
  actorUserId: string | null;
  actorEmail: string;
  actorDisplayName?: string | null;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetUserId: string | null;
  targetLabel: string;
  httpMethod: string;
  httpPath: string;
  httpStatus: number;
  metadata?: ActivityLogMetadata;
};

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function formatActorDisplayName(profile: Pick<AuthProfile, "full_name">): string | null {
  const name = profile.full_name?.trim() ?? "";
  return name || null;
}

export function actorFromProfile(profile: AuthProfile): {
  actorUserId: string;
  actorEmail: string;
  actorDisplayName: string | null;
} {
  return {
    actorUserId: profile.user_id,
    actorEmail: profile.email,
    actorDisplayName: formatActorDisplayName(profile),
  };
}

export const ANONYMOUS_ACTOR = {
  actorUserId: null,
  actorEmail: "anonymous",
  actorDisplayName: null,
} as const;

export async function resolveLoggingActor(
  httpStatus: number,
  session?: { userId: string; profile: AuthProfile },
): Promise<{
  actorUserId: string | null;
  actorEmail: string;
  actorDisplayName: string | null;
}> {
  if (session) {
    return {
      actorUserId: session.userId,
      actorEmail: session.profile.email,
      actorDisplayName: formatActorDisplayName(session.profile),
    };
  }

  if (httpStatus === 401) {
    return ANONYMOUS_ACTOR;
  }

  const profile = await getSessionProfile();
  if (profile) {
    return actorFromProfile(profile);
  }

  return ANONYMOUS_ACTOR;
}

function sanitizeValidationErrors(
  errors: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!errors) {
    return undefined;
  }

  const sanitized: Record<string, string> = {};
  for (const [field, value] of Object.entries(errors)) {
    if (SENSITIVE_FIELD_PATTERN.test(field)) {
      continue;
    }
    sanitized[field] = value;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function sanitizeMetadata(metadata?: ActivityLogMetadata): ActivityLogMetadata {
  if (!metadata) {
    return {};
  }

  const sanitized: ActivityLogMetadata = {};

  for (const key of METADATA_ALLOWLIST) {
    if (!(key in metadata)) {
      continue;
    }

    const value = metadata[key as keyof ActivityLogMetadata];
    if (value === undefined || value === null) {
      continue;
    }

    if (key === "validation_errors") {
      const cleaned = sanitizeValidationErrors(value as Record<string, string>);
      if (cleaned) {
        sanitized.validation_errors = cleaned;
      }
      continue;
    }

    if (key === "changed_fields" && Array.isArray(value)) {
      sanitized.changed_fields = value.filter(
        (field) => typeof field === "string" && !SENSITIVE_FIELD_PATTERN.test(field),
      );
      continue;
    }

    if (key === "missing_document_numbers" && Array.isArray(value)) {
      sanitized.missing_document_numbers = value.filter((item) => typeof item === "string");
      continue;
    }

    if (key === "unmatched_author_names" && Array.isArray(value)) {
      sanitized.unmatched_author_names = value.filter((item) => typeof item === "string");
      continue;
    }

    if (key === "unmatched_count" && typeof value === "number") {
      sanitized.unmatched_count = value;
      continue;
    }

    if (key === "count" && typeof value === "number") {
      sanitized.count = value;
      continue;
    }

    if (key === "duplicate_run" && typeof value === "boolean") {
      sanitized.duplicate_run = value;
      continue;
    }

    if (key === "must_change" && typeof value === "boolean") {
      sanitized.must_change = value;
      continue;
    }

    if (key === "announcement_id" && typeof value === "number") {
      sanitized.announcement_id = value;
      continue;
    }

    if (key === "support_request_id" && typeof value === "number") {
      sanitized.support_request_id = value;
      continue;
    }

    if (key === "comment_id" && typeof value === "number") {
      sanitized.comment_id = value;
      continue;
    }

    // plan 93 — 퀵 대화 (본문은 allowlist에 없어 자동 제거)
    if (key === "message_id" && typeof value === "number") {
      sanitized.message_id = value;
      continue;
    }

    if (key === "parent_id" && (typeof value === "number" || value === null)) {
      sanitized.parent_id = value;
      continue;
    }

    if (key === "root_comment_id" && (typeof value === "number" || value === null)) {
      sanitized.root_comment_id = value;
      continue;
    }

    if (key === "depth" && typeof value === "number") {
      sanitized.depth = value;
      continue;
    }

    if (key === "deleted_by_admin" && typeof value === "boolean") {
      sanitized.deleted_by_admin = value;
      continue;
    }

    if (key === "body_length" && typeof value === "number") {
      sanitized.body_length = value;
      continue;
    }

    if (key === "previous_status" && typeof value === "string") {
      sanitized.previous_status = value;
      continue;
    }

    if (key === "new_status" && typeof value === "string") {
      sanitized.new_status = value;
      continue;
    }

    if (key === "title" && typeof value === "string") {
      sanitized.title = value.length > 100 ? `${value.slice(0, 100)}…` : value;
      continue;
    }

    if (key === "notification_id" && typeof value === "number") {
      sanitized.notification_id = value;
      continue;
    }

    if (key === "run_id" && typeof value === "number") {
      sanitized.run_id = value;
      continue;
    }

    if (key === "hour" && typeof value === "number") {
      sanitized.hour = value;
      continue;
    }

    if (key === "minute" && typeof value === "number") {
      sanitized.minute = value;
      continue;
    }

    if (
      (key === "due_count" ||
        key === "sent_count" ||
        key === "failed_count" ||
        key === "blocked_count" ||
        key === "skipped_count") &&
      typeof value === "number"
    ) {
      (sanitized as Record<string, unknown>)[key] = value;
      continue;
    }

    if (key === "enabled" && typeof value === "boolean") {
      sanitized.enabled = value;
      continue;
    }

    if (key === "exclude_weekends" && typeof value === "boolean") {
      sanitized.exclude_weekends = value;
      continue;
    }

    if (key === "target_user_id" && typeof value === "string") {
      sanitized.target_user_id = value;
      continue;
    }

    if (key === "recipient_status" && typeof value === "string") {
      sanitized.recipient_status = value;
      continue;
    }

    if (key === "google_email" && typeof value === "string") {
      sanitized.google_email = value;
      continue;
    }

    if (key === "approval_source" && typeof value === "string") {
      sanitized.approval_source = value;
      continue;
    }

    if (key === "rejection_reason" && typeof value === "string") {
      sanitized.rejection_reason = value;
      continue;
    }

    if (key === "birthday_set" && typeof value === "boolean") {
      sanitized.birthday_set = value;
      continue;
    }

    // plan 98 — `total_bytes`·`attachment_id`(퀵 대화 첨부)도 숫자 그대로 (allowlist에만 있고 숫자 분기가 없어 누락됐던 것 · verifier 수정)
    if (
      (key === "step" || key === "attachment_count" || key === "total_bytes" || key === "attachment_id") &&
      typeof value === "number"
    ) {
      (sanitized as Record<string, unknown>)[key] = value;
      continue;
    }

    if (key === "starred" && typeof value === "boolean") {
      sanitized.starred = value;
      continue;
    }

    if (key === "changed_field_keys" && Array.isArray(value)) {
      sanitized.changed_field_keys = value.filter(
        (field): field is string => typeof field === "string",
      );
      continue;
    }

    if (key === "changedFields" && Array.isArray(value)) {
      sanitized.changedFields = value.filter(
        (field): field is string =>
          typeof field === "string" && !SENSITIVE_FIELD_PATTERN.test(field),
      );
      continue;
    }

    if (key === "recentAddressesRecorded" && typeof value === "boolean") {
      sanitized.recentAddressesRecorded = value;
      continue;
    }

    // plan 91 — 휴대폰 푸시
    if (key === "created" && typeof value === "boolean") {
      sanitized.created = value;
      continue;
    }

    // plan 101 D-13 — 참여자 제외/나가기 (`self` = 본인 나가기)
    if (key === "self" && typeof value === "boolean") {
      sanitized.self = value;
      continue;
    }

    if (
      (key === "device_count" || key === "attempted" || key === "sent" || key === "removed") &&
      typeof value === "number"
    ) {
      (sanitized as Record<string, unknown>)[key] = value;
      continue;
    }

    // plan 100 — AI 답장 추천 숫자 메타 (allowlist만 넣고 숫자 분기를 빠뜨리면 값이 사라진다 — 98·101 전례)
    if (
      (key === "message_count" ||
        key === "latency_ms" ||
        key === "input_tokens" ||
        key === "output_tokens") &&
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      (sanitized as Record<string, unknown>)[key] = value;
      continue;
    }

    if (key === "source" && (value === "ai" || value === "rules")) {
      sanitized.source = value;
      continue;
    }

    // plan 105 — 푸시 구독 출처·detach 결과·409 사유 (식별자만 · 그 밖의 값은 버린다)
    if (key === "source" || key === "result" || key === "reason") {
      if (typeof value === "string" && METADATA_IDENTIFIER_PATTERN.test(value)) {
        (sanitized as Record<string, unknown>)[key] = value;
      }
      continue;
    }

    if (key === "endpoint_host" && typeof value === "string") {
      sanitized.endpoint_host = value;
      continue;
    }

    if (key === "disabled_groups" && Array.isArray(value)) {
      sanitized.disabled_groups = value.filter((item): item is string => typeof item === "string");
      continue;
    }

    if (key === "message" && typeof value === "string") {
      if (!SENSITIVE_FIELD_PATTERN.test(value)) {
        sanitized.message = value;
      }
      continue;
    }

    if (typeof value === "string" || typeof value === "object") {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }

  return sanitized;
}

export function buildErrorMetadata(
  errorCode: ActivityLogErrorCode,
  message?: string,
  extra?: ActivityLogMetadata,
): ActivityLogMetadata {
  return sanitizeMetadata({
    error_code: errorCode,
    ...(message ? { message } : {}),
    ...extra,
  });
}

export async function recordActivityLog(input: RecordActivityLogInput): Promise<void> {
  try {
    const supabase = getServiceRoleClient();
    const metadata = sanitizeMetadata(input.metadata);

    const { error } = await supabase.from("activity_logs").insert({
      request_id: input.requestId,
      actor_user_id: input.actorUserId,
      actor_email: input.actorEmail,
      actor_display_name: input.actorDisplayName ?? null,
      action: input.action,
      target_type: input.targetType,
      target_user_id: input.targetUserId,
      target_label: input.targetLabel,
      http_method: input.httpMethod,
      http_path: input.httpPath,
      http_status: input.httpStatus,
      metadata,
    });

    if (error) {
      console.error("[activity-logs] insert failed:", error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[activity-logs] insert failed:", message);
  }
}

export function withRequestId(response: NextResponse, requestId: string): NextResponse {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function jsonWithActivityLog(
  requestId: string,
  logInput: Omit<RecordActivityLogInput, "requestId" | "httpStatus">,
  body: unknown,
  status: number,
): Promise<NextResponse> {
  await recordActivityLog({
    ...logInput,
    requestId,
    httpStatus: status,
  });

  return NextResponse.json(body, {
    status,
    headers: { "x-request-id": requestId },
  });
}

export async function finishWithActivityLog(
  requestId: string,
  logInput: Omit<RecordActivityLogInput, "requestId" | "httpStatus">,
  response: NextResponse,
): Promise<NextResponse> {
  await recordActivityLog({
    ...logInput,
    requestId,
    httpStatus: response.status,
  });

  return withRequestId(response, requestId);
}

export async function fetchUserTargetLabel(userId: string): Promise<string> {
  try {
    const supabase = getServiceRoleClient();
    const { data } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data?.email) {
      return userId;
    }

    const name = data.full_name?.trim() ?? "";
    return name ? `${name} (${data.email})` : data.email;
  } catch {
    return userId;
  }
}
