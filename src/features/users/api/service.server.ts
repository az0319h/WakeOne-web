import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/features/auth/api/session.server';
import type { User, UserFilters, UsersResponse } from './types';

function parseCsvParam(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Server Component prefetch — uses Supabase session directly (no /api fetch). */
export async function getUsersServer(filters: UserFilters): Promise<UsersResponse> {
  const profile = await getSessionProfile();
  if (profile?.system_role !== 'admin') {
    throw new Error('관리자 권한이 필요합니다.');
  }

  const supabase = await createClient();
  const page = Number(filters.page ?? 1);
  const limit = Number(filters.limit ?? 10);
  const search = filters.search;
  const sortRaw = filters.sort;
  const systemRoles = parseCsvParam(filters.systemRoles);

  let query = supabase.from('profiles').select(
    `
        user_id,
        email,
        first_name,
        last_name,
        phone,
        system_role,
        password_set_at,
        created_at,
        updated_at
      `,
    { count: 'exact' }
  );

  if (systemRoles.length > 0) {
    query = query.in('system_role', systemRoles);
  }

  if (search) {
    const escaped = search.replaceAll(',', ' ');
    query = query.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%`
    );
  }

  let sortColumn = 'created_at';
  let sortDesc = true;
  if (sortRaw) {
    try {
      const sortItems = JSON.parse(sortRaw) as Array<{ id: string; desc: boolean }>;
      if (sortItems.length > 0) {
        const candidate = sortItems[0];
        const allowedColumns = [
          'first_name',
          'email',
          'system_role',
          'created_at',
          'password_set_at'
        ];
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
    throw new Error(error.message);
  }

  const users: User[] =
    data?.map((row) => ({
      id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      system_role: row.system_role,
      invite_status: row.password_set_at ? 'accepted' : 'pending',
      created_at: row.created_at,
      updated_at: row.updated_at
    })) ?? [];

  return {
    success: true,
    time: new Date().toISOString(),
    message: 'Users loaded successfully',
    total_users: count ?? 0,
    offset: from,
    limit,
    users
  };
}
