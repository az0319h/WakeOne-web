import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_ERROR_MESSAGES } from '@/features/auth/api/types';
import { isInitialUserPassword } from '@/lib/auth/initial-password';
import {
  clearMustChangeInitialPasswordCookieOnResponse,
  setMustChangeInitialPasswordCookieOnResponse
} from '@/lib/auth/must-change-cookie';
import { normalizeEmail } from '@/lib/auth/normalize-email';
import { createClient } from '@/lib/supabase/server';

const signInSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해 주세요.')
    .email('올바른 이메일 주소를 입력해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signInSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const email = normalizeEmail(parsed.data.email);
    const supabase = await createClient();

    const { data: profileStatus, error: statusError } = await supabase.rpc(
      'profile_status_for_email',
      { p_email: email }
    );

    if (statusError) {
      return NextResponse.json(
        { success: false, message: AUTH_ERROR_MESSAGES.UNKNOWN },
        { status: 500 }
      );
    }

    if (profileStatus === 'inactive') {
      return NextResponse.json(
        { success: false, message: AUTH_ERROR_MESSAGES.ACCOUNT_DISABLED },
        { status: 403 }
      );
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password
    });

    if (signInError) {
      const message =
        signInError.message === 'Invalid login credentials'
          ? AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS
          : AUTH_ERROR_MESSAGES.UNKNOWN;
      return NextResponse.json({ success: false, message }, { status: 401 });
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: AUTH_ERROR_MESSAGES.UNKNOWN },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { success: false, message: AUTH_ERROR_MESSAGES.UNKNOWN },
        { status: 500 }
      );
    }

    if (!profile || profile.status === 'inactive') {
      await supabase.auth.signOut();
      return NextResponse.json(
        { success: false, message: AUTH_ERROR_MESSAGES.ACCOUNT_DISABLED },
        { status: 403 }
      );
    }

    const mustChange = isInitialUserPassword(parsed.data.password);
    const response = NextResponse.json({ success: true, mustChange });

    if (mustChange) {
      setMustChangeInitialPasswordCookieOnResponse(response);
    } else {
      clearMustChangeInitialPasswordCookieOnResponse(response);
    }

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: AUTH_ERROR_MESSAGES.UNKNOWN },
      { status: 500 }
    );
  }
}
