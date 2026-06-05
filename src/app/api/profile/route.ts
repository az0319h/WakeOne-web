import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/features/auth/api/session.server';
import { createClient } from '@/lib/supabase/server';

const PROFILE_SELECT_COLUMNS =
  'user_id, email, first_name, last_name, phone, system_role, password_set_at, status, avatar_url, affiliation, department, rank, job_title, food_restrictions';

const ADMIN_ONLY_PATCH_FIELDS = [
  'avatar_url',
  'affiliation',
  'department',
  'rank',
  'job_title',
  'system_role'
] as const;

const patchProfileSchema = z.object({
  first_name: z.string().max(100),
  last_name: z.string().max(100),
  phone: z.string().max(50).nullable().optional(),
  food_restrictions: z.string().max(200).nullable().optional()
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!session.ok) {
      return session.response;
    }

    const body = await request.json();

    const forbiddenFields = ADMIN_ONLY_PATCH_FIELDS.filter((field) => field in body);
    if (forbiddenFields.length > 0) {
      return NextResponse.json(
        { success: false, message: '해당 필드는 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    const parsed = patchProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const { first_name, last_name, phone, food_restrictions } = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name,
        last_name,
        phone: phone ?? null,
        food_restrictions: food_restrictions ?? null
      })
      .eq('user_id', session.userId)
      .select(PROFILE_SELECT_COLUMNS)
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
