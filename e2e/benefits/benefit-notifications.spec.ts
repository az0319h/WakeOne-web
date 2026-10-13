import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  ensureApplicantName,
  importBenefitForNotifications,
  uniqueBenefitDocumentNumber
} from '../helpers/benefit-notifications';

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.describe('복지비 알림 UI', () => {
  test('AC-17: operations CTA 복지비 관리', async ({ page, playwright }) => {
    const adminRequest = await createAdminRequest(playwright);

    try {
      const userEmail = process.env.E2E_USER_EMAIL!;
      const applicantName = `E2E-BEN-UI-AC17-${Date.now()}`;
      const documentNumber = uniqueBenefitDocumentNumber('AC17');
      const taskKey = `e2e-ben-ui-ac17-${Date.now()}`;
      await ensureApplicantName(adminRequest, userEmail, applicantName);

      const response = await importBenefitForNotifications(adminRequest, {
        documentNumber,
        taskKey,
        applicantName,
        benefitType: 'book'
      });
      expect(response.status()).toBe(201);

      await page.goto('/dashboard/notifications');
      await expect(page.getByTestId('notifications-page')).toBeVisible();

      await expect(
        page.getByRole('heading', { name: '도서 신청이 등록되었습니다', level: 3 }).first()
      ).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: '복지비 관리' }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/benefits/);
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-18: benefit notification helper CTA 정의', async () => {
    const helpersPath = path.join(
      process.cwd(),
      'src/features/notifications/components/notification-helpers.ts'
    );
    const source = fs.readFileSync(helpersPath, 'utf8');

    expect(source).toContain("notification.type === 'benefit.import_operations'");
    expect(source).toContain("label: '복지비 관리'");
    expect(source).toContain("notification.type === 'benefit.import_applicant'");
    expect(source).toContain("label: '내 복지비 보기'");
  });
});
