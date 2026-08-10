import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  createAnnouncementOrThrow,
  deleteAnnouncementAttachmentViaApi,
  deleteAnnouncementViaApi,
  E2E_ATTACHMENT_MB,
  getActivityLogs,
  hasActivityLog,
  uniqueAnnouncementTitle,
  uploadAnnouncementAttachmentViaApi
} from './helpers';

const FIVE_MB = 5 * E2E_ATTACHMENT_MB;
const SIX_MB = 6 * E2E_ATTACHMENT_MB;
const ELEVEN_MB = 11 * E2E_ATTACHMENT_MB;

async function createEmptyAnnouncement(request: APIRequestContext) {
  const title = uniqueAnnouncementTitle('api');
  const announcement = await createAnnouncementOrThrow(request, {
    title,
    body: 'API attachment test',
    defer_notify: true
  });
  return announcement;
}

test.describe('공지사항 API', () => {
  test('AC-12: 11MB 단일 첨부 업로드는 400과 per-file 오류·실패 activity log를 반환한다', async ({
    request
  }) => {
    test.setTimeout(120_000);
    const announcement = await createEmptyAnnouncement(request);

    const response = await uploadAnnouncementAttachmentViaApi(
      request,
      announcement.id,
      'ac12-oversized.bin',
      ELEVEN_MB
    );

    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('파일당');
    expect(body.message).toContain('10MB');

    const logs = await getActivityLogs(request, 'announcement.attachment_upload');
    expect(
      hasActivityLog(logs, {
        action: 'announcement.attachment_upload',
        requestId,
        status: 400
      })
    ).toBe(true);
  });

  test('AC-13: 활성 첨부 총량 45MB 상태에서 6MB 추가 업로드는 400을 반환한다', async ({
    request
  }) => {
    test.setTimeout(300_000);
    const announcement = await createEmptyAnnouncement(request);

    for (let index = 0; index < 9; index += 1) {
      const uploadResponse = await uploadAnnouncementAttachmentViaApi(
        request,
        announcement.id,
        `ac13-seed-${index}.bin`,
        FIVE_MB
      );
      expect(uploadResponse.status()).toBe(201);
    }

    const response = await uploadAnnouncementAttachmentViaApi(
      request,
      announcement.id,
      'ac13-over-total.bin',
      SIX_MB
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('50MB');
  });

  test('AC-14: non-admin user B가 첨부 download API를 200으로 호출한다', async ({
    playwright
  }) => {
    const adminRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/admin.json'
    });
    const userRequest = await playwright.request.newContext({
      storageState: 'e2e/.auth/user.json'
    });

    const announcement = await createEmptyAnnouncement(adminRequest);
    const uploadResponse = await uploadAnnouncementAttachmentViaApi(
      adminRequest,
      announcement.id,
      'ac14-download.bin',
      1024
    );
    expect(uploadResponse.status()).toBe(201);
    const uploadBody = await uploadResponse.json();
    const attachmentId = uploadBody.attachment.id as number;

    const downloadResponse = await userRequest.get(
      `/api/announcements/${announcement.id}/attachments/${attachmentId}/download`
    );
    expect(downloadResponse.status()).toBe(200);
    expect(downloadResponse.headers()['content-disposition']).toContain(
      'ac14-download.bin'
    );

    await adminRequest.dispose();
    await userRequest.dispose();
  });

  test('AC-15: 공지 create 2xx 시 announcement.create activity log 1건이 생성된다', async ({
    request
  }) => {
    const response = await request.post('/api/announcements', {
      data: {
        title: uniqueAnnouncementTitle('ac15'),
        body: 'activity log create'
      }
    });
    expect(response.status()).toBe(201);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const logs = await getActivityLogs(request, 'announcement.create');
    expect(hasActivityLog(logs, { action: 'announcement.create', requestId })).toBe(true);
  });

  test('AC-16: 첨부 upload 2xx 시 announcement.attachment_upload activity log가 생성된다', async ({
    request
  }) => {
    const announcement = await createEmptyAnnouncement(request);
    const response = await uploadAnnouncementAttachmentViaApi(
      request,
      announcement.id,
      'ac16-upload.bin',
      1024
    );
    expect(response.status()).toBe(201);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const logs = await getActivityLogs(request, 'announcement.attachment_upload');
    expect(
      hasActivityLog(logs, { action: 'announcement.attachment_upload', requestId })
    ).toBe(true);
  });

  test('AC-17: 첨부 delete 2xx 시 announcement.attachment_delete activity log가 생성된다', async ({
    request
  }) => {
    const announcement = await createEmptyAnnouncement(request);
    const uploadResponse = await uploadAnnouncementAttachmentViaApi(
      request,
      announcement.id,
      'ac17-delete.bin',
      1024
    );
    expect(uploadResponse.status()).toBe(201);
    const attachmentId = (await uploadResponse.json()).attachment.id as number;

    const response = await deleteAnnouncementAttachmentViaApi(
      request,
      announcement.id,
      attachmentId
    );
    expect(response.status()).toBe(200);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const logs = await getActivityLogs(request, 'announcement.attachment_delete');
    expect(
      hasActivityLog(logs, { action: 'announcement.attachment_delete', requestId })
    ).toBe(true);
  });

  test('AC-18: 공지 delete 2xx 시 announcement.delete log와 Storage blob이 제거된다', async ({
    request
  }) => {
    const announcement = await createEmptyAnnouncement(request);
    const uploadResponse = await uploadAnnouncementAttachmentViaApi(
      request,
      announcement.id,
      'ac18-delete.bin',
      1024
    );
    expect(uploadResponse.status()).toBe(201);
    const attachmentId = (await uploadResponse.json()).attachment.id as number;

    const deleteResponse = await deleteAnnouncementViaApi(request, announcement.id);
    expect(deleteResponse.status()).toBe(200);
    const requestId = deleteResponse.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const detailResponse = await request.get(`/api/announcements/${announcement.id}`);
    expect(detailResponse.status()).toBe(404);

    const downloadResponse = await request.get(
      `/api/announcements/${announcement.id}/attachments/${attachmentId}/download`
    );
    expect(downloadResponse.status()).toBe(404);

    const logs = await getActivityLogs(request, 'announcement.delete');
    expect(hasActivityLog(logs, { action: 'announcement.delete', requestId })).toBe(true);
  });
});
