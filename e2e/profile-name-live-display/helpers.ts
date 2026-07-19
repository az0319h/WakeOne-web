import { createClient } from '@supabase/supabase-js';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  resolveUserIdByEmail,
  updateUserFullName
} from '../notifications/helpers';

export { resolveUserIdByEmail, updateUserFullName };

export type ActivityLogRow = {
  id: number;
  request_id: string;
  actor_user_id: string | null;
  actor_email: string;
  actor_display_name: string | null;
  actor_display_name_resolved?: string;
  action: string;
  target_user_id: string | null;
  target_label: string;
  target_label_resolved?: string;
  http_status: number;
  metadata?: { changed_fields?: string[] };
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

export async function fetchActivityLogs(
  request: APIRequestContext,
  query = ''
): Promise<ActivityLogRow[]> {
  const response = await request.get(`/api/activity-logs?limit=50${query}`);
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    success?: boolean;
    data?: { logs?: ActivityLogRow[] };
  };
  expect(body.success).toBe(true);
  return body.data?.logs ?? [];
}

export async function fetchUserFullNameByEmail(
  request: APIRequestContext,
  email: string
): Promise<string> {
  const response = await request.get(`/api/users?search=${encodeURIComponent(email)}&limit=5`);
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    users?: Array<{ email: string; full_name: string }>;
  };
  const user = body.users?.find((item) => item.email === email);
  expect(user?.full_name).toBeTruthy();
  return user!.full_name;
}

export async function gotoAdminActivityLogsAll(page: Page) {
  await page.goto('/dashboard/logs?log_user=all');
  await expect(page.getByTestId('activity-logs-page')).toBeVisible();
}

export async function gotoAdminUserUpdateLogsForUser(page: Page, userEmail: string) {
  await page.goto(
    `/dashboard/logs?log_user=all&action=user.update&search=${encodeURIComponent(userEmail)}`
  );
  await expect(page.getByTestId('activity-logs-page')).toBeVisible();
}

export async function expectActivityLogRowForUser(
  page: Page,
  userEmail: string,
  expectedText: string
) {
  const targetRow = activityLogRowsForUser(page, userEmail).first();
  await targetRow.scrollIntoViewIfNeeded();
  await expect(targetRow).toBeVisible({ timeout: 20_000 });
  await expect(targetRow).toContainText(expectedText);
  return targetRow;
}

export async function filterActivityLogsByUserUpdate(page: Page) {
  await page.getByRole('button', { name: '활동 유형' }).click();
  await page.getByRole('option', { name: '사용자 정보 수정', exact: true }).click();
  await expect(page).toHaveURL(/action=user\.update/, { timeout: 10_000 });
}

export function activityLogRowsForUser(page: Page, email: string) {
  return page
    .getByTestId('activity-log-row')
    .filter({ hasText: new RegExp(escapeRegExp(email)) });
}

export async function updateUserAvatar(
  request: APIRequestContext,
  userId: string,
  avatarUrl: string
) {
  const response = await request.put(`/api/users/${userId}`, {
    data: {
      avatar_url: avatarUrl,
      affiliation: 'wake',
      rank: '경영진'
    }
  });
  expect(response.status()).toBe(200);
  return response;
}

export async function createDisposableUser(
  request: APIRequestContext,
  prefix: string,
  fullName: string
) {
  const email = uniqueEmail(prefix);
  const response = await request.post('/api/users', {
    data: {
      email,
      full_name: fullName,
      affiliation: 'wake',
      rank: '경영진',
      system_role: 'user',
      birthday: '1990-01-01'
    }
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user_id?: string };
  expect(body.user_id).toBeTruthy();
  return { email, userId: body.user_id as string };
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(url, 'NEXT_PUBLIC_SUPABASE_URL is required').toBeTruthy();
  expect(serviceKey, 'SUPABASE_SERVICE_ROLE_KEY is required').toBeTruthy();

  return createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function deleteProfileRow(userId: string) {
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
  expect(error).toBeNull();
}
