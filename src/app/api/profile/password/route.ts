import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminSignOutGlobal } from '@/lib/auth/admin-auth';
import { changePasswordSchema } from '@/features/auth/schemas/password';
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
import { createClient as createServerClient } from '@/lib/supabase/server';

const GENERIC_ERROR = '비밀번호 변경에 실패했습니다.';

function profileTargetLabel(profile: {
  email: string;
  full_name: string;
}): string {
  const name = formatActorDisplayName(profile);
  return name ? `${name} (${profile.email})` : profile.email;
}

export async function PATCH(request: NextRequest) {
  const requestId = createRequestId();
  const httpPath = '/api/profile/password';

  try {
    const session = await requireSession();
    if (!session.ok) {
      const status = session.response.status;
      const actor = await resolveLoggingActor(status);
      return finishWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.password_change',
          targetType: 'profile',
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

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.password_change',
          targetType: 'profile',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('validation', '입력값이 올바르지 않습니다.')
        },
        { success: false, message: '입력값이 올바르지 않습니다.' },
        400
      );
    }

    const supabase = await createServerClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, status')
      .eq('user_id', session.userId)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.password_change',
          targetType: 'profile',
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

    const { getSupabasePublishableKey, getSupabaseUrl } = await import('@/lib/supabase/env');

    let supabaseUrl: string;
    let publishableKey: string;

    try {
      supabaseUrl = getSupabaseUrl();
      publishableKey = getSupabasePublishableKey();
    } catch {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.password_change',
          targetType: 'profile',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('internal_error', GENERIC_ERROR)
        },
        { success: false, message: GENERIC_ERROR },
        500
      );
    }

    const verifyClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const signInEmail = session.profile.email ?? profile.email;

    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email: signInEmail,
      password: parsed.data.current_password
    });

    if (verifyError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.password_change',
          targetType: 'profile',
          targetUserId: session.userId,
          targetLabel,
          httpMethod: 'PATCH',
          httpPath,
          metadata: buildErrorMetadata('wrong_password', GENERIC_ERROR)
        },
        { success: false, message: GENERIC_ERROR },
        400
      );
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
      current_password: parsed.data.current_password
    });

    if (updateError) {
      return jsonWithActivityLog(
        requestId,
        {
          ...actor,
          action: 'profile.password_change',
          targetType: 'profile',
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

    await adminSignOutGlobal(session.userId);

    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'profile.password_change',
        targetType: 'profile',
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const actor = await resolveLoggingActor(500);
    return jsonWithActivityLog(
      requestId,
      {
        ...actor,
        action: 'profile.password_change',
        targetType: 'profile',
        targetUserId: actor.actorUserId,
        targetLabel: actor.actorEmail,
        httpMethod: 'PATCH',
        httpPath,
        metadata: buildErrorMetadata('internal_error', message)
      },
      { success: false, message },
      500
    );
  }
}
