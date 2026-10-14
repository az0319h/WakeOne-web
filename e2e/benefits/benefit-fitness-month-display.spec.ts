import { expect, test, type Page } from '@playwright/test';
import {
  deleteBenefitDocumentByNumber,
  insertBenefitDocumentForE2e
} from '../helpers/benefits-fixture';
import { createOrgChartTestUser } from '../helpers/org-chart';

// plan: docs/plans/80_benefit-fitness-target-month-plan.md
test.describe.configure({ mode: 'serial' });

const FITNESS_DESCRIPTION = 'E2E benefit cancel';

test.describe('체력증진비 해당 월 UI 미표시 (plan 80 AC-14~16)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.setTimeout(90_000);

  const stamp = `${Date.now()}`;
  const numbers = {
    fitness: `E2E-FM-UI-FIT-${stamp}`,
    book: `E2E-FM-UI-BOOK-${stamp}`,
    legacy: `E2E-FM-UI-LEGACY-${stamp}`
  };
  let memberFullName = '';
  let memberUserId = '';

  test.beforeAll(async () => {
    const person = await createOrgChartTestUser('benefit-fm-ui', {
      fullName: `E2E FM UI ${stamp}`,
      affiliation: 'wake',
      rank: '마케팅팀',
      position_level: '과장'
    });
    memberFullName = person.fullName;
    memberUserId = person.userId;

    const base = { applicantUserId: person.userId, applicantName: person.fullName };
    await insertBenefitDocumentForE2e({
      ...base,
      documentNumber: numbers.fitness,
      taskKey: `e2e-fm-ui-fit-${stamp}`,
      documentCreatedAt: '2026-10-14',
      amount: 21_000,
      benefitType: 'fitness',
      benefitMonth: '2026-10-01'
    });
    await insertBenefitDocumentForE2e({
      ...base,
      documentNumber: numbers.book,
      taskKey: `e2e-fm-ui-book-${stamp}`,
      documentCreatedAt: '2026-10-14',
      amount: 12_000,
      benefitType: 'book'
    });
    await insertBenefitDocumentForE2e({
      ...base,
      documentNumber: numbers.legacy,
      taskKey: `e2e-fm-ui-legacy-${stamp}`,
      documentCreatedAt: '2026-10-05',
      amount: 9_000,
      benefitType: 'fitness'
    });
  });

  test.afterAll(async () => {
    for (const documentNumber of Object.values(numbers)) {
      await deleteBenefitDocumentByNumber(documentNumber);
    }
  });

  function documentRow(page: Page, documentNumber: string) {
    return page.getByTestId('benefit-document-row').filter({ hasText: documentNumber });
  }

  async function expectFitnessAndBookWithoutMonthLabel(page: Page) {
    const fitnessRow = documentRow(page, numbers.fitness);
    await expect(fitnessRow).toBeVisible({ timeout: 15_000 });
    await expect(fitnessRow.getByTestId('benefit-document-benefit-month')).toHaveCount(0);
    await expect(fitnessRow).not.toContainText('해당 월');
    await expect(fitnessRow).toContainText(FITNESS_DESCRIPTION);

    const bookRow = documentRow(page, numbers.book);
    await expect(bookRow).toBeVisible();
    await expect(bookRow.getByTestId('benefit-document-benefit-month')).toHaveCount(0);
    await expect(bookRow).not.toContainText('해당 월');
  }

  async function expectLegacyRowWithoutLabel(page: Page) {
    const legacyRow = documentRow(page, numbers.legacy);
    await expect(legacyRow).toBeVisible({ timeout: 15_000 });
    await expect(legacyRow.getByTestId('benefit-document-benefit-month')).toHaveCount(0);
    await expect(legacyRow).not.toContainText('해당 월');
  }

  async function openAdminMember(page: Page) {
    await page.goto('/dashboard/benefits?month=2026-10&affiliation=wake');
    await page.getByPlaceholder('이름 검색').fill(memberFullName);
    const memberRow = page.getByRole('row').filter({ hasText: memberFullName }).first();
    await expect(memberRow).toBeVisible({ timeout: 30_000 });
    await memberRow.click();
  }

  async function openMyBenefitsProxy(page: Page) {
    await page.goto(`/dashboard/my-benefits?month=2026-10&benefits_user=${memberUserId}`);
    await expect(page.getByRole('heading', { name: '내 복지비 사용 현황' })).toBeVisible();
  }

  test('AC-14: 관리자 화면 fitness·book 행에 「해당 월」 미표시 · description만', async ({
    page
  }) => {
    await openAdminMember(page);
    await expectFitnessAndBookWithoutMonthLabel(page);
  });

  test('AC-15: 내 복지비(admin proxy) fitness·book 행 「해당 월」 미표시', async ({ page }) => {
    await openMyBenefitsProxy(page);
    await expectFitnessAndBookWithoutMonthLabel(page);
  });

  test('AC-16: 기존형 fitness(null) 행은 두 화면 모두 미표시 · 크래시 없음', async ({ page }) => {
    await openAdminMember(page);
    await expectLegacyRowWithoutLabel(page);

    await openMyBenefitsProxy(page);
    await expectLegacyRowWithoutLabel(page);
  });
});
