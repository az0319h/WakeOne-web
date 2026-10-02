import { expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { createPendingGoogleUser } from './supabase-direct-auth';

function loadEnvValue(key: string): string {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return process.env[key]?.trim() ?? '';
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && match[1] === key) {
      return match[2].trim();
    }
  }

  return process.env[key]?.trim() ?? '';
}

function getServiceRoleClient() {
  const url = loadEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = loadEnvValue('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Google pending notification E2E.');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export type PendingGoogleUser = {
  userId: string;
  email: string;
  password: string;
  displayName: string;
};

export async function createFreshPendingGoogleUser(prefix: string): Promise<PendingGoogleUser> {
  const pending = await createPendingGoogleUser(prefix);
  return {
    ...pending,
    displayName: 'E2E Pending'
  };
}

async function listActiveAdminUserIdsFromDb(): Promise<string[]> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from('profiles')
    .select('user_id, status, system_role')
    .eq('system_role', 'admin')
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to list active admins: ${error.message}`);
  }

  return (data ?? []).map((row) => row.user_id as string);
}

function buildApprovalRequestAdminBody(googleEmail: string, googleDisplayName: string | null) {
  const trimmedName = googleDisplayName?.trim();
  if (trimmedName) {
    return `${googleEmail} · ${trimmedName}`;
  }

  return googleEmail;
}

function isSuccessfulApprovalRequestLog(
  log: { target_user_id?: string | null; http_status?: number | string | null },
  targetUserId: string
): boolean {
  if (log.target_user_id !== targetUserId) {
    return false;
  }

  const status = Number(log.http_status);
  return Number.isFinite(status) && status >= 200 && status < 300;
}

export async function hasApprovalRequestSuccessLog(
  targetUserId: string,
  targetEmail?: string
): Promise<boolean> {
  const admin = getServiceRoleClient();
  let query = admin
    .from('activity_logs')
    .select('id, http_status, target_user_id')
    .eq('action', 'user.approval_request')
    .eq('target_user_id', targetUserId);

  if (targetEmail) {
    query = query.eq('target_label', targetEmail);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to query approval request logs: ${error.message}`);
  }

  return (data ?? []).some((row) => isSuccessfulApprovalRequestLog(row, targetUserId));
}

export async function hasApprovalRequestSuccessLogViaApi(
  request: APIRequestContext,
  targetUserId: string,
  targetEmail?: string
): Promise<boolean> {
  const searchParam = targetEmail ? `&search=${encodeURIComponent(targetEmail)}` : '';
  const response = await request.get(
    `/api/activity-logs?action=user.approval_request&limit=50&log_user=all${searchParam}`
  );
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    data?: { logs?: Array<{ target_user_id?: string; http_status?: number }> };
  };

  return (body.data?.logs ?? []).some((log) =>
    isSuccessfulApprovalRequestLog(log, targetUserId)
  );
}

async function hasApprovalRequestAdminNotification(targetUserId: string): Promise<boolean> {
  const admin = getServiceRoleClient();
  const { data, error } = await admin
    .from('notifications')
    .select('id, metadata')
    .eq('type', 'user.approval_request_admin');

  if (error) {
    throw new Error(`Failed to query approval request admin notifications: ${error.message}`);
  }

  return (data ?? []).some(
    (row) =>
      row.metadata &&
      typeof row.metadata === 'object' &&
      (row.metadata as { target_user_id?: string }).target_user_id === targetUserId
  );
}

type TriggerPendingApprovalOptions = {
  request?: APIRequestContext;
};

export async function triggerFirstPendingApprovalAdminNotifications(
  pending: PendingGoogleUser,
  options: TriggerPendingApprovalOptions = {}
): Promise<{ triggered: boolean; requestId?: string }> {
  const alreadyLogged =
    (options.request
      ? await hasApprovalRequestSuccessLogViaApi(
          options.request,
          pending.userId,
          pending.email
        )
      : await hasApprovalRequestSuccessLog(pending.userId, pending.email)) ||
    (await hasApprovalRequestAdminNotification(pending.userId));

  if (alreadyLogged) {
    return { triggered: false };
  }

  const admin = getServiceRoleClient();
  const requestId = crypto.randomUUID();
  const googleDisplayName = pending.displayName;

  const { error: logError } = await admin.from('activity_logs').insert({
    request_id: requestId,
    actor_user_id: pending.userId,
    actor_email: pending.email,
    actor_display_name: googleDisplayName,
    action: 'user.approval_request',
    target_type: 'user',
    target_user_id: pending.userId,
    target_label: pending.email,
    http_method: 'GET',
    http_path: '/api/auth/google/callback',
    http_status: 302,
    metadata: {
      google_email: pending.email,
      new_status: 'pending_approval',
      approval_source: 'google_oauth_e2e'
    }
  });

  if (logError) {
    throw new Error(`Failed to insert approval request activity log: ${logError.message}`);
  }

  const adminUserIds = await listActiveAdminUserIdsFromDb();
  if (adminUserIds.length === 0) {
    return { triggered: true, requestId };
  }

  const title = 'Google 가입 승인 요청';
  const body = buildApprovalRequestAdminBody(pending.email, googleDisplayName);
  const rows = adminUserIds.map((recipientUserId) => ({
    recipient_user_id: recipientUserId,
    type: 'user.approval_request_admin',
    title,
    body,
    metadata: {
      kind: 'user.approval_request_admin',
      target_user_id: pending.userId,
      google_email: pending.email,
      google_display_name: googleDisplayName
    }
  }));

  const { error: notifError } = await admin.from('notifications').insert(rows);
  if (notifError) {
    throw new Error(`Failed to insert approval request admin notifications: ${notifError.message}`);
  }

  return { triggered: true, requestId };
}

export async function listActiveAdminUserIds(request: APIRequestContext): Promise<string[]> {
  const response = await request.get('/api/users?systemRoles=admin&limit=50');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    users?: Array<{ id: string; status: string; system_role: string }>;
  };
  return (body.users ?? [])
    .filter((user) => user.status === 'active' && user.system_role === 'admin')
    .map((user) => user.id);
}

export type ApprovalRequestAdminNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  status: string;
  metadata?: Record<string, unknown>;
};

export async function listNotificationsForUser(
  request: APIRequestContext,
  userId?: string
): Promise<ApprovalRequestAdminNotification[]> {
  const query = userId ? `&notif_user=${encodeURIComponent(userId)}` : '';
  const response = await request.get(`/api/notifications?limit=50${query}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { notifications?: ApprovalRequestAdminNotification[] };
  };
  return body.data?.notifications ?? [];
}

export function filterApprovalRequestAdminNotifications(
  notifications: ApprovalRequestAdminNotification[],
  targetUserId: string
) {
  return notifications.filter(
    (item) =>
      item.type === 'user.approval_request_admin' &&
      item.metadata?.target_user_id === targetUserId
  );
}

export async function countApprovalRequestAdminNotificationsForAdmins(
  request: APIRequestContext,
  targetUserId: string
) {
  const adminIds = await listActiveAdminUserIds(request);
  let total = 0;

  for (const adminId of adminIds) {
    const notifications = await listNotificationsForUser(request, adminId);
    total += filterApprovalRequestAdminNotifications(notifications, targetUserId).length;
  }

  return { total, adminCount: adminIds.length };
}

export async function countUnreadNotifications(request: APIRequestContext) {
  const response = await request.get('/api/notifications?limit=50');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { notifications?: Array<{ status: string }> };
  };
  return (body.data?.notifications ?? []).filter((item) => item.status === 'unread').length;
}

export async function promoteUserToActiveAdmin(userId: string) {
  const admin = getServiceRoleClient();
  const { error } = await admin
    .from('profiles')
    .update({ system_role: 'admin', status: 'active' })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to promote user to admin: ${error.message}`);
  }
}

export async function deleteAuthUser(userId: string) {
  const admin = getServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }
}
