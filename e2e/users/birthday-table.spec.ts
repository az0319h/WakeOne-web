import { expect, test, type Page } from '@playwright/test';
import { birthdaySelectTriggers } from '../helpers/birthday-select';
import { createActiveTestUser } from '../helpers/supabase-direct-auth';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function createUserViaApi(
  email: string,
  fullName: string,
  birthday = '1990-01-15'
) {
  const created = await createActiveTestUser('e2e-birthday-table', {
    email,
    fullName,
    birthday,
    phone: '01012345678'
  });
  return created.userId;
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

test.describe('plan22 Users 테이블 생일 · 수정 Sheet 초기값', () => {
  test('AC-01 plan22: 연락처 옆 생일 컬럼 · 포맷 · null — · 정렬·필터 없음', async ({
    page
  }) => {
    const withBirthdayEmail = uniqueEmail('p22-ac01-bday');
    const withBirthdayName = `생일있음${Date.now()}`;
    const nullBirthdayEmail = uniqueEmail('p22-ac01-null');
    const nullBirthdayName = `생일없음${Date.now()}`;

    const nullUserId = await createUserViaApi(
      nullBirthdayEmail,
      nullBirthdayName,
      '1990-01-01'
    );
    await createUserViaApi(withBirthdayEmail, withBirthdayName, '1990-01-15');

    const nullBirthdayResponse = await page.request.put(`/api/users/${nullUserId}`, {
      data: { birthday: null, phone: '01012345678' }
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

  test('AC-02 plan22: 수정 Sheet 오픈 시 년·월·일 Select 초기 표시', async ({ page }) => {
    const email = uniqueEmail('p22-ac02');
    const fullName = `시트초기${Date.now()}`;
    await createUserViaApi(email, fullName, '1988-07-09');

    await page.goto('/dashboard/users');
    await page.getByPlaceholder('사용자 검색…').fill(fullName);
    const dialog = await openEditSheetForEmail(page, email);
    const { year, month, day } = birthdaySelectTriggers(dialog);

    await expect(year).toHaveText('1988년');
    await expect(month).toHaveText('7월');
    await expect(day).toHaveText('9일');
    await expect(year).not.toHaveText('년');
    await expect(month).not.toHaveText('월');
    await expect(day).not.toHaveText('일');
  });

  test('AC-03 plan22: Sheet 재오픈 후 동일 년·월·일 유지', async ({ page }) => {
    const email = uniqueEmail('p22-ac03');
    const fullName = `시트재오픈${Date.now()}`;
    await createUserViaApi(email, fullName, '1985-12-25');

    await page.goto('/dashboard/users');
    await page.getByPlaceholder('사용자 검색…').fill(fullName);

    const firstDialog = await openEditSheetForEmail(page, email);
    const first = birthdaySelectTriggers(firstDialog);
    await expect(first.year).toHaveText('1985년');
    await expect(first.month).toHaveText('12월');
    await expect(first.day).toHaveText('25일');

    await firstDialog.getByRole('button', { name: 'Close' }).click();
    await expect(firstDialog).toHaveCount(0);

    await page.getByRole('button', { name: 'Close' }).click();

    const secondDialog = await openEditSheetForEmail(page, email);
    const second = birthdaySelectTriggers(secondDialog);
    await expect(second.year).toHaveText('1985년');
    await expect(second.month).toHaveText('12월');
    await expect(second.day).toHaveText('25일');
  });

  test('AC-05 plan22: active 사용자 목록에 생일 yyyy년 M월 d일 표시', async ({ page }) => {
    const email = uniqueEmail('p22-ac05');
    const fullName = `생성회귀${Date.now()}`;
    await createUserViaApi(email, fullName, '1993-04-04');

    await page.goto('/dashboard/users');
    await page.getByPlaceholder('사용자 검색…').fill(fullName);
    const row = page.getByRole('row', {
      name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    });
    await expect(row).toBeVisible();
    await expect(row.getByRole('cell', { name: '1993년 4월 4일' })).toBeVisible();
  });
});
