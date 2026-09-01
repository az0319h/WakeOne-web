import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createAdminRequest, e2eBaseURL } from '../helpers/auth-request';
import { cleanupE2eMockData } from '../helpers/cleanup';
import {
  ensureUserAuthorName,
  importContractForNotifications,
  uniqueDocumentNumber
} from '../helpers/contract-import-notifications';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
  cleanupE2eMockData();
  const probe = await playwright.request.newContext({ baseURL: e2eBaseURL });
  await expect
    .poll(async () => (await probe.get('/auth/sign-in')).status(), { timeout: 60_000 })
    .toBe(200);
  await probe.dispose();
});

test.describe('계약 Import 알림 UI (admin)', () => {
  test('AC-08: admin 알림 CTA 계약서 관리 → /dashboard/contracts', async ({
    page,
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const documentNumber = uniqueDocumentNumber('AC47C08');
      const authorName = `E2E-CIN-AC08-${Date.now()}`;

      const response = await importContractForNotifications(adminRequest, {
        documentNumber,
        authorName
      });
      expect(response.status()).toBe(201);

      await page.goto('/dashboard/notifications');
      await expect(page.getByTestId('notifications-page')).toBeVisible();

      await expect(
        page.getByRole('heading', { name: '계약서가 import되었습니다', level: 3 }).first()
      ).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: '계약서 관리' }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/contracts/);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-10: user.update CTA 회귀 — import 타입과 무관하게 프로필 보기 유지', async () => {
    const helpersPath = path.join(
      process.cwd(),
      'src/features/notifications/components/notification-helpers.ts'
    );
    const source = fs.readFileSync(helpersPath, 'utf8');

    expect(source).toContain("notification.type === 'user.update'");
    expect(source).toContain("label: '프로필 보기'");
    expect(source).toContain("notification.type === 'contract.import_admin'");
    expect(source).toContain("label: '계약서 관리'");
    expect(source).toContain("notification.type === 'contract.import_author'");
    expect(source).toContain("label: '내 계약서에서 확인'");
  });
});

test.describe('계약 Import 알림 UI (user)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-09: 작성자 알림 CTA 내 계약서에서 확인·첨부 업로드 문구 없음', async ({
    page,
    playwright
  }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const authorName = `E2E-CIN-AC09-${Date.now()}`;
      const documentNumber = uniqueDocumentNumber('AC47C09');

      await ensureUserAuthorName(adminRequest, userEmail, authorName);

      const response = await importContractForNotifications(adminRequest, {
        documentNumber,
        authorName
      });
      expect(response.status()).toBe(201);

      await page.goto('/dashboard/notifications');
      await expect(page.getByTestId('notifications-page')).toBeVisible();

      await expect(page.getByText(documentNumber).first()).toBeVisible({ timeout: 15_000 });

      const importCard = page
        .getByTestId(/^notification-card-/)
        .filter({ hasText: documentNumber })
        .first();

      await expect(importCard.getByText(/첨부/)).toHaveCount(0);
      await expect(importCard.getByRole('button', { name: /업로드/ })).toHaveCount(0);

      await importCard.getByRole('button', { name: '내 계약서에서 확인' }).click();
      await expect(page).toHaveURL(/\/dashboard\/my-contracts/, { timeout: 15_000 });
    } finally {
      await adminRequest.dispose();
    }
  });
});
