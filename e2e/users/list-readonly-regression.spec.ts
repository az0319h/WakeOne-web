import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

type UsersResponse = {
  users: Array<{
    full_name: string;
    email: string;
    system_role: 'admin' | 'user';
    affiliation: string | null;
  }>;
  total_users: number;
};

const USERS_PATH = '/dashboard/users';
const SEARCH_TERMS = ['김주원', 'jwkim', 'kykhkim'];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchUsers(request: APIRequestContext, query = '') {
  const response = await request.get(`/api/users${query}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as UsersResponse;
}

async function waitForUsersPage(page: Page) {
  await page.goto(USERS_PATH);
  await expectUsersPageReady(page);
}

async function expectUsersPageReady(page: Page) {
  await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /이름/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '부서/사업장' })).toBeVisible();
  await expect
    .poll(async () => (await dataRows(page)).length, {
      message: 'users table should finish loading'
    })
    .toBeGreaterThan(0);
}

async function dataRows(page: Page) {
  return page.getByRole('table').getByRole('row').evaluateAll((rows) =>
    rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll('td'));
        return cells
          .map((cell) => (cell as HTMLElement).innerText || cell.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter((text) => text && !text.includes('No results.'))
  );
}

function firstPageLabel(page: Page) {
  return page.getByText(/^Page \d+ of \d+$/);
}

async function expectSearchParam(page: Page, key: string, value: string) {
  await expect
    .poll(() => new URL(page.url()).searchParams.get(key), {
      message: `${key} query param should be ${value}`
    })
    .toBe(value);
}

async function fillSearch(page: Page, term: string) {
  await page.getByPlaceholder('사용자 검색…').fill(term);
  await expectSearchParam(page, 'name', term);
  await expect(page.getByPlaceholder('사용자 검색…')).toHaveValue(term);
}

async function selectSystemRole(page: Page, roleLabel: 'Admin' | 'User') {
  await page.getByRole('toolbar').getByRole('button', { name: /^시스템 역할/ }).click();
  await page.getByRole('option', { name: roleLabel, exact: true }).click();
  await expectSearchParam(page, 'system_role', roleLabel.toLowerCase());
}

async function expectVisibleRowsContain(page: Page, text: RegExp) {
  await expect(page.getByText('No results.')).toHaveCount(0);
  await expect
    .poll(
      async () => {
        const rows = await dataRows(page);
        return rows.some((row) => text.test(row));
      },
      { message: `table rows should contain ${text}` }
    )
    .toBe(true);
}

async function gotoSortedUsers(page: Page, columnName: '이름' | '소속', direction: 'Asc' | 'Desc') {
  const columnId = columnName === '이름' ? 'name' : 'affiliation';
  const sort = encodeURIComponent(
    JSON.stringify([{ id: columnId, desc: direction === 'Desc' }])
  );

  await page.goto(`${USERS_PATH}?sort=${sort}`);
  await expectUsersPageReady(page);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('sort') ?? '', {
      message: `${columnName} ${direction} sort should be reflected in URL`
    })
    .toContain(columnId);
}

test.describe('사용자 목록 읽기 전용 필터/정렬 회귀', () => {
  test('AC-users-readonly-01: 검색어가 URL과 결과에 반영된다', async ({ page }) => {
    await waitForUsersPage(page);

    for (const term of SEARCH_TERMS) {
      await fillSearch(page, term);
      await expectVisibleRowsContain(page, new RegExp(escapeRegExp(term), 'i'));
      await page.getByRole('button', { name: 'Reset filters' }).click();
      await expect(page.getByPlaceholder('사용자 검색…')).toHaveValue('');
    }
  });

  test('AC-users-readonly-02: 시스템 역할 필터가 URL과 결과에 반영된다', async ({
    page,
    request
  }) => {
    await waitForUsersPage(page);

    await selectSystemRole(page, 'User');
    await expectVisibleRowsContain(page, /\buser\b/i);

    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(
      page.getByRole('toolbar').getByRole('button', { name: /^시스템 역할/ })
    ).toBeVisible();

    const adminUsers = await fetchUsers(request, '?systemRoles=admin&limit=1');
    test.skip(adminUsers.total_users === 0, 'Admin role data is unavailable in this environment');

    await selectSystemRole(page, 'Admin');
    await expectVisibleRowsContain(page, /\badmin\b/i);
  });

  test('AC-users-readonly-03: 검색어와 시스템 역할 필터 조합이 동작한다', async ({ page }) => {
    await waitForUsersPage(page);

    await fillSearch(page, '김주원');
    await selectSystemRole(page, 'User');

    await expectSearchParam(page, 'name', '김주원');
    await expectSearchParam(page, 'system_role', 'user');
    await expectVisibleRowsContain(page, /김주원/);
    await expectVisibleRowsContain(page, /\buser\b/i);
  });

  test('AC-users-readonly-04: 빈 결과는 표준 빈 상태를 표시하고 500 없이 유지된다', async ({
    page
  }) => {
    await waitForUsersPage(page);

    await fillSearch(page, 'no-such-user-filter-sort-regression');

    await expect(page.getByText('No results.')).toBeVisible();
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
    await expect(page.getByText(/500|Application error|Internal Server Error/i)).toHaveCount(0);
  });

  test('AC-users-readonly-05: 이름 정렬 asc/desc가 실제 행 순서를 바꾼다', async ({
    page
  }) => {
    await gotoSortedUsers(page, '이름', 'Asc');
    await expect.poll(async () => (await dataRows(page)).length).toBeGreaterThan(1);
    const ascRows = await dataRows(page);
    expect(ascRows.length).toBeGreaterThan(1);

    await gotoSortedUsers(page, '이름', 'Desc');
    await expect.poll(async () => (await dataRows(page)).length).toBeGreaterThan(1);
    const descRows = await dataRows(page);
    expect(descRows.length).toBe(ascRows.length);
    expect(descRows).not.toEqual(ascRows);
  });

  test('AC-users-readonly-06: 소속 정렬 asc/desc가 실제 행 순서를 바꾼다', async ({
    page
  }) => {
    await gotoSortedUsers(page, '소속', 'Asc');
    await expect.poll(async () => (await dataRows(page)).length).toBeGreaterThan(1);
    const ascRows = await dataRows(page);
    expect(ascRows.length).toBeGreaterThan(1);

    await gotoSortedUsers(page, '소속', 'Desc');
    await expect.poll(async () => (await dataRows(page)).length).toBeGreaterThan(1);
    const descRows = await dataRows(page);
    expect(descRows.length).toBe(ascRows.length);
    expect(descRows).not.toEqual(ascRows);
  });

  test('AC-users-readonly-07: rows per page와 next/previous pagination이 동작한다', async ({
    page,
    request
  }) => {
    const users = await fetchUsers(request, '?limit=1');
    test.skip(users.total_users <= 10, 'Pagination requires more than 10 users');
    await waitForUsersPage(page);

    const initialRows = await dataRows(page);
    await page.getByRole('button', { name: 'Go to next page' }).click();
    await expectSearchParam(page, 'page', '2');
    const nextRows = await dataRows(page);
    expect(nextRows).not.toEqual(initialRows);

    await page.getByRole('button', { name: 'Go to previous page' }).click();
    await expectSearchParam(page, 'page', '1');
    await expect(dataRows(page)).resolves.toEqual(initialRows);

    const rowsPerPage = page.getByRole('combobox').filter({ hasText: '10' });
    await rowsPerPage.click();
    await page.getByRole('option', { name: '20', exact: true }).click();
    await expectSearchParam(page, 'perPage', '20');
    await expect(page.getByRole('combobox').filter({ hasText: '20' })).toBeVisible();
  });

  test('AC-users-readonly-08: overflow page 진입 시 유효 페이지로 clamp된다', async ({
    page
  }) => {
    await page.goto(`${USERS_PATH}?page=999&perPage=10`);
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
    await expect(page.getByText(/Page 999 of/)).toHaveCount(0);

    const label = await firstPageLabel(page).textContent();
    expect(label).toBeTruthy();
    const match = label?.match(/^Page (\d+) of (\d+)$/);
    expect(match).toBeTruthy();

    const current = Number(match?.[1]);
    const total = Number(match?.[2]);
    expect(current).toBeGreaterThan(0);
    expect(total).toBeGreaterThan(0);
    expect(current).toBeLessThanOrEqual(total);

    await expect
      .poll(() => Number(new URL(page.url()).searchParams.get('page') ?? '0'), {
        message: 'overflow URL page should be clamped'
      })
      .toBe(current);
  });
});
