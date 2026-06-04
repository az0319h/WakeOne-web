import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/features/auth/api/admin.server';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

const updateUserSchema = z.object({
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  phone: z.string().max(50).nullable().optional(),
  system_role: z.enum(['admin', 'user']).optional()
});

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE environment variables for server admin operations');
  }

  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const adminCheck = await requireAdminSession();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
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

    const { error: profileError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', id);

    if (profileError) {
      return NextResponse.json({ success: false, message: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'User updated successfully' });
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
    const supabase = getServiceRoleClient();
    const { error } = await supabase.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
