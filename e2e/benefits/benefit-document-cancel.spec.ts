import { expect, test } from '@playwright/test';
import {
  deleteBenefitDocumentByNumber,
  insertBenefitDocumentForE2e
} from '../helpers/benefits-fixture';
import { createOrgChartTestUser } from '../helpers/org-chart';

test.describe('복지비 문서 수동 취소 UI', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.setTimeout(90_000);

  const stamp = Date.now();
  const documentNumber = `E2E-CANCEL-UI-${stamp}`;
  const taskKey = `e2e-cancel-ui-${stamp}`;

  let memberFullName = '';
  let memberAffiliation = 'wake';

  test.beforeAll(async () => {
    const person = await createOrgChartTestUser('benefit-cancel-ui', {
      fullName: `E2E Benefit Cancel ${stamp}`,
      affiliation: 'wake',
      rank: '마케팅팀',
      position_level: '과장'
    });
    memberFullName = person.fullName;
    memberAffiliation = 'wake';
    await insertBenefitDocumentForE2e({
      applicantUserId: person.userId,
      applicantName: memberFullName,
      documentNumber,
      taskKey,
      documentCreatedAt: '2026-10-15',
      amount: 30_000
    });
  });

  test.afterAll(async () => {
    await deleteBenefitDocumentByNumber(documentNumber);
  });

  test('AC-01: 취소 후 합계 반영 및 취소됨 표시', async ({ page }) => {
    await page.goto(`/dashboard/benefits?month=2026-10&affiliation=${memberAffiliation}`);
    await page.getByPlaceholder('이름 검색').fill(memberFullName);
    await expect
      .poll(async () => page.getByRole('row').filter({ hasText: memberFullName }).count(), {
        timeout: 15_000
      })
      .toBeGreaterThan(0);

    const memberRow = page.getByRole('row').filter({ hasText: memberFullName }).first();
    await expect(memberRow).toBeVisible({ timeout: 30_000 });
    await memberRow.click();

    const row = page.getByRole('row').filter({ hasText: documentNumber });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.hover();
    await row.getByRole('button', { name: '복지비 문서 취소' }).click();
    await page.getByRole('button', { name: '취소하기' }).click();

    await expect(row.getByText('취소됨')).toBeVisible();
    await row.hover();
    await expect(row.getByRole('button', { name: '복지비 문서 복구' })).toBeVisible();
  });
});
