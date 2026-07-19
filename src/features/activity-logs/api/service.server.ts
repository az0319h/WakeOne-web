import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { ActivityLog, ActivityLogsFilters, ActivityLogsListResponse } from './types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string;
};

function parseSort(sortRaw: string | undefined): { column: string; desc: boolean } {
  let column = 'created_at';
  let desc = true;

  if (!sortRaw) {
    return { column, desc };
  }

  try {
    const sortItems = JSON.parse(sortRaw) as Array<{ id: string; desc: boolean }>;
    if (sortItems.length > 0) {
      const candidate = sortItems[0];
      const allowedColumns = ['created_at', 'http_status', 'action'];
      if (allowedColumns.includes(candidate.id)) {
        column = candidate.id;
        desc = candidate.desc;
      }
    }
  } catch {
    // ignore invalid sort payload
  }

  return { column, desc };
}

function mapRow(row: Record<string, unknown>): ActivityLog {
  return {
    id: row.id as number,
    request_id: row.request_id as string,
    actor_user_id: (row.actor_user_id as string | null) ?? null,
    actor_email: row.actor_email as string,
    actor_display_name: (row.actor_display_name as string | null) ?? null,
    action: row.action as ActivityLog['action'],
    target_type: row.target_type as ActivityLog['target_type'],
    target_user_id: (row.target_user_id as string | null) ?? null,
    target_label: row.target_label as string,
    http_method: row.http_method as string,
    http_path: row.http_path as string,
    http_status: row.http_status as number,
    metadata: (row.metadata as ActivityLog['metadata']) ?? {},
    created_at: row.created_at as string
  };
}

function formatUserTargetLabel(profile: Pick<ProfileRow, 'full_name' | 'email'>): string {
  const name = profile.full_name?.trim() ?? '';
  if (name) {
    return `${name} (${profile.email})`;
  }
  return profile.email;
}

function resolveActorDisplayName(log: ActivityLog, profiles: Map<string, ProfileRow>): string {
  if (log.actor_user_id) {
    const profile = profiles.get(log.actor_user_id);
    const liveName = profile?.full_name?.trim() ?? '';
    if (liveName) {
      return liveName;
    }
  }

  if (log.actor_display_name?.trim()) {
    return log.actor_display_name.trim();
  }

  return log.actor_email;
}

function resolveUserTargetLabel(log: ActivityLog, profiles: Map<string, ProfileRow>): string {
  if (log.target_user_id) {
    const profile = profiles.get(log.target_user_id);
    if (profile) {
      return formatUserTargetLabel(profile);
    }
  }

  if (log.target_label?.trim()) {
    return log.target_label;
  }

  return log.target_user_id ?? '';
}

function resolveTargetLabel(log: ActivityLog, profiles: Map<string, ProfileRow>): string {
  if (log.target_type === 'user' && log.target_user_id) {
    return resolveUserTargetLabel(log, profiles);
  }

  return log.target_label;
}

async function fetchProfilesByUserIds(userIds: string[]): Promise<Map<string, ProfileRow>> {
  if (userIds.length === 0) {
    return new Map();
  }

  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', userIds);

    if (error) {
      console.error('[activity-logs] profile batch fetch failed:', error.message);
      return new Map();
    }

    return new Map((data ?? []).map((row) => [row.user_id, row as ProfileRow]));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[activity-logs] profile batch fetch failed:', message);
    return new Map();
  }
}

async function findUserIdsByFullNameSearch(search: string): Promise<string[]> {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('full_name', `%${search}%`);

    if (error) {
      console.error('[activity-logs] profile search failed:', error.message);
      return [];
    }

    return (data ?? []).map((row) => row.user_id as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[activity-logs] profile search failed:', message);
    return [];
  }
}

export function enrichActivityLogsWithLiveNames(
  logs: ActivityLog[],
  profiles: Map<string, ProfileRow>
): ActivityLog[] {
  return logs.map((log) => ({
    ...log,
    actor_display_name_resolved: resolveActorDisplayName(log, profiles),
    target_label_resolved: resolveTargetLabel(log, profiles)
  }));
}

function collectProfileUserIds(logs: ActivityLog[]): string[] {
  const userIds = new Set<string>();

  for (const log of logs) {
    if (log.actor_user_id) {
      userIds.add(log.actor_user_id);
    }

    if (log.target_type === 'user' && log.target_user_id) {
      userIds.add(log.target_user_id);
    }
  }

  return [...userIds];
}

export async function listActivityLogs(
  userId: string,
  isAdmin: boolean,
  filters: ActivityLogsFilters = {}
): Promise<ActivityLogsListResponse> {
  const page = filters.page ?? DEFAULT_PAGE;
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const { column, desc } = parseSort(filters.sort);

  const supabase = await createClient();
  let query = supabase.from('activity_logs').select('*', { count: 'exact' });

  if (!isAdmin) {
    query = query.or(`actor_user_id.eq.${userId},target_user_id.eq.${userId}`);
  } else {
    const logUser = filters.log_user ?? 'self';

    if (logUser !== 'all') {
      const scopeUserId = logUser === 'self' ? userId : logUser;
      query = query.or(
        `actor_user_id.eq.${scopeUserId},target_user_id.eq.${scopeUserId}`
      );
    }

    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    if (filters.search) {
      const escaped = filters.search.replaceAll(',', ' ');
      const matchingUserIds = await findUserIdsByFullNameSearch(escaped);

      if (matchingUserIds.length > 0) {
        query = query.or(
          `target_label.ilike.%${escaped}%,target_user_id.in.(${matchingUserIds.join(',')})`
        );
      } else {
        query = query.ilike('target_label', `%${escaped}%`);
      }
    }
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query
    .order(column, { ascending: !desc })
    .range(from, to);

  if (error) {
    throw error;
  }

  const logs = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  const profiles = await fetchProfilesByUserIds(collectProfileUserIds(logs));

  return {
    logs: enrichActivityLogsWithLiveNames(logs, profiles),
    total: count ?? 0,
    page,
    limit
  };
}
