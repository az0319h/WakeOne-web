import { expect, type APIRequestContext } from '@playwright/test';
import {
  buildImportPayload,
  importAuthHeaders
} from './contracts';
import { resolveUserIdByEmail, updateUserFullName } from '../notifications/helpers';

export { uniqueDocumentNumber } from './contracts';

export type ImportNotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string;
  status: string;
  metadata?: Record<string, unknown>;
};

export function expectImportHeaders() {
  const headers = importAuthHeaders();
  expect(headers, 'CONTRACT_IMPORT_TOKEN is required in .env').toBeTruthy();
  return headers!;
}

export async function listNotificationsForUser(
  request: APIRequestContext,
  userId?: string
): Promise<ImportNotificationItem[]> {
  const query = userId ? `&notif_user=${encodeURIComponent(userId)}` : '';
  const response = await request.get(`/api/notifications?limit=50${query}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { notifications?: ImportNotificationItem[] };
  };
  return body.data?.notifications ?? [];
}

export function filterImportNotifications(
  notifications: ImportNotificationItem[],
  type: string,
  documentNumber: string
) {
  return notifications.filter(
    (item) =>
      item.type === type && item.metadata?.document_number === documentNumber
  );
}

export async function listActiveAdminUserIds(
  request: APIRequestContext
): Promise<string[]> {
  const response = await request.get('/api/users?systemRoles=admin&limit=50');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    users?: Array<{ id: string; status: string; system_role: string }>;
  };
  return (body.users ?? [])
    .filter((user) => user.status === 'active' && user.system_role === 'admin')
    .map((user) => user.id);
}

export async function importContractForNotifications(
  request: APIRequestContext,
  options: {
    documentNumber: string;
    authorName?: string;
    approvedAt?: string;
  }
) {
  const response = await request.post('/api/contracts/import', {
    headers: expectImportHeaders(),
    data: buildImportPayload(options.documentNumber, {
      author_name: options.authorName ?? 'E2E 작성자',
      author_email: null,
      approved_at: options.approvedAt ?? '2026-07-02T09:00:00+09:00'
    })
  });

  return response;
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

export async function countImportNotificationsForAdmins(
  request: APIRequestContext,
  documentNumber: string,
  type: 'contract.import_admin' | 'contract.import_author' = 'contract.import_admin'
) {
  const adminIds = await listActiveAdminUserIds(request);
  let total = 0;

  for (const adminId of adminIds) {
    const notifications = await listNotificationsForUser(request, adminId);
    total += filterImportNotifications(notifications, type, documentNumber).length;
  }

  return { total, adminCount: adminIds.length };
}
