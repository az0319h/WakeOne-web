import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function createUserPayload(email: string) {
  return {
    email,
    affiliation: 'wake',
    department: '콘텐츠팀',
    rank: '사원',
    job_title: '팀장',
    system_role: 'user',
    birthday: '1990-01-01'
  };
}

async function createUserViaApi(request: APIRequestContext, email: string) {
  const response = await request.post('/api/users', {
    data: createUserPayload(email)
  });

  expect(response.status()).toBe(201);
  expect(response.headers()['x-request-id']).toBeTruthy();
}

async function openUserAddDialog(page: Page) {
  await page.goto('/dashboard/users');
  await page.getByRole('button', { name: '사용자 추가' }).click();
  const dialog = page.getByRole('dialog', { name: '사용자 추가' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectOption(page: Page, combobox: Locator, optionName: string) {
  await combobox.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function fillRequiredCreateFields(page: Page, dialog: Locator, email: string) {
  await dialog.getByRole('textbox', { name: '이메일' }).fill(email);
  await selectOption(page, dialog.getByRole('combobox', { name: '소속' }), '웨이크');
  await selectOption(page, dialog.getByRole('combobox', { name: '부서' }), '콘텐츠팀');
  await selectOption(page, dialog.getByRole('combobox', { name: '직급' }), '사원');
  await selectOption(page, dialog.getByRole('combobox', { name: '직책' }), '팀장');
  await selectOption(page, dialog.getByRole('combobox', { name: '시스템 역할' }), 'User');

  const comboboxes = dialog.getByRole('combobox');
  await selectOption(page, comboboxes.nth(5), '1990년');
  await selectOption(page, comboboxes.nth(6), '1월');
  await selectOption(page, comboboxes.nth(7), '1일');
}

test.describe('사용자 목록', () => {
  test('admin can view the users list', async ({ page }) => {
    await page.goto('/dashboard/users');

    await expect(page.getByRole('heading', { name: '사용자' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '이름' })).toBeVisible();
  });

  test('AC-01: 생성 문구가 사용자 추가로 표시된다', async ({ page }) => {
    const dialog = await openUserAddDialog(page);

    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: '이메일' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: '소속' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: '부서' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: '직급' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: '직책' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: '시스템 역할' })).toBeVisible();
    await expect(page.getByRole('button', { name: /사용자 초대/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /초대 보내기/ })).toHaveCount(0);
  });

  test('AC-02: 이메일을 비우면 오류가 표시되고 생성되지 않는다', async ({ page }) => {
    const dialog = await openUserAddDialog(page);

    await dialog.getByRole('button', { name: '사용자 추가' }).click();

    await expect(dialog.getByRole('alert').filter({ hasText: '올바른 이메일 주소' })).toBeVisible();
  });

  test('AC-03: 필수 조직 정보를 비우면 오류가 표시되고 생성되지 않는다', async ({ page }) => {
    const dialog = await openUserAddDialog(page);

    await dialog.getByRole('textbox', { name: '이메일' }).fill(uniqueEmail('ac03-user'));
    await dialog.getByRole('button', { name: '사용자 추가' }).click();

    await expect(dialog.getByRole('alert').filter({ hasText: '소속을 선택해 주세요.' })).toBeVisible();
    await expect(dialog.getByRole('alert').filter({ hasText: '부서를 선택해 주세요.' })).toBeVisible();
    await expect(dialog.getByRole('alert').filter({ hasText: '직급을 선택해 주세요.' })).toBeVisible();
    await expect(dialog.getByRole('alert').filter({ hasText: '직책을 선택해 주세요.' })).toBeVisible();
    await expect(
      dialog.getByRole('alert').filter({ hasText: '시스템 역할을 선택해 주세요.' })
    ).toBeVisible();
    await expect(dialog.getByRole('alert').filter({ hasText: '생일을 선택해 주세요.' })).toBeVisible();
  });

  test('AC-04: 사용자 추가 성공 후 목록에 새로고침 없이 표시된다', async ({ page }) => {
    const email = uniqueEmail('ac04-user');
    const dialog = await openUserAddDialog(page);

    await fillRequiredCreateFields(page, dialog, email);
    await dialog.getByRole('button', { name: '사용자 추가' }).click();

    await expect(page.getByText('사용자가 추가되었습니다.')).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(email) })).toBeVisible();
  });

  test('AC-05: 신규 계정은 초기 비밀번호로 대시보드에 진입한다', async ({
    browser,
    request
  }) => {
    const email = uniqueEmail('ac05-user');
    await createUserViaApi(request, email);

    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] }
    });
    const page = await context.newPage();
    const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

    await page.goto(`${baseURL}/auth/sign-in`);
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await page.getByPlaceholder('이메일을 입력하세요').fill(email);
    await page.getByPlaceholder('비밀번호를 입력하세요').fill('12341234a');
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await context.close();
  });

  test('AC-09: 초대 상태 대신 소속 컬럼이 표시된다', async ({ page }) => {
    await page.goto('/dashboard/users');

    await expect(page.getByRole('columnheader', { name: '소속' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '초대 상태' })).toHaveCount(0);
  });
});
