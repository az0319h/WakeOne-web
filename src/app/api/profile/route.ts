import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const patchProfileSchema = z.object({
  first_name: z.string().max(100),
  last_name: z.string().max(100),
  phone: z.string().max(50).nullable().optional()
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = patchProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const { first_name, last_name, phone } = parsed.data;

    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name,
        last_name,
        phone: phone ?? null
      })
      .eq('user_id', user.id)
      .select('user_id, email, first_name, last_name, phone, system_role, password_set_at')
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '프로필이 저장되었습니다.',
      profile: data
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
