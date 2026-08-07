import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ANONYMOUS_ACTOR,
  buildErrorMetadata,
  createRequestId,
  jsonWithActivityLog
} from '@/features/activity-logs/api/log.server';
import { adminSignOutGlobal } from '@/lib/auth/admin-auth';
import { normalizeEmail } from '@/lib/auth/normalize-email';
import { generateTemporaryPassword } from '@/lib/auth/temp-password';
import { sendPasswordResetEmail } from '@/lib/mail/send-password-reset-email';
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase/env';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

const httpPath = '/api/auth/forgot-password/verify';

const SUCCESS_MESSAGE = '임시 비밀번호를 이메일로 보냈습니다. 로그인해 주세요.';
const GENERIC_ERROR = '요청 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
const OTP_ERROR_MESSAGE = '인증번호가 올바르지 않거나 만료되었습니다.';

const verifySchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해 주세요.')
    .email('올바른 이메일 주소를 입력해 주세요.'),
  token: z
    .string()
    .regex(/^\d{6}$/, '6자리 인증번호를 입력해 주세요.')
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

function getSignInUrl(): string {
  return `${getAppUrl()}/auth/sign-in`;
}

function baseLogInput(targetUserId: string | null, targetLabel: string) {
  return {
    ...ANONYMOUS_ACTOR,
    action: 'auth.password_reset_complete' as const,
    targetType: 'auth' as const,
    targetUserId,
    targetLabel,
    httpMethod: 'POST',
    httpPath
  };
}

function createEphemeralAuthClient() {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      const emailAttempt =
        typeof body?.email === 'string' ? normalizeEmail(body.email) : 'anonymous';

      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(null, emailAttempt),
          metadata: buildErrorMetadata('validation', '입력값이 올바르지 않습니다.', {
            validation_errors: flattenValidationErrors(parsed.error)
          })
        },
        { success: false, message: '입력값이 올바르지 않습니다.' },
        400
      );
    }

    const normalizedEmail = normalizeEmail(parsed.data.email);
    let verifyClient;

    try {
      verifyClient = createEphemeralAuthClient();
    } catch (envError) {
      const message = envError instanceof Error ? envError.message : 'Unknown env error';
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(null, normalizedEmail),
          metadata: buildErrorMetadata('internal_error', message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    const { data: otpData, error: otpError } = await verifyClient.auth.verifyOtp({
      email: normalizedEmail,
      token: parsed.data.token,
      type: 'recovery'
    });

    if (otpError || !otpData.user) {
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(null, normalizedEmail),
          metadata: buildErrorMetadata('invalid_otp', OTP_ERROR_MESSAGE)
        },
        { success: false, message: OTP_ERROR_MESSAGE },
        400
      );
    }

    const userId = otpData.user.id;
    const temporaryPassword = generateTemporaryPassword(10);
    const adminClient = getServiceRoleClient();

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: temporaryPassword
    });

    if (updateError) {
      await verifyClient.auth.signOut();
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(userId, normalizedEmail),
          metadata: buildErrorMetadata('internal_error', updateError.message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    try {
      await adminSignOutGlobal(userId);
    } catch (signOutError) {
      await verifyClient.auth.signOut();
      const message =
        signOutError instanceof Error ? signOutError.message : 'Session revoke failed';
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(userId, normalizedEmail),
          metadata: buildErrorMetadata('internal_error', message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ password_set_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (profileError) {
      await verifyClient.auth.signOut();
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(userId, normalizedEmail),
          metadata: buildErrorMetadata('internal_error', profileError.message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    try {
      await sendPasswordResetEmail({
        to: normalizedEmail,
        temporaryPassword,
        signInUrl: getSignInUrl()
      });
    } catch (mailError) {
      await verifyClient.auth.signOut();
      const message = mailError instanceof Error ? mailError.message : 'Mail send failed';
      return jsonWithActivityLog(
        requestId,
        {
          ...baseLogInput(userId, normalizedEmail),
          metadata: buildErrorMetadata('internal_error', message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    await verifyClient.auth.signOut();

    return jsonWithActivityLog(
      requestId,
      {
        ...baseLogInput(userId, normalizedEmail),
        metadata: {}
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
