import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import {
  actorFromProfile,
  buildErrorMetadata,
  createRequestId,
  finishWithActivityLog,
  formatActorDisplayName,
  jsonWithActivityLog,
  resolveLoggingActor
} from '@/features/activity-logs/api/log.server';
import { requireSession } from '@/features/auth/api/session.server';
import { forcePasswordChangeSchema } from '@/features/auth/schemas/force-password';
import { adminSignOutGlobal } from '@/lib/auth/admin-auth';
import { isInitialUserPassword } from '@/lib/auth/initial-password';
import {
  clearMustChangeInitialPasswordCookie,
  clearMustChangeInitialPasswordCookieOnResponse,
  hasMustChangeInitialPasswordCookie
} from '@/lib/auth/must-change-cookie';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';

const httpPath = '/api/auth/force-password-change';

const GENERIC_ERROR =
  '비밀번호 변경에 실패했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.';
const FORBIDDEN_MESSAGE = '초기 비밀번호 변경이 필요합니다.';
const INITIAL_PASSWORD_BLOCKED_MESSAGE =
  '12341234a 비밀번호는 사용할 수 없습니다. 비밀번호를 변경해 주세요';

function flattenValidationErrors(error: import('zod').ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function profileTargetLabel(profile: { email: string; full_name: string }): string {
  const name = formatActorDisplayName(profile);
  return name ? `${name} (${profile.email})` : profile.email;
}

export async function PATCH(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const session = await requireSession();
    if (!session.ok) {
      const status = session.response.status;
      const actor = await resolveLoggingActor(status);
      return finishWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'auth.force_password_change',
          targetType: 'auth',
          targetUserId: actor.actorUserId,
          targetLabel: actor.actorEmail,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata(
            status === 401 ? 'unauthenticated' : status === 403 ? 'forbidden' : 'internal_error'
          )
        },
        session.response
      );
    }

    const actor = actorFromProfile(session.profile);
    const targetLabel = profileTargetLabel(session.profile);
    const cookieStore = await cookies();

    if (!hasMustChangeInitialPasswordCookie(cookieStore)) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'auth.force_password_change',
          targetType: 'auth',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('forbidden', FORBIDDEN_MESSAGE)
        },
        { success: false, message: FORBIDDEN_MESSAGE },
        403
      );
    }

    const body = await request.json();
    const parsed = forcePasswordChangeSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'auth.force_password_change',
          targetType: 'auth',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', '입력값이 올바르지 않습니다.', {
            validation_errors: flattenValidationErrors(parsed.error)
          })
        },
        { success: false, message: '입력값이 올바르지 않습니다.' },
        400
      );
    }

    if (isInitialUserPassword(parsed.data.new_password)) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'auth.force_password_change',
          targetType: 'auth',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', INITIAL_PASSWORD_BLOCKED_MESSAGE)
        },
        { success: false, message: INITIAL_PASSWORD_BLOCKED_MESSAGE },
        400
      );
    }

    const supabase = await createClient();
    const adminClient = getServiceRoleClient();

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      session.userId,
      { password: parsed.data.new_password }
    );

    if (updateError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'auth.force_password_change',
          targetType: 'auth',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', GENERIC_ERROR)
        },
        { success: false, message: GENERIC_ERROR },
        400
      );
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ password_set_at: new Date().toISOString() })
      .eq('user_id', session.userId);

    if (profileError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'auth.force_password_change',
          targetType: 'auth',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('internal_error', profileError.message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    await supabase.auth.signOut();

    try {
      await adminSignOutGlobal(session.userId);
    } catch (signOutError) {
      const message =
        signOutError instanceof Error ? signOutError.message : 'Session revoke failed';
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'auth.force_password_change',
          targetType: 'auth',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('internal_error', message)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    clearMustChangeInitialPasswordCookie(cookieStore);

    const successResponse = await jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'auth.force_password_change',
        targetType: 'auth',
        targetUserId: session.userId,
        targetLabel,
        httpMethod: 'PATCH',
        httpPath,
        metadata: {}
      },
      {
        success: true,
        message: '비밀번호가 변경되었습니다. 다시 로그인해 주세요.'
      },
      200
    );
    clearMustChangeInitialPasswordCookieOnResponse(successResponse);
    return successResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const actor = await resolveLoggingActor(500);
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'auth.force_password_change',
        targetType: 'auth',
        targetUserId: actor.actorUserId,
        targetLabel: actor.actorEmail,
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message: GENERIC_ERROR },
      500
    );
  }
}
