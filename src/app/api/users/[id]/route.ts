import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, message: 'Missing SUPABASE env vars' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
        system_role: body.system_role
      })
      .eq('user_id', id);

    if (profileError) {
      return NextResponse.json({ success: false, message: profileError.message }, { status: 400 });
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('code', body.organization)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ success: false, message: 'Organization not found' }, { status: 400 });
    }

    const { error: membershipError } = await supabase
      .from('organization_memberships')
      .upsert(
        {
          user_id: id,
          organization_id: org.id,
          department: body.department,
          org_role: body.org_role,
          invite_status: body.invite_status,
          is_primary: body.organization === 'wake'
        },
        { onConflict: 'user_id,organization_id,department' }
      );

    if (membershipError) {
      return NextResponse.json(
        { success: false, message: membershipError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, message: 'Missing SUPABASE env vars' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

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
