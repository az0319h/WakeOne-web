import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSessionProfile } from '@/features/auth/api/session.server';
import {
  normalizeLeaderRole,
  resolveRankFromPositionLevel,
  type Affiliation
} from '@/features/users/constants/organization';
import type { ApproveUserFormValues } from '@/features/users/schemas/user';
import { normalizeEmail } from '@/lib/auth/normalize-email';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { ProfileStatus, User, UserFilters, UsersResponse } from './types';

const EMAIL_CONFLICT_MESSAGES: Record<ProfileStatus, string> = {
  pending_approval: '승인 대기 중인 이메일입니다. 사용자 목록에서 수락해 주세요.',
  active: '이미 등록된 이메일입니다.',
  rejected: '거절된 계정입니다. 사용자 추가로 재등록할 수 없습니다.',
  inactive: '비활성화된 계정입니다. 활성화 후 이용해 주세요.'
};

export type CreateUserForAdminResult =
  | {
      ok: true;
      userId: string;
      email: string;
      birthdaySet: boolean;
      changedFields: string[];
      isAdminTarget: boolean;
    }
  | {
      ok: false;
      kind: 'conflict';
      status: ProfileStatus;
      message: string;
      existingUserId: string;
    }
  | {
      ok: false;
      kind: 'auth_error';
      message: string;
    }
  | {
      ok: false;
      kind: 'profile_error';
      message: string;
      userId?: string;
    };

async function findProfileByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ user_id: string; status: ProfileStatus; email: string } | null> {
  const normalized = normalizeEmail(email);
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, status, email')
    .or(`email.ilike.${normalized},google_email.ilike.${normalized}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** Dev-only admin pre-provision: email-only auth user + active profile (plan 70). */
export async function createUserForAdmin(
  input: ApproveUserFormValues,
  adminUserId: string
): Promise<CreateUserForAdminResult> {
  const supabase = getServiceRoleClient();
  const payload = {
    ...input,
    email: normalizeEmail(input.email)
  };

  const existing = await findProfileByEmail(supabase, payload.email);
  if (existing) {
    return {
      ok: false,
      kind: 'conflict',
      status: existing.status,
      message: EMAIL_CONFLICT_MESSAGES[existing.status],
      existingUserId: existing.user_id
    };
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: payload.email,
    email_confirm: true
  });

  if (authError || !authData.user) {
    const message = authError?.message ?? 'Auth user creation failed';
    if (/already registered|already exists|duplicate/i.test(message)) {
      const duplicate = await findProfileByEmail(supabase, payload.email);
      if (duplicate) {
        return {
          ok: false,
          kind: 'conflict',
          status: duplicate.status,
          message: EMAIL_CONFLICT_MESSAGES[duplicate.status],
          existingUserId: duplicate.user_id
        };
      }
    }

    return {
      ok: false,
      kind: 'auth_error',
      message
    };
  }

  const userId = authData.user.id;
  const isAdminTarget = payload.system_role === 'admin';

  const userRank = !isAdminTarget
    ? resolveRankFromPositionLevel(payload.position_level!) ?? payload.rank!
    : null;

  const profileUpdate = isAdminTarget
    ? {
        email: payload.email,
        full_name: payload.full_name,
        affiliation: null,
        rank: null,
        position_level: null,
        leader_role: null,
        system_role: 'admin' as const,
        birthday: null,
        phone: payload.phone,
        status: 'active' as const,
        deactivated_at: null,
        approved_at: new Date().toISOString(),
        approved_by: adminUserId,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
        approval_requested_at: null
      }
    : {
        email: payload.email,
        full_name: payload.full_name,
        affiliation: payload.affiliation as Affiliation,
        rank: userRank,
        position_level: payload.position_level!,
        leader_role: normalizeLeaderRole(payload.leader_role),
        system_role: 'user' as const,
        birthday: payload.birthday ?? null,
        phone: payload.phone,
        status: 'active' as const,
        deactivated_at: null,
        approved_at: new Date().toISOString(),
        approved_by: adminUserId,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
        approval_requested_at: null
      };

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('user_id', userId);

  if (profileError) {
    return {
      ok: false,
      kind: 'profile_error',
      message: profileError.message,
      userId
    };
  }

  const changedFields = isAdminTarget
    ? ['email', 'full_name', 'system_role', 'phone', 'status']
    : [
        'email',
        'full_name',
        'affiliation',
        'rank',
        'position_level',
        'leader_role',
        'system_role',
        'birthday',
        'phone',
        'status'
      ];

  return {
    ok: true,
    userId,
    email: payload.email,
    birthdaySet: !isAdminTarget && payload.birthday != null,
    changedFields,
    isAdminTarget
  };
}

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
        rank,
        position_level,
        leader_role,
        deactivated_at,
        google_email,
        google_display_name,
        approval_requested_at,
        approved_at,
        approved_by,
        rejected_at,
        rejected_by,
        rejection_reason,
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
  rank: string | null;
  position_level: string | null;
  leader_role: User['leader_role'];
  google_email: string | null;
  google_display_name: string | null;
  approval_requested_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
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
    invite_status: row.status === 'active' ? 'accepted' : 'pending',
    status: row.status,
    avatar_url: row.avatar_url,
    affiliation: row.affiliation,
    rank: row.rank,
    position_level: row.position_level,
    leader_role: row.leader_role,
    google_email: row.google_email,
    google_display_name: row.google_display_name,
    approval_requested_at: row.approval_requested_at,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    rejected_at: row.rejected_at,
    rejected_by: row.rejected_by,
    rejection_reason: row.rejection_reason,
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
        const sortColumnById: Record<string, string> = {
          name: 'full_name',
          full_name: 'full_name',
          email: 'email',
          system_role: 'system_role',
          affiliation: 'affiliation',
          created_at: 'created_at',
          password_set_at: 'password_set_at'
        };
        const resolvedColumn = sortColumnById[candidate.id];
        if (resolvedColumn) {
          sortColumn = resolvedColumn;
          sortDesc = candidate.desc === true;
        }
      }
    } catch {
      // ignore invalid sort payload
    }
  }

  return { sortColumn, sortDesc };
}

function applyUserListFilters<T extends { in: Function; or: Function; eq: Function }>(
  query: T,
  filters: Pick<UserFilters, 'search' | 'systemRoles' | 'statuses' | 'userId'>
) {
  let next = query;
  const systemRoles = parseCsvParam(filters.systemRoles);
  const statuses = parseCsvParam(filters.statuses);

  if (systemRoles.length > 0) {
    next = next.in('system_role', systemRoles) as T;
  }

  if (statuses.length > 0) {
    next = next.in('status', statuses) as T;
  }

  if (filters.userId) {
    next = next.eq('user_id', filters.userId) as T;
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
