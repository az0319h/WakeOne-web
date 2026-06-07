import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { ActivityLog, ActivityLogsFilters, ActivityLogsListResponse } from './types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

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
    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    if (filters.actor_search) {
      const escaped = filters.actor_search.replaceAll(',', ' ');
      query = query.or(
        `actor_email.ilike.%${escaped}%,actor_display_name.ilike.%${escaped}%`
      );
    }

    if (filters.search) {
      const escaped = filters.search.replaceAll(',', ' ');
      query = query.ilike('target_label', `%${escaped}%`);
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

  return {
    logs: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    total: count ?? 0,
    page,
    limit
  };
}
