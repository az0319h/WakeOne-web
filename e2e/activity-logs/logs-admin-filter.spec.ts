import { expect, test, type Page } from '@playwright/test';

async function gotoActivityLogs(page: Page) {
  await page.goto('/dashboard/logs');
  await expect(page.getByTestId('activity-logs-page')).toBeVisible();
}

async function openLogUserCombobox(page: Page) {
  const combobox = page.getByTestId('log-user-combobox');
  await expect(combobox).toBeVisible();
  await combobox.click();
}

async function selectComboboxOption(page: Page, optionName: string) {
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

test.describe('활동 로그 admin 필터', () => {
  test('AC-03: admin defaults to self scope with 본인 combobox', async ({ page }) => {
    await gotoActivityLogs(page);

    await expect(page.getByTestId('log-user-combobox')).toContainText('본인');
    await expect(
      page.getByText('본인 및 선택한 사용자의 활동 이력을 확인합니다.')
    ).toBeVisible();
    await expect(page).toHaveURL(/log_user=self/, { timeout: 10_000 });
  });

  test('AC-04: admin can filter by specific user B', async ({ page, request }) => {
    const user2Email = process.env.E2E_USER2_EMAIL;
    test.skip(!user2Email, 'E2E_USER2_EMAIL required');

    const usersResponse = await request.get(
      `/api/users?search=${encodeURIComponent(user2Email!)}&limit=5`
    );
    expect(usersResponse.status()).toBe(200);
    const usersBody = (await usersResponse.json()) as {
      users?: Array<{ id: string; email: string; full_name: string }>;
    };
    const userB = usersBody.users?.find((user) => user.email === user2Email);
    test.skip(!userB, 'E2E user2 not found in users API');

    await gotoActivityLogs(page);
    await openLogUserCombobox(page);
    await page.getByPlaceholder('이름·이메일 검색…').fill(user2Email!);
    await page
      .getByRole('option', {
        name: new RegExp(userB!.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      })
      .first()
      .click();

    await expect(page).toHaveURL(new RegExp(`log_user=${userB!.id}`));
    await expect(page.getByTestId('log-user-combobox')).not.toContainText('본인');
  });

  test('AC-05: admin can view all users logs', async ({ page }) => {
    await gotoActivityLogs(page);
    await openLogUserCombobox(page);
    await selectComboboxOption(page, '전체');

    await expect(page).toHaveURL(/log_user=all/);
    await expect(page.getByTestId('log-user-combobox')).toContainText('전체');
  });

  test('AC-06: admin can filter by activity type 사용자 비활성화', async ({ page }) => {
    await gotoActivityLogs(page);
    await openLogUserCombobox(page);
    await selectComboboxOption(page, '전체');

    await page.getByRole('button', { name: '활동 유형' }).click();
    await page.getByRole('option', { name: '사용자 비활성화', exact: true }).click();

    await expect(page).toHaveURL(/action=user\.deactivate/);

    const rows = page.getByTestId('activity-log-row');
    const rowCount = await rows.count();
    if (rowCount > 0) {
      for (let index = 0; index < rowCount; index += 1) {
        await expect(rows.nth(index)).toContainText('사용자 비활성화');
      }
      await expect(page.getByTestId('activity-logs-table-root')).not.toContainText(
        'user.deactivate'
      );
    }
  });

  test('AC-07: admin target search filters by target_label after debounce', async ({
    page,
    request
  }) => {
    const marker = `ac07-${Date.now()}@example.com`;
    const createResponse = await request.post('/api/users', {
      data: {
        email: marker,
        full_name: `AC07 ${Date.now()}`,
        affiliation: 'wake',
        rank: '경영진',
        system_role: 'user',
        birthday: '1990-01-01'
      }
    });
    expect(createResponse.status()).toBe(201);

    await gotoActivityLogs(page);
    await openLogUserCombobox(page);
    await selectComboboxOption(page, '전체');

    const searchInput = page.getByPlaceholder('대상 검색…');
    await searchInput.fill(marker);

    await expect(page).toHaveURL(/search=.*ac07-.*@example\.com/, {
      timeout: 10_000
    });
    await expect(page.getByTestId('activity-log-row').first()).toContainText(marker, {
      timeout: 15_000
    });
  });
});
