import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminSignOutGlobal } from '@/lib/auth/admin-auth';
import { changePasswordSchema } from '@/features/auth/schemas/password';
import { requireSession } from '@/features/auth/api/session.server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const GENERIC_ERROR = '비밀번호 변경에 실패했습니다.';

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!session.ok) {
      return session.response;
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, status')
      .eq('user_id', session.userId)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return NextResponse.json({ success: false, message: GENERIC_ERROR }, { status: 400 });
    }

    const { getSupabasePublishableKey, getSupabaseUrl } = await import('@/lib/supabase/env');

    let supabaseUrl: string;
    let publishableKey: string;

    try {
      supabaseUrl = getSupabaseUrl();
      publishableKey = getSupabasePublishableKey();
    } catch {
      return NextResponse.json({ success: false, message: GENERIC_ERROR }, { status: 500 });
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
      return NextResponse.json({ success: false, message: GENERIC_ERROR }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
      current_password: parsed.data.current_password
    });

    if (updateError) {
      return NextResponse.json({ success: false, message: GENERIC_ERROR }, { status: 400 });
    }

    await adminSignOutGlobal(session.userId);

    return NextResponse.json({
      success: true,
      message: '비밀번호가 변경되었습니다. 다시 로그인해 주세요.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
