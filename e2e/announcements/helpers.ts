import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { markAllNotificationsReadAsUser } from '../notifications/helpers';

export const E2E_ANNOUNCEMENT_PREFIX = 'E2E-ANN-';
export const E2E_ATTACHMENT_MB = 1024 * 1024;

export function uniqueAnnouncementTitle(suffix: string) {
  return `${E2E_ANNOUNCEMENT_PREFIX}${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function buildAnnouncementUploadPayload(fileName: string, sizeBytes: number) {
  return {
    name: fileName,
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(sizeBytes, 0)
  };
}

type AnnouncementSummary = {
  id: number;
  title: string;
};

export async function createAnnouncementViaApi(
  request: APIRequestContext,
  input: {
    title: string;
    body?: string;
    priority?: 'normal' | 'important' | 'urgent';
    is_pinned?: boolean;
    defer_notify?: boolean;
  }
) {
  const response = await request.post('/api/announcements', {
    data: {
      body: input.body ?? `${input.title} 본문`,
      priority: input.priority ?? 'normal',
      is_pinned: input.is_pinned ?? false,
      defer_notify: input.defer_notify ?? false,
      title: input.title
    }
  });

  return response;
}

export async function createAnnouncementOrThrow(
  request: APIRequestContext,
  input: Parameters<typeof createAnnouncementViaApi>[1]
) {
  const response = await createAnnouncementViaApi(request, input);
  expect(response.status()).toBe(201);
  const body = (await response.json()) as {
    announcement: AnnouncementSummary;
  };
  return body.announcement;
}

export async function updateAnnouncementViaApi(
  request: APIRequestContext,
  id: number,
  payload: Record<string, unknown>
) {
  return request.put(`/api/announcements/${id}`, { data: payload });
}

export async function deleteAnnouncementViaApi(request: APIRequestContext, id: number) {
  return request.delete(`/api/announcements/${id}`);
}

export async function notifyAnnouncementViaApi(request: APIRequestContext, id: number) {
  return request.post(`/api/announcements/${id}/notify`);
}

export async function uploadAnnouncementAttachmentViaApi(
  request: APIRequestContext,
  announcementId: number,
  fileName: string,
  sizeBytes: number
) {
  return request.post(`/api/announcements/${announcementId}/attachments`, {
    multipart: {
      file: buildAnnouncementUploadPayload(fileName, sizeBytes)
    }
  });
}

export async function deleteAnnouncementAttachmentViaApi(
  request: APIRequestContext,
  announcementId: number,
  attachmentId: number
) {
  return request.delete(
    `/api/announcements/${announcementId}/attachments/${attachmentId}`
  );
}

export async function unpinAllE2eAnnouncements(request: APIRequestContext) {
  const listResponse = await request.get('/api/announcements?limit=50');
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    data?: { announcements?: Array<{ id: number; is_pinned: boolean; title: string }> };
  };

  const pinnedE2e =
    listBody.data?.announcements?.filter(
      (item) => item.is_pinned && item.title.startsWith(E2E_ANNOUNCEMENT_PREFIX)
    ) ?? [];

  for (const item of pinnedE2e) {
    const response = await request.put(`/api/announcements/${item.id}`, {
      data: { is_pinned: false }
    });
    expect(response.status()).toBe(200);
  }
}

export async function unpinAllAnnouncements(request: APIRequestContext) {
  const listResponse = await request.get('/api/announcements?limit=50');
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    data?: { announcements?: Array<{ id: number; is_pinned: boolean }> };
  };

  const pinned = listBody.data?.announcements?.filter((item) => item.is_pinned) ?? [];

  for (const item of pinned) {
    const response = await request.put(`/api/announcements/${item.id}`, {
      data: { is_pinned: false }
    });
    expect(response.status()).toBe(200);
  }
}

export async function seedAnnouncementsViaApi(
  request: APIRequestContext,
  count: number,
  titlePrefix = 'seed'
) {
  const created: AnnouncementSummary[] = [];

  for (let index = 0; index < count; index += 1) {
    const announcement = await createAnnouncementOrThrow(request, {
      title: uniqueAnnouncementTitle(`${titlePrefix}-${index}`),
      body: `seed body ${index}`
    });
    created.push(announcement);
  }

  return created;
}

export async function countUnreadNotifications(request: APIRequestContext) {
  const response = await request.get('/api/notifications?limit=50');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    data?: { notifications?: Array<{ status: string }> };
  };
  return (
    body.data?.notifications?.filter((item) => item.status === 'unread').length ?? 0
  );
}

export async function resetUserNotifications(userRequest: APIRequestContext) {
  await markAllNotificationsReadAsUser(userRequest);
}

export function announcementRows(page: Page) {
  return page.locator('[data-testid^="announcement-row-"]');
}

export async function openAnnouncementsNavLink(page: Page) {
  const link = page.getByRole('link', { name: '공지사항' });
  if (!(await link.isVisible())) {
    await page.locator('[data-sidebar="trigger"]').click();
  }
  await link.click();
}

export async function createAnnouncementViaUi(
  page: Page,
  input: { title: string; body: string; pin?: boolean }
) {
  await page.getByTestId('announcement-create-button').click();
  const dialog = page.getByTestId('announcement-form-dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('textbox', { name: '제목' }).fill(input.title);
  await dialog.getByRole('textbox', { name: '본문' }).fill(input.body);

  if (input.pin) {
    await dialog.getByRole('switch', { name: '상단 고정' }).click();
  }

  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('공지가 등록되었습니다.')).toBeVisible({
    timeout: 20_000
  });
}

export async function attachFileInFormDialog(
  page: Page,
  fileName: string,
  sizeBytes: number
) {
  const dialog = page.getByTestId('announcement-form-dialog');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: '파일 선택' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(buildAnnouncementUploadPayload(fileName, sizeBytes));
}

type ActivityLog = {
  request_id?: string;
  action?: string;
  http_status?: number;
};

export async function getActivityLogs(request: APIRequestContext, action: string) {
  const response = await request.get(
    `/api/activity-logs?action=${encodeURIComponent(action)}&limit=50`
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.success).toBe(true);
  return (body.data?.logs ?? []) as ActivityLog[];
}

export function hasActivityLog(
  logs: ActivityLog[],
  expected: { requestId?: string; action: string; status?: number }
) {
  return logs.some((item) => {
    if (item.action !== expected.action) {
      return false;
    }
    if (expected.status && item.http_status !== expected.status) {
      return false;
    }
    if (expected.requestId && item.request_id !== expected.requestId) {
      return false;
    }
    return true;
  });
}

export async function openAnnouncementRowMenu(page: Page, announcementId: number) {
  const row = page.getByTestId(`announcement-row-${announcementId}`);
  await row.getByRole('button', { name: '공지 작업 메뉴 열기' }).click();
}
