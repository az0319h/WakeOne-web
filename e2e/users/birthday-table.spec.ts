import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function createUserPayload(
  email: string,
  fullName: string,
  birthday: string | null = '1990-01-15'
) {
  return {
    email,
    full_name: fullName,
    affiliation: 'wake',
    rank: '사원',
    system_role: 'user',
    ...(birthday ? { birthday } : { birthday: '1990-01-01' })
  };
}

async function createUserViaApi(
  request: APIRequestContext,
  email: string,
  fullName: string,
  birthday = '1990-01-15'
) {
  const response = await request.post('/api/users', {
    data: createUserPayload(email, fullName, birthday)
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user_id?: string };
  return body.user_id as string;
}

async function selectOption(page: Page, combobox: Locator, optionName: string) {
  await combobox.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function openEditSheetForEmail(page: Page, email: string) {
  const emailRe = new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const targetRow = page.getByRole('row', { name: emailRe });
  await expect(targetRow).toBeVisible();

  await targetRow.getByRole('button', { name: '프로필 보기' }).click();
  await page.getByRole('button', { name: '조직 정보 수정' }).click();

  const dialog = page.getByRole('dialog', { name: '사용자 수정' });
  await expect(dialog).toBeVisible();
  return dialog;
}

function birthdayComboboxes(dialog: Locator) {
  const comboboxes = dialog.getByRole('combobox');
  return {
    year: comboboxes.nth(3),
    month: comboboxes.nth(4),
    day: comboboxes.nth(5)
  };
}

test.describe('plan22 Users 테이블 생일 · 수정 Sheet 초기값', () => {
  test('AC-01 plan22: 연락처 옆 생일 컬럼 · 포맷 · null — · 정렬·필터 없음', async ({
    page,
    request
  }) => {
    const withBirthdayEmail = uniqueEmail('p22-ac01-bday');
    const withBirthdayName = `생일있음${Date.now()}`;
    const nullBirthdayEmail = uniqueEmail('p22-ac01-null');
    const nullBirthdayName = `생일없음${Date.now()}`;

    const nullUserId = await createUserViaApi(
      request,
      nullBirthdayEmail,
      nullBirthdayName,
      '1990-01-01'
    );
    await createUserViaApi(request, withBirthdayEmail, withBirthdayName, '1990-01-15');

    const nullBirthdayResponse = await request.put(`/api/users/${nullUserId}`, {
      data: { birthday: null }
    });
    expect(nullBirthdayResponse.status()).toBe(200);

    await page.goto('/dashboard/users');
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();

    const phoneHeader = page.getByRole('columnheader', { name: '연락처' });
    const birthdayHeader = page.getByRole('columnheader', { name: '생일' });
    await expect(phoneHeader).toBeVisible();
    await expect(birthdayHeader).toBeVisible();

    const phoneBox = await phoneHeader.boundingBox();
    const birthdayBox = await birthdayHeader.boundingBox();
    expect(phoneBox && birthdayBox).toBeTruthy();
    if (phoneBox && birthdayBox) {
      expect(birthdayBox.x).toBeGreaterThan(phoneBox.x);
    }

    await expect(birthdayHeader.getByRole('button')).toHaveCount(0);

    await page.getByPlaceholder('사용자 검색…').fill(withBirthdayName);
    const withRow = page.getByRole('row', {
      name: new RegExp(withBirthdayEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    });
    await expect(withRow).toBeVisible();
    await expect(withRow.getByRole('cell', { name: '1990년 1월 15일' })).toBeVisible();

    await page.getByPlaceholder('사용자 검색…').fill(nullBirthdayName);
    const nullRow = page.getByRole('row', {
      name: new RegExp(nullBirthdayEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    });
    await expect(nullRow).toBeVisible();
    await expect(nullRow).not.toContainText(/\d{4}년 \d{1,2}월 \d{1,2}일/);
    await expect(nullRow.getByRole('cell', { name: '—', exact: true }).first()).toBeVisible();
  });

  test('AC-02 plan22: 수정 Sheet 오픈 시 년·월·일 Select 초기 표시', async ({
    page,
    request
  }) => {
    const email = uniqueEmail('p22-ac02');
    const fullName = `시트초기${Date.now()}`;
    await createUserViaApi(request, email, fullName, '1988-07-09');

    await page.goto('/dashboard/users');
    await page.getByPlaceholder('사용자 검색…').fill(fullName);
    const dialog = await openEditSheetForEmail(page, email);
    const { year, month, day } = birthdayComboboxes(dialog);

    await expect(year).toHaveText('1988년');
    await expect(month).toHaveText('7월');
    await expect(day).toHaveText('9일');
    await expect(year).not.toHaveText('년');
    await expect(month).not.toHaveText('월');
    await expect(day).not.toHaveText('일');
  });

  test('AC-03 plan22: Sheet 재오픈 후 동일 년·월·일 유지', async ({ page, request }) => {
    const email = uniqueEmail('p22-ac03');
    const fullName = `시트재오픈${Date.now()}`;
    await createUserViaApi(request, email, fullName, '1985-12-25');

    await page.goto('/dashboard/users');
    await page.getByPlaceholder('사용자 검색…').fill(fullName);

    const firstDialog = await openEditSheetForEmail(page, email);
    const first = birthdayComboboxes(firstDialog);
    await expect(first.year).toHaveText('1985년');
    await expect(first.month).toHaveText('12월');
    await expect(first.day).toHaveText('25일');

    await firstDialog.getByRole('button', { name: 'Close' }).click();
    await expect(firstDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'Close' }).click();

    const secondDialog = await openEditSheetForEmail(page, email);
    const second = birthdayComboboxes(secondDialog);
    await expect(second.year).toHaveText('1985년');
    await expect(second.month).toHaveText('12월');
    await expect(second.day).toHaveText('25일');
  });

  test('AC-05 plan22: 사용자 추가 후 목록에 생일 yyyy년 M월 d일 표시', async ({ page }) => {
    const email = uniqueEmail('p22-ac05');
    const fullName = `생성회귀${Date.now()}`;

    await page.goto('/dashboard/users');
    await page.getByRole('button', { name: '사용자 추가' }).click();
    const dialog = page.getByRole('dialog', { name: '사용자 추가' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: '이름' }).fill(fullName);
    await dialog.getByRole('textbox', { name: '이메일' }).fill(email);
    await selectOption(page, dialog.getByRole('combobox', { name: '소속' }), '웨이크');
    await selectOption(page, dialog.getByRole('combobox', { name: '직급' }), '사원');
    await selectOption(page, dialog.getByRole('combobox', { name: '시스템 역할' }), 'User');

    const comboboxes = dialog.getByRole('combobox');
    await selectOption(page, comboboxes.nth(3), '1993년');
    await selectOption(page, comboboxes.nth(4), '4월');
    await selectOption(page, comboboxes.nth(5), '4일');

    await dialog.getByRole('button', { name: '사용자 추가' }).click();
    await expect(page.getByText('사용자가 추가되었습니다.')).toBeVisible();

    await page.getByPlaceholder('사용자 검색…').fill(fullName);
    const row = page.getByRole('row', {
      name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    });
    await expect(row).toBeVisible();
    await expect(row.getByRole('cell', { name: '1993년 4월 4일' })).toBeVisible();
  });
});
