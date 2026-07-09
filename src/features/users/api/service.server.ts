import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/features/auth/api/session.server';
import type { User, UserFilters, UsersResponse } from './types';

const PROFILE_LIST_SELECT = `
        user_id,
        email,
        full_name,
        phone,
        birthday,
        system_role,
        password_set_at,
        status,
        avatar_url,
        affiliation,
        department,
        rank,
        job_title,
        food_restrictions,
        deactivated_at,
        created_at,
        updated_at
      `;

function parseCsvParam(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapProfileRow(row: {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  birthday: string | null;
  system_role: User['system_role'];
  password_set_at: string | null;
  status: User['status'];
  avatar_url: string | null;
  affiliation: User['affiliation'];
  department: string | null;
  rank: string | null;
  job_title: string | null;
  food_restrictions: string | null;
  created_at: string;
  updated_at: string;
}): User {
  return {
    id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    birthday: row.birthday,
    system_role: row.system_role,
    invite_status: row.password_set_at ? 'accepted' : 'pending',
    status: row.status,
    avatar_url: row.avatar_url,
    affiliation: row.affiliation,
    department: row.department,
    rank: row.rank,
    job_title: row.job_title,
    food_restrictions: row.food_restrictions,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function resolveSort(sortRaw: string | undefined) {
  let sortColumn = 'created_at';
  let sortDesc = true;

  if (sortRaw) {
    try {
      const sortItems = JSON.parse(sortRaw) as Array<{ id: string; desc: boolean }>;
      if (sortItems.length > 0) {
        const candidate = sortItems[0];
        const allowedColumns = [
          'full_name',
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

  return { sortColumn, sortDesc };
}

function applyUserListFilters<T extends { in: Function; or: Function }>(
  query: T,
  filters: Pick<UserFilters, 'search' | 'systemRoles'>
) {
  let next = query;
  const systemRoles = parseCsvParam(filters.systemRoles);

  if (systemRoles.length > 0) {
    next = next.in('system_role', systemRoles) as T;
  }

  if (filters.search) {
    const escaped = filters.search.replaceAll(',', ' ');
    next = next.or(
      `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`
    ) as T;
  }

  return next;
}

/** Admin users list — clamps page when URL page exceeds available data (avoids PostgREST range errors). */
export async function listUsersForAdmin(
  supabase: SupabaseClient,
  filters: UserFilters
): Promise<UsersResponse> {
  const page = Number(filters.page ?? 1);
  const limit = Number(filters.limit ?? 10);
  const { sortColumn, sortDesc } = resolveSort(filters.sort);

  const countQuery = applyUserListFilters(
    supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
    filters
  );

  const { count: totalCount, error: countError } = await countQuery;
  if (countError) {
    throw new Error(countError.message);
  }

  const total = totalCount ?? 0;
  const maxPage = total === 0 ? 1 : Math.ceil(total / limit);
  const safePage = Math.min(Math.max(1, page), maxPage);
  const from = (safePage - 1) * limit;
  const to = from + limit - 1;

  let dataQuery = applyUserListFilters(
    supabase.from('profiles').select(PROFILE_LIST_SELECT, { count: 'exact' }),
    filters
  );

  const { data, error } = await dataQuery
    .order(sortColumn, { ascending: !sortDesc })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const users = data?.map((row) => mapProfileRow(row)) ?? [];

  return {
    success: true,
    time: new Date().toISOString(),
    message: 'Users loaded successfully',
    total_users: total,
    offset: from,
    limit,
    users
  };
}

/** Server Component prefetch — uses Supabase session directly (no /api fetch). */
export async function getUsersServer(filters: UserFilters): Promise<UsersResponse> {
  const profile = await getSessionProfile();
  if (profile?.system_role !== 'admin') {
    throw new Error('관리자 권한이 필요합니다.');
  }

  const supabase = await createClient();
  return listUsersForAdmin(supabase, filters);
}
