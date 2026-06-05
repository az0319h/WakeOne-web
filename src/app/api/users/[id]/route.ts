import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/admin.server';
import { adminBanUser, adminSignOutGlobal, adminUnbanUser } from '@/lib/auth/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import {
  AFFILIATIONS,
  validateOrganizationFields,
  type Affiliation
} from '@/features/users/constants/organization';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const DISALLOWED_PUT_FIELDS = ['first_name', 'last_name', 'phone', 'food_restrictions'] as const;

const updateUserSchema = z
  .object({
    avatar_url: z.string().url().max(2048).nullable().optional(),
    affiliation: z.enum(AFFILIATIONS).nullable().optional(),
    department: z.string().max(100).nullable().optional(),
    rank: z.string().max(50).nullable().optional(),
    job_title: z.string().max(50).nullable().optional(),
    system_role: z.enum(['admin', 'user']).optional()
  })
  .superRefine((data, ctx) => {
    validateOrganizationFields(data, ctx);
  });

const patchUserSchema = z.object({
  action: z.literal('reactivate')
});

export async function PUT(request: NextRequest, { params }: Params) {
  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const disallowedFields = DISALLOWED_PUT_FIELDS.filter((field) => field in body);
    if (disallowedFields.length > 0) {
      return NextResponse.json(
        { success: false, message: '해당 필드는 관리자가 수정할 수 없습니다.' },
        { status: 400 }
      );
    }

    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: '수정할 항목이 없습니다.' },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    const { data: target, error: fetchError } = await supabase
      .from('profiles')
      .select('status, affiliation, department, rank, job_title')
      .eq('user_id', id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ success: false, message: fetchError.message }, { status: 400 });
    }

    if (!target) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (target.status === 'inactive') {
      return NextResponse.json(
        { success: false, message: '비활성화된 사용자는 수정할 수 없습니다.' },
        { status: 400 }
      );
    }

    const effectiveAffiliation = (updates.affiliation ?? target.affiliation) as Affiliation | null;
    const effectiveDepartment =
      'department' in updates ? (updates.department as string | null) : target.department;
    const effectiveRank = 'rank' in updates ? (updates.rank as string | null) : target.rank;
    const effectiveJobTitle =
      'job_title' in updates ? (updates.job_title as string | null) : target.job_title;

    const mergedValidation = updateUserSchema.safeParse({
      affiliation: effectiveAffiliation,
      department: effectiveDepartment,
      rank: effectiveRank,
      job_title: effectiveJobTitle
    });

    if (!mergedValidation.success) {
      return NextResponse.json(
        { success: false, message: '소속에 맞지 않는 조직 정보입니다.' },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabase.from('profiles').update(updates).eq('user_id', id);

    if (profileError) {
      return NextResponse.json({ success: false, message: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    const { data: target, error: fetchError } = await supabase
      .from('profiles')
      .select('status')
      .eq('user_id', id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ success: false, message: fetchError.message }, { status: 400 });
    }

    if (!target) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (target.status === 'active') {
      return NextResponse.json(
        { success: false, message: '이미 활성화된 사용자입니다.' },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'active',
        deactivated_at: null
      })
      .eq('user_id', id);

    if (profileError) {
      return NextResponse.json({ success: false, message: profileError.message }, { status: 400 });
    }

    try {
      await adminUnbanUser(id);
    } catch (unbanError) {
      await supabase
        .from('profiles')
        .update({
          status: 'inactive',
          deactivated_at: new Date().toISOString()
        })
        .eq('user_id', id);

      const message =
        unbanError instanceof Error ? unbanError.message : '계정 활성화에 실패했습니다.';
      return NextResponse.json({ success: false, message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '사용자가 활성화되었습니다.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const { id } = await params;

    if (id === adminCheck.userId) {
      return NextResponse.json(
        { success: false, message: '본인 계정은 비활성화할 수 없습니다.' },
        { status: 400 }
      );
    }

    const supabase = getServiceRoleClient();

    const { data: target, error: fetchError } = await supabase
      .from('profiles')
      .select('status')
      .eq('user_id', id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ success: false, message: fetchError.message }, { status: 400 });
    }

    if (!target) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (target.status === 'inactive') {
      return NextResponse.json(
        { success: false, message: '이미 비활성화된 사용자입니다.' },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'inactive',
        deactivated_at: new Date().toISOString()
      })
      .eq('user_id', id);

    if (profileError) {
      return NextResponse.json({ success: false, message: profileError.message }, { status: 400 });
    }

    await adminSignOutGlobal(id);
    await adminBanUser(id);

    return NextResponse.json({ success: true, message: '사용자가 비활성화되었습니다.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
