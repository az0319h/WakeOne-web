import { expect, test } from '@playwright/test';
import {
  activityLogRowsForUser,
  createDisposableUser,
  expectActivityLogRowForUser,
  fetchUserFullNameByEmail,
  gotoAdminUserUpdateLogsForUser,
  updateUserFullName
} from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('활동 로그 live 이름 표시', () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL!;

  let userId: string;
  let userEmail: string;
  let firstUpdatedName: string;
  let secondUpdatedName: string;

  test.beforeAll(async ({ request }) => {
    const stamp = Date.now();
    firstUpdatedName = `E2E-P29-AC1-${stamp}`;
    secondUpdatedName = `E2E-P29-AC3-${stamp}`;

    const created = await createDisposableUser(
      request,
      'p29-logs',
      `E2E-P29-SEED-${stamp}`
    );
    userId = created.userId;
    userEmail = created.email;
    await updateUserFullName(request, userId, firstUpdatedName);
  });

  test('AC-01: user.update 대상 컬럼에 변경 후 이름이 표시된다', async ({ page }) => {
    await gotoAdminUserUpdateLogsForUser(page, userEmail);

    const targetRow = await expectActivityLogRowForUser(page, userEmail, firstUpdatedName);
    await expect(targetRow).toContainText(userEmail);
  });

  test('AC-02: user.update 행위자에 admin 현재 full_name이 표시된다', async ({
    page,
    request
  }) => {
    const adminFullName = await fetchUserFullNameByEmail(request, adminEmail);

    await gotoAdminUserUpdateLogsForUser(page, userEmail);
    await expectActivityLogRowForUser(page, userEmail, adminFullName);
  });

  test('AC-03: 과거·신규 user.update 로그 모두 최신 full_name이 표시된다', async ({
    page,
    request
  }) => {
    await updateUserFullName(request, userId, secondUpdatedName);

    await gotoAdminUserUpdateLogsForUser(page, userEmail);

    const rows = activityLogRowsForUser(page, userEmail);
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });

    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      await row.scrollIntoViewIfNeeded();
      await expect(row).toContainText(secondUpdatedName);
      await expect(row).not.toContainText(firstUpdatedName);
    }
  });

  test('AC-04: 변경 후 이름으로 대상 검색 시 B 관련 로그가 필터링된다', async ({ page }) => {
    await gotoAdminUserUpdateLogsForUser(page, userEmail);

    const searchInput = page.getByPlaceholder('대상 검색…');
    const searchTerm = secondUpdatedName.slice(0, 22);
    await searchInput.fill(searchTerm);

    await expect(page).toHaveURL(/search=/, { timeout: 10_000 });
    await expectActivityLogRowForUser(page, userEmail, secondUpdatedName);
  });
});
