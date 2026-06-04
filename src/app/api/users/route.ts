import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@/features/users/api/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE environment variables for server admin operations');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const supabase = getAdminClient();

    const page = Number(searchParams.get('page') ?? 1);
    const limit = Number(searchParams.get('limit') ?? 10);
    const search = searchParams.get('search');
    const sortRaw = searchParams.get('sort');

    const systemRoles = parseCsvParam(searchParams.get('systemRoles'));
    const organizations = parseCsvParam(searchParams.get('organizations'));
    const departments = parseCsvParam(searchParams.get('departments'));
    const orgRoles = parseCsvParam(searchParams.get('orgRoles'));

    let query = supabase
      .from('profiles')
      .select(
        `
        user_id,
        email,
        first_name,
        last_name,
        phone,
        system_role,
        created_at,
        updated_at,
        organization_memberships!left(
          organization_id,
          department,
          org_role,
          invite_status,
          is_primary,
          organizations!left(code)
        )
      `,
        { count: 'exact' }
      )
      .eq('organization_memberships.is_primary', true);

    if (systemRoles.length > 0) {
      query = query.in('system_role', systemRoles);
    }

    if (organizations.length > 0) {
      query = query.in('organization_memberships.organizations.code', organizations);
    }

    if (departments.length > 0) {
      query = query.in('organization_memberships.department', departments);
    }

    if (orgRoles.length > 0) {
      query = query.in('organization_memberships.org_role', orgRoles);
    }

    if (search) {
      const escaped = search.replaceAll(',', ' ');
      query = query.or(
        `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,organization_memberships.department.ilike.%${escaped}%`
      );
    }

    let sortColumn = 'created_at';
    let sortDesc = true;
    if (sortRaw) {
      try {
        const sortItems = JSON.parse(sortRaw) as Array<{ id: string; desc: boolean }>;
        if (sortItems.length > 0) {
          const candidate = sortItems[0];
          const allowedColumns = ['first_name', 'email', 'system_role', 'created_at'];
          if (allowedColumns.includes(candidate.id)) {
            sortColumn = candidate.id;
            sortDesc = candidate.desc;
          }
        }
      } catch {
        // ignore invalid sort payload
      }
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .order(sortColumn, { ascending: !sortDesc })
      .range(from, to);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const users: User[] =
      data?.map((row) => {
        const memberships = Array.isArray(row.organization_memberships)
          ? row.organization_memberships
          : row.organization_memberships
            ? [row.organization_memberships]
            : [];
        const primaryMembership = memberships[0];
        const organizationEntity = Array.isArray(primaryMembership?.organizations)
          ? primaryMembership.organizations[0]
          : primaryMembership?.organizations ?? null;
        const organizationCode = organizationEntity?.code ?? null;

        return {
          id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          system_role: row.system_role,
          organization: organizationCode,
          department: primaryMembership?.department ?? null,
          org_role: primaryMembership?.org_role ?? null,
          invite_status: primaryMembership?.invite_status ?? null,
          created_at: row.created_at,
          updated_at: row.updated_at
        } satisfies User;
      }) ?? [];

    return NextResponse.json({
      success: true,
      time: new Date().toISOString(),
      message: 'Users loaded successfully',
      total_users: count ?? 0,
      offset: from,
      limit,
      users
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing SUPABASE env vars'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const functionUrl = `${supabaseUrl}/functions/v1/invite-user`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: result.error ?? 'Failed to invite user' },
        { status: response.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message ?? 'Invite sent successfully',
        user_id: result.user_id
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
