import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  cleanupBenefitImportFixture,
  ensureApplicantName,
  filterBenefitNotifications,
  importBenefitForNotifications,
  listActiveBenefitOperationsUserIds,
  listNotificationsForUser,
  uniqueBenefitDocumentNumber
} from '../helpers/benefit-notifications';
import {
  deleteBenefitDocumentByNumber,
  getProfileForBenefitsFixture,
  insertBenefitDocumentForE2e
} from '../helpers/benefits-fixture';

test.describe.configure({ mode: 'serial' });

function readUserIdFromStorage(storagePath: string): string {
  const state = JSON.parse(fs.readFileSync(path.join(process.cwd(), storagePath), 'utf8'));
  const authCookie = (state.cookies as Array<{ name: string; value: string }>).find(
    (cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );
  if (!authCookie?.value) {
    throw new Error(`Missing auth cookie in ${storagePath}`);
  }
  const decoded = decodeURIComponent(authCookie.value);
  const session = JSON.parse(
    decoded.startsWith('base64-') ? Buffer.from(decoded.slice(7), 'base64').toString('utf8') : decoded
  ) as { user?: { id?: string } };
  const userId = session.user?.id;
  if (!userId) throw new Error(`Could not parse user id from ${storagePath}`);
  return userId;
}

test.describe('복지비 알림 API — import', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('AC-01: book created import 시 operations·applicant 알림', async ({ request }) => {
    const userEmail = process.env.E2E_USER_EMAIL!;
    const applicantName = `E2E-BEN-AC01-${Date.now()}`;
    const documentNumber = uniqueBenefitDocumentNumber('AC01');
    const taskKey = `e2e-ben-ac01-${Date.now()}`;
    const applicantUserId = await ensureApplicantName(request, userEmail, applicantName);

    const response = await importBenefitForNotifications(request, {
      documentNumber,
      taskKey,
      applicantName,
      benefitType: 'book'
    });
    expect(response.status()).toBe(201);

    const operationsIds = await listActiveBenefitOperationsUserIds();
    expect(operationsIds.length).toBeGreaterThan(0);

    for (const opsId of operationsIds) {
      const matched = filterBenefitNotifications(
        await listNotificationsForUser(request, opsId),
        'benefit.import_operations',
        documentNumber
      );
      expect(matched).toHaveLength(1);
      expect(matched[0]?.title).toContain('도서');
      expect(matched[0]?.body).toContain(documentNumber);
    }

    const applicantItems = filterBenefitNotifications(
      await listNotificationsForUser(request, applicantUserId),
      'benefit.import_applicant',
      documentNumber
    );
    expect(applicantItems).toHaveLength(1);
    expect(applicantItems[0]?.body).toContain('회원님의');

    await cleanupBenefitImportFixture(documentNumber);
  });

  test('AC-04: duplicate import 시 알림 0건', async ({ request }) => {
    const userEmail = process.env.E2E_USER_EMAIL!;
    const applicantName = `E2E-BEN-AC04-${Date.now()}`;
    const documentNumber = uniqueBenefitDocumentNumber('AC04');
    const taskKey = `e2e-ben-ac04-${Date.now()}`;
    await ensureApplicantName(request, userEmail, applicantName);

    const first = await importBenefitForNotifications(request, {
      documentNumber,
      taskKey,
      applicantName,
      benefitType: 'fitness'
    });
    expect(first.status()).toBe(201);

    const duplicate = await importBenefitForNotifications(request, {
      documentNumber,
      taskKey,
      applicantName,
      benefitType: 'fitness'
    });
    expect(duplicate.status()).toBe(200);

    const operationsIds = await listActiveBenefitOperationsUserIds();
    let total = 0;
    for (const opsId of operationsIds) {
      total += filterBenefitNotifications(
        await listNotificationsForUser(request, opsId),
        'benefit.import_operations',
        documentNumber
      ).length;
    }
    expect(total).toBe(operationsIds.length);

    await cleanupBenefitImportFixture(documentNumber);
  });

  test('AC-13: fan-out 실패 시 import 201 유지', async ({ request }) => {
    const userEmail = process.env.E2E_USER_EMAIL!;
    const applicantName = `E2E-BEN-AC13-${Date.now()}`;
    const documentNumber = uniqueBenefitDocumentNumber('FANOUT-FAIL-AC13');
    const taskKey = `e2e-ben-ac13-${Date.now()}`;
    await ensureApplicantName(request, userEmail, applicantName);

    const response = await importBenefitForNotifications(request, {
      documentNumber,
      taskKey,
      applicantName,
      benefitType: 'education'
    });
    expect(response.status()).toBe(201);

    const operationsIds = await listActiveBenefitOperationsUserIds();
    for (const opsId of operationsIds) {
      const matched = filterBenefitNotifications(
        await listNotificationsForUser(request, opsId),
        'benefit.import_operations',
        documentNumber
      );
      expect(matched).toHaveLength(0);
    }

    await cleanupBenefitImportFixture(documentNumber);
  });
});

test.describe('복지비 알림 API — cancel', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('AC-08: admin cancel 시 operations·applicant 알림', async ({ request }) => {
    const applicantUserId = readUserIdFromStorage('e2e/.auth/user.json');
    const { fullName: applicantName } = await getProfileForBenefitsFixture(applicantUserId);
    const documentNumber = uniqueBenefitDocumentNumber('AC08');
    const taskKey = `e2e-ben-ac08-${Date.now()}`;
    const row = await insertBenefitDocumentForE2e({
      applicantUserId,
      applicantName,
      documentNumber,
      taskKey,
      documentCreatedAt: '2026-10-10',
      amount: 30_000,
      benefitType: 'fitness'
    });

    const response = await request.patch(`/api/benefits/documents/${row.id}/cancel`);
    expect(response.status()).toBe(200);

    const operationsIds = await listActiveBenefitOperationsUserIds();
    for (const opsId of operationsIds) {
      const matched = filterBenefitNotifications(
        await listNotificationsForUser(request, opsId),
        'benefit.document_cancel_operations',
        documentNumber
      );
      expect(matched).toHaveLength(1);
      expect(matched[0]?.body).toContain('체력증진');
      expect(matched[0]?.body).toContain(documentNumber);
    }

    const applicantItems = filterBenefitNotifications(
      await listNotificationsForUser(request, applicantUserId),
      'benefit.document_cancel_applicant',
      documentNumber
    );
    expect(applicantItems).toHaveLength(1);
    expect(applicantItems[0]?.body).not.toContain('님이');

    await deleteBenefitDocumentByNumber(documentNumber);
  });
});

test.describe('복지비 알림 API — HR self cancel', () => {
  test.use({ storageState: 'e2e/.auth/hr-benefits.json' });

  test('AC-10: HR 본인 문서 취소 시 operations 알림 1건', async ({ request }) => {
    const hrUserId = readUserIdFromStorage('e2e/.auth/hr-benefits.json');
    const { fullName: applicantName } = await getProfileForBenefitsFixture(hrUserId);
    const documentNumber = uniqueBenefitDocumentNumber('AC10');
    const taskKey = `e2e-ben-ac10-${Date.now()}`;
    const row = await insertBenefitDocumentForE2e({
      applicantUserId: hrUserId,
      applicantName,
      documentNumber,
      taskKey,
      documentCreatedAt: '2026-10-11',
      amount: 20_000,
      benefitType: 'education'
    });

    const response = await request.patch(`/api/benefits/documents/${row.id}/cancel`);
    expect(response.status()).toBe(200);

    const ops = filterBenefitNotifications(
      await listNotificationsForUser(request, hrUserId),
      'benefit.document_cancel_operations',
      documentNumber
    );
    const applicant = filterBenefitNotifications(
      await listNotificationsForUser(request, hrUserId),
      'benefit.document_cancel_applicant',
      documentNumber
    );
    expect(ops).toHaveLength(1);
    expect(applicant).toHaveLength(0);
    expect(ops[0]?.body).toContain('본인의');
    expect(ops[0]?.body).toContain('외부교육');

    await deleteBenefitDocumentByNumber(documentNumber);
  });
});
