import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ANONYMOUS_ACTOR,
  buildErrorMetadata,
  createRequestId,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import { normalizeEmail } from '@/lib/auth/normalize-email';
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

const httpPath = '/api/auth/forgot-password/request';

const SUCCESS_MESSAGE = '등록된 이메일이면 인증 코드를 보냈습니다.';
const GENERIC_ERROR = '요청 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';

const requestSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해 주세요.')
    .email('올바른 이메일 주소를 입력해 주세요.')
});

function flattenValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}

function baseLogInput(targetUserId: string | null, targetLabel: string) {
  return {
    ...ANONYMOUS_ACTOR,
    action: 'auth.password_reset_request' as const,
    targetType: 'auth' as const,
    targetUserId,
    targetLabel,
    httpMethod: 'POST',
    httpPath
  };
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(null, 'anonymous'),
          metadata: buildErrorMetadata('validation', '입력값이 올바르지 않습니다.', {
            validation_errors: flattenValidationErrors(parsed.error)
          })
        },
        { success: false, message: '입력값이 올바르지 않습니다.' },
        400
      );
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    const adminClient = getServiceRoleClient();

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('user_id, email, status')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profileError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(null, normalizedEmail),
          metadata: buildErrorMetadata('internal_error', profileError.message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    if (!profile || profile.status !== 'active') {
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(null, normalizedEmail),
          metadata: { attempted_target: normalizedEmail }
        },
        { success: true, message: SUCCESS_MESSAGE },
        200
      );
    }

    let supabaseUrl: string;
    let publishableKey: string;

    try {
      supabaseUrl = getSupabaseUrl();
      publishableKey = getSupabasePublishableKey();
    } catch (envError) {
      const message = envError instanceof Error ? envError.message : 'Unknown env error';
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(profile.user_id, normalizedEmail),
          metadata: buildErrorMetadata('internal_error', message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    const anonClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error: resetError } = await anonClient.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${getAppUrl()}/auth/forgot-password/verify`
    });

    if (resetError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(profile.user_id, normalizedEmail),
          metadata: buildErrorMetadata('internal_error', resetError.message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    return jsonWithActivityLog(
      requestId,
      {
        ...baseLogInput(profile.user_id, normalizedEmail),
        metadata: { recipient_email: normalizedEmail }
      },
      { success: true, message: SUCCESS_MESSAGE },
      200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return jsonWithActivityLog(
      requestId,
      {
        ...baseLogInput(null, 'anonymous'),
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message: GENERIC_ERROR },
      500
    );
  }
}
