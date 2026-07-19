import { expect, type APIRequestContext } from '@playwright/test';
import { cleanupE2eMockData } from './cleanup';
import {
  buildImportPayload,
  importAuthHeaders,
  uniqueDocumentNumber
} from './contracts';
import { uniqueRunKey } from './reminders';
import { resolveUserIdByEmail, updateUserFullName } from '../notifications/helpers';

export { uniqueDocumentNumber } from './contracts';

export type ReminderRunResponse = {
  success: boolean;
  run: { id: number; run_key: string } | null;
  recipients: Array<{ status: string; recipient_email: string }>;
  unmatched_targets: Array<{ author_name: string; document_numbers: string[]; reason: string }>;
};

export type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  status: string;
  metadata?: Record<string, unknown>;
};

export type ActivityLogItem = {
  request_id?: string;
  action?: string;
  http_status?: number;
  metadata?: Record<string, unknown>;
};

export function expectImportHeaders() {
  const headers = importAuthHeaders();
  expect(headers, 'CONTRACT_IMPORT_TOKEN is required in .env').toBeTruthy();
  return headers!;
}

export async function importMissingContract(
  request: APIRequestContext,
  documentNumber: string,
  authorName: string
) {
  const response = await request.post('/api/contracts/import', {
    headers: expectImportHeaders(),
    data: buildImportPayload(documentNumber, {
      author_name: authorName,
      author_email: null
    })
  });
  expect(response.status()).toBe(201);
}

export async function postReminders(request: APIRequestContext, runKey: string) {
  return request.post('/api/contracts/reminders', {
    data: { run_key: runKey },
    timeout: 120_000
  });
}

export async function ensureUserAuthorName(
  request: APIRequestContext,
  email: string,
  authorName: string
) {
  const userId = await resolveUserIdByEmail(request, email);
  await updateUserFullName(request, userId, authorName);
  return userId;
}

export async function listNotifications(
  request: APIRequestContext,
  query = ''
): Promise<NotificationItem[]> {
  const response = await request.get(`/api/notifications?limit=50${query}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { notifications?: NotificationItem[] };
  };
  return body.data?.notifications ?? [];
}

export async function countNotificationsByType(
  request: APIRequestContext,
  type: string,
  query = ''
): Promise<number> {
  const notifications = await listNotifications(request, query);
  return notifications.filter((item) => item.type === type).length;
}

export async function listActivityLogs(
  request: APIRequestContext,
  action: string,
  options: { limit?: number; search?: string; logUser?: 'all' | 'self' } = {}
): Promise<ActivityLogItem[]> {
  const params = new URLSearchParams({
    action,
    limit: String(options.limit ?? 100),
    log_user: options.logUser ?? 'all'
  });
  if (options.search) {
    params.set('search', options.search);
  }

  const response = await request.get(`/api/activity-logs?${params.toString()}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { logs?: ActivityLogItem[] };
  };
  return body.data?.logs ?? [];
}

export { cleanupE2eMockData } from './cleanup';

export async function countAdminNotificationsForRun(
  request: APIRequestContext,
  runKey: string
) {
  const notifications = await listNotifications(request);
  return notifications.filter(
    (item) =>
      item.type === 'contract.reminder_admin' && item.metadata?.run_key === runKey
  ).length;
}

export async function countRecipientNotificationsForRun(
  request: APIRequestContext,
  runId: number,
  userId: string
) {
  const notifications = await listNotifications(
    request,
    `&notif_user=${encodeURIComponent(userId)}`
  );
  return notifications.filter(
    (item) =>
      item.type === 'contract.reminder_recipient' && item.metadata?.run_id === runId
  ).length;
}

export async function expectActivityLog(
  request: APIRequestContext,
  action: string,
  requestId: string,
  status: number,
  options: { search?: string } = {}
) {
  await expect
    .poll(
      async () => {
        const logs = await listActivityLogs(request, action, {
          search: options.search,
          limit: 100
        });
        return logs.some(
          (item) =>
            item.request_id === requestId &&
            item.action === action &&
            item.http_status === status
        );
      },
      { timeout: 30_000 }
    )
    .toBe(true);
}

export async function runMatchedReminder(
  request: APIRequestContext,
  options: {
    prefix: string;
    authorName: string;
    userEmail: string;
  }
) {
  const runKey = uniqueRunKey(options.prefix);
  await ensureUserAuthorName(request, options.userEmail, options.authorName);
  const documentNumber = uniqueDocumentNumber(options.prefix);
  await importMissingContract(request, documentNumber, options.authorName);

  const response = await postReminders(request, runKey);
  expect(response.status()).toBe(200);

  return {
    runKey,
    response,
    body: (await response.json()) as ReminderRunResponse,
    documentNumber
  };
}
