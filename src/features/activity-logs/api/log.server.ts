import 'server-only';

import { NextResponse } from 'next/server';
import type { AuthProfile } from '@/features/auth/api/types';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type {
  ActivityAction,
  ActivityLogErrorCode,
  ActivityLogMetadata,
  ActivityTargetType
} from './types';

const METADATA_ALLOWLIST = new Set([
  'error_code',
  'message',
  'validation_errors',
  'changed_fields',
  'attempted_target',
  'asset_number',
  'asset_name',
  'document_number',
  'source_message_id',
  'source_type',
  'file_name',
  'recipient_email',
  'missing_document_numbers',
  'status',
  'unmatched_count',
  'unmatched_author_names',
  'notification_id',
  'count',
  'duplicate_run'
]);

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

export function formatActorDisplayName(
  profile: Pick<AuthProfile, 'full_name'>
): string | null {
  const name = profile.full_name?.trim() ?? '';
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
    actorDisplayName: formatActorDisplayName(profile)
  };
}

export const ANONYMOUS_ACTOR = {
  actorUserId: null,
  actorEmail: 'anonymous',
  actorDisplayName: null
} as const;

export async function resolveLoggingActor(
  httpStatus: number,
  session?: { userId: string; profile: AuthProfile }
): Promise<{
  actorUserId: string | null;
  actorEmail: string;
  actorDisplayName: string | null;
}> {
  if (session) {
    return {
      actorUserId: session.userId,
      actorEmail: session.profile.email,
      actorDisplayName: formatActorDisplayName(session.profile)
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
  errors: Record<string, string> | undefined
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

    if (key === 'validation_errors') {
      const cleaned = sanitizeValidationErrors(value as Record<string, string>);
      if (cleaned) {
        sanitized.validation_errors = cleaned;
      }
      continue;
    }

    if (key === 'changed_fields' && Array.isArray(value)) {
      sanitized.changed_fields = value.filter(
        (field) => typeof field === 'string' && !SENSITIVE_FIELD_PATTERN.test(field)
      );
      continue;
    }

    if (key === 'missing_document_numbers' && Array.isArray(value)) {
      sanitized.missing_document_numbers = value.filter((item) => typeof item === 'string');
      continue;
    }

    if (key === 'unmatched_author_names' && Array.isArray(value)) {
      sanitized.unmatched_author_names = value.filter((item) => typeof item === 'string');
      continue;
    }

    if (key === 'unmatched_count' && typeof value === 'number') {
      sanitized.unmatched_count = value;
      continue;
    }

    if (key === 'count' && typeof value === 'number') {
      sanitized.count = value;
      continue;
    }

    if (key === 'duplicate_run' && typeof value === 'boolean') {
      sanitized.duplicate_run = value;
      continue;
    }

    if (key === 'notification_id' && typeof value === 'number') {
      sanitized.notification_id = value;
      continue;
    }

    if (key === 'message' && typeof value === 'string') {
      if (!SENSITIVE_FIELD_PATTERN.test(value)) {
        sanitized.message = value;
      }
      continue;
    }

    if (typeof value === 'string' || typeof value === 'object') {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }

  return sanitized;
}

export function buildErrorMetadata(
  errorCode: ActivityLogErrorCode,
  message?: string,
  extra?: ActivityLogMetadata
): ActivityLogMetadata {
  return sanitizeMetadata({
    error_code: errorCode,
    ...(message ? { message } : {}),
    ...extra
  });
}

export async function recordActivityLog(input: RecordActivityLogInput): Promise<void> {
  try {
    const supabase = getServiceRoleClient();
    const metadata = sanitizeMetadata(input.metadata);

    const { error } = await supabase.from('activity_logs').insert({
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
      metadata
    });

    if (error) {
      console.error('[activity-logs] insert failed:', error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[activity-logs] insert failed:', message);
  }
}

export function withRequestId(response: NextResponse, requestId: string): NextResponse {
  const headers = new Headers(response.headers);
  headers.set('x-request-id', requestId);
  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function jsonWithActivityLog(
  requestId: string,
  logInput: Omit<RecordActivityLogInput, 'requestId' | 'httpStatus'>,
  body: unknown,
  status: number
): Promise<NextResponse> {
  await recordActivityLog({
    ...logInput,
    requestId,
    httpStatus: status
  });

  return NextResponse.json(body, {
    status,
    headers: { 'x-request-id': requestId }
  });
}

export async function finishWithActivityLog(
  requestId: string,
  logInput: Omit<RecordActivityLogInput, 'requestId' | 'httpStatus'>,
  response: NextResponse
): Promise<NextResponse> {
  await recordActivityLog({
    ...logInput,
    requestId,
    httpStatus: response.status
  });

  return withRequestId(response, requestId);
}

export async function fetchUserTargetLabel(userId: string): Promise<string> {
  try {
    const supabase = getServiceRoleClient();
    const { data } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data?.email) {
      return userId;
    }

    const name = data.full_name?.trim() ?? '';
    return name ? `${name} (${data.email})` : data.email;
  } catch {
    return userId;
  }
}
