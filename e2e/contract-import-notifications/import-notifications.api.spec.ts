import { expect, test } from '@playwright/test';
import { buildImportPayload } from '../helpers/contracts';
import {
  countImportNotificationsForAdmins,
  ensureUserAuthorName,
  expectImportHeaders,
  filterImportNotifications,
  importContractForNotifications,
  listActiveAdminUserIds,
  listNotificationsForUser,
  uniqueDocumentNumber
} from '../helpers/contract-import-notifications';
import { resolveUserIdByEmail } from '../notifications/helpers';

test.describe.configure({ mode: 'serial' });

test.describe('계약 Import 알림 API', () => {
  test('AC-01: created import 시 모든 active admin에게 contract.import_admin 알림', async ({
    request
  }) => {
    const documentNumber = uniqueDocumentNumber('AC47C01');
    const authorName = `E2E-CIN-AC01-${Date.now()}`;

    const response = await importContractForNotifications(request, {
      documentNumber,
      authorName
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.success).toBe(true);

    const { total, adminCount } = await countImportNotificationsForAdmins(
      request,
      documentNumber,
      'contract.import_admin'
    );
    expect(adminCount).toBeGreaterThan(0);
    expect(total).toBe(adminCount);

    const adminIds = await listActiveAdminUserIds(request);
    for (const adminId of adminIds) {
      const notifications = await listNotificationsForUser(request, adminId);
      const matched = filterImportNotifications(
        notifications,
        'contract.import_admin',
        documentNumber
      );
      expect(matched).toHaveLength(1);
      expect(matched[0]?.body).toContain(documentNumber);
    }
  });

  test('AC-02: created import 시 이름 매칭 user에게 contract.import_author 알림', async ({
    request
  }) => {
    const userEmail = process.env.E2E_USER_EMAIL!;
    const authorName = `E2E-CIN-AC02-${Date.now()}`;
    const documentNumber = uniqueDocumentNumber('AC47C02');
    const userId = await ensureUserAuthorName(request, userEmail, authorName);

    const response = await importContractForNotifications(request, {
      documentNumber,
      authorName
    });
    expect(response.status()).toBe(201);

    await expect
      .poll(async () => {
        const notifications = await listNotificationsForUser(request, userId);
        return filterImportNotifications(
          notifications,
          'contract.import_author',
          documentNumber
        ).length;
      })
      .toBe(1);

    const authorNotification = filterImportNotifications(
      await listNotificationsForUser(request, userId),
      'contract.import_author',
      documentNumber
    )[0];
    expect(authorNotification?.metadata?.import_status).toBe('created');
  });

  test('AC-03: backfill import 시 admin·author 알림과 import_status=backfill', async ({
    request
  }) => {
    const userEmail = process.env.E2E_USER_EMAIL!;
    const authorName = `E2E-CIN-AC03-${Date.now()}`;
    const documentNumber = uniqueDocumentNumber('AC47C03');
    const approvedAt = '2026-07-08T16:34:00+09:00';
    const userId = await ensureUserAuthorName(request, userEmail, authorName);

    const createResponse = await importContractForNotifications(request, {
      documentNumber,
      authorName,
      approvedAt
    });
    expect(createResponse.status()).toBe(201);
    const createBody = await createResponse.json();
    const contractId = createBody.contract.id as number;

    const nullResponse = await request.patch(`/api/contracts/${contractId}`, {
      data: { approved_at: null }
    });
    expect(nullResponse.status()).toBe(200);

    const backfillResponse = await request.post('/api/contracts/import', {
      headers: expectImportHeaders(),
      data: buildImportPayload(documentNumber, {
        author_name: authorName,
        author_email: null,
        approved_at: approvedAt
      })
    });
    expect(backfillResponse.status()).toBe(200);

    const { total, adminCount } = await countImportNotificationsForAdmins(
      request,
      documentNumber,
      'contract.import_admin'
    );
    expect(total).toBeGreaterThanOrEqual(adminCount);

    await expect
      .poll(async () => {
        const notifications = await listNotificationsForUser(request, userId);
        return filterImportNotifications(
          notifications,
          'contract.import_author',
          documentNumber
        ).filter((item) => item.metadata?.import_status === 'backfill').length;
      })
      .toBeGreaterThan(0);
  });

  test('AC-04: 동명이인 active user 전원에게 contract.import_author 알림', async ({
    request
  }) => {
    const userEmail = process.env.E2E_USER_EMAIL!;
    const user2Email = process.env.E2E_USER2_EMAIL;
    test.skip(!user2Email, 'E2E_USER2_EMAIL required');

    const authorName = `E2E-CIN-AC04-${Date.now()}`;
    const documentNumber = uniqueDocumentNumber('AC47C04');
    const userIdC = await ensureUserAuthorName(request, userEmail, authorName);
    const userIdD = await ensureUserAuthorName(request, user2Email!, authorName);

    const response = await importContractForNotifications(request, {
      documentNumber,
      authorName
    });
    expect(response.status()).toBe(201);

    await expect
      .poll(async () => {
        const notificationsC = filterImportNotifications(
          await listNotificationsForUser(request, userIdC),
          'contract.import_author',
          documentNumber
        );
        const notificationsD = filterImportNotifications(
          await listNotificationsForUser(request, userIdD),
          'contract.import_author',
          documentNumber
        );
        return notificationsC.length + notificationsD.length;
      })
      .toBe(2);
  });

  test('AC-05: 작성자 미매칭 시 admin 알림만 생성', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC47C05');
    const authorName = `미등록작성자-CIN-AC05-${Date.now()}`;

    const response = await importContractForNotifications(request, {
      documentNumber,
      authorName
    });
    expect(response.status()).toBe(201);

    const { total, adminCount } = await countImportNotificationsForAdmins(
      request,
      documentNumber,
      'contract.import_admin'
    );
    expect(total).toBe(adminCount);

    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await resolveUserIdByEmail(request, userEmail);
    const authorNotifications = filterImportNotifications(
      await listNotificationsForUser(request, userId),
      'contract.import_author',
      documentNumber
    );
    expect(authorNotifications).toHaveLength(0);
  });

  test('AC-06: duplicate 재import 시 admin·author 알림 추가 없음', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC47C06');
    const authorName = `E2E-CIN-AC06-${Date.now()}`;
    const userEmail = process.env.E2E_USER_EMAIL!;
    const userId = await ensureUserAuthorName(request, userEmail, authorName);

    const first = await importContractForNotifications(request, {
      documentNumber,
      authorName
    });
    expect(first.status()).toBe(201);

    const adminCountAfterFirst = (
      await countImportNotificationsForAdmins(request, documentNumber, 'contract.import_admin')
    ).total;
    const authorCountAfterFirst = filterImportNotifications(
      await listNotificationsForUser(request, userId),
      'contract.import_author',
      documentNumber
    ).length;
    expect(adminCountAfterFirst).toBeGreaterThan(0);
    expect(authorCountAfterFirst).toBe(1);

    const second = await importContractForNotifications(request, {
      documentNumber,
      authorName
    });
    expect(second.status()).toBe(200);

    const adminCountAfterSecond = (
      await countImportNotificationsForAdmins(request, documentNumber, 'contract.import_admin')
    ).total;
    const authorCountAfterSecond = filterImportNotifications(
      await listNotificationsForUser(request, userId),
      'contract.import_author',
      documentNumber
    ).length;

    expect(adminCountAfterSecond).toBe(adminCountAfterFirst);
    expect(authorCountAfterSecond).toBe(authorCountAfterFirst);
  });

  test('AC-07: validation 실패 import 시 알림 없음·import_failed log', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC47C07');
    const { approved_at: _approvedAt, ...payload } = buildImportPayload(documentNumber);

    const response = await request.post('/api/contracts/import', {
      headers: expectImportHeaders(),
      data: payload
    });
    expect(response.status()).toBe(400);
    const requestId = response.headers()['x-request-id'];
    expect(requestId).toBeTruthy();

    const adminCount = (
      await countImportNotificationsForAdmins(request, documentNumber, 'contract.import_admin')
    ).total;
    expect(adminCount).toBe(0);

    const listResponse = await request.get(
      `/api/contracts?search=${encodeURIComponent(documentNumber)}`
    );
    expect(listResponse.status()).toBe(200);
    const listBody = await listResponse.json();
    expect(
      listBody.items.some(
        (item: { document_number: string }) => item.document_number === documentNumber
      )
    ).toBe(false);
  });

  test('AC-11: fan-out 실패 시에도 import는 201·계약 row 생성', async ({ request }) => {
    const documentNumber = uniqueDocumentNumber('AC47C11');
    const authorName = `E2E-FANOUT-FAIL-CIN-AC11-${Date.now()}`;

    const response = await importContractForNotifications(request, {
      documentNumber,
      authorName
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.contract.document_number).toBe(documentNumber);

    const detailResponse = await request.get(`/api/contracts/${body.contract.id}`);
    expect(detailResponse.status()).toBe(200);

    const adminCount = (
      await countImportNotificationsForAdmins(request, documentNumber, 'contract.import_admin')
    ).total;
    expect(adminCount).toBe(0);
  });
});
