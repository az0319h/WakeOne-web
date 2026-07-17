import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type { Notification, NotificationsFilters, NotificationsListResponse } from './types';

export type NotificationRecord = Notification & {
  recipient_user_id: string;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

type NotificationCursor = {
  created_at: string;
  id: number;
};

function mapRow(row: Record<string, unknown>): NotificationRecord {
  return {
    id: row.id as number,
    recipient_user_id: row.recipient_user_id as string,
    type: row.type as Notification['type'],
    title: row.title as string,
    body: row.body as string,
    status: row.status as Notification['status'],
    created_at: row.created_at as string,
    read_at: (row.read_at as string | null) ?? null,
    metadata: (row.metadata as Notification['metadata']) ?? {}
  };
}

export function encodeNotificationCursor(cursor: NotificationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeNotificationCursor(cursor: string): NotificationCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    ) as Partial<NotificationCursor>;

    if (typeof parsed.created_at === 'string' && typeof parsed.id === 'number') {
      return { created_at: parsed.created_at, id: parsed.id };
    }

    return null;
  } catch {
    return null;
  }
}

function resolveRecipientUserId(
  sessionUserId: string,
  isAdmin: boolean,
  notifUser?: string
): string {
  if (!isAdmin) {
    return sessionUserId;
  }

  const scope = notifUser ?? 'self';
  return scope === 'self' ? sessionUserId : scope;
}

export async function listNotifications(
  sessionUserId: string,
  isAdmin: boolean,
  filters: NotificationsFilters = {}
): Promise<NotificationsListResponse> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const recipientUserId = resolveRecipientUserId(
    sessionUserId,
    isAdmin,
    filters.notif_user
  );

  const supabase = await createClient();
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_user_id', recipientUserId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (filters.cursor) {
    const decoded = decodeNotificationCursor(filters.cursor);
    if (decoded) {
      query = query.or(
        `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const notifications = page.map(
    ({ recipient_user_id: _recipient, ...notification }) => notification
  );
  const last = page.at(-1);

  return {
    notifications,
    nextCursor: hasMore && last ? encodeNotificationCursor({
      created_at: last.created_at,
      id: last.id
    }) : null,
    hasMore
  };
}

export async function getNotificationById(
  notificationId: number
): Promise<NotificationRecord | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', notificationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function markNotificationRead(
  notificationId: number,
  recipientUserId: string
): Promise<NotificationRecord | null> {
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('notifications')
    .update({
      status: 'read',
      read_at: now
    })
    .eq('id', notificationId)
    .eq('recipient_user_id', recipientUserId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function markAllNotificationsRead(
  recipientUserId: string
): Promise<number> {
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('notifications')
    .update({
      status: 'read',
      read_at: now
    })
    .eq('recipient_user_id', recipientUserId)
    .eq('status', 'unread')
    .select('id');

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}
