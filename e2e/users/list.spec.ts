import { expect, test, type Locator, type Page } from '@playwright/test';
import { fillBirthday } from '../helpers/birthday-select';
import { createActiveTestUser } from '../helpers/supabase-direct-auth';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const E2E_TEST_PHONE = '01012345678';

async function createUserViaApi(email: string, fullName = 'E2E 테스트') {
  const created = await createActiveTestUser('e2e-list', {
    email,
    fullName,
    phone: E2E_TEST_PHONE
  });
  return created.userId;
}

async function selectOption(page: Page, combobox: Locator, optionName: string) {
  await combobox.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}


test.describe('사용자 목록', () => {
  test('admin can view the users list', async ({ page }) => {
    await page.goto('/dashboard/users');

    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '이름' })).toBeVisible();
  });

  test('AC-05 plan58: 사용자 추가 버튼이 없다', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByRole('button', { name: '사용자 추가' })).toHaveCount(0);
  });

  test('AC-19-06: admin이 다른 사용자 이름을 수정할 수 있다', async ({ page }) => {
    const email = uniqueEmail('ac19-06');
    const originalName = `김철수E2E${Date.now()}`;
    const updatedName = `${originalName}수정`;

    await createUserViaApi(email, originalName);

    await page.goto('/dashboard/users');
    const targetRow = page.getByRole('row', { name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    await expect(targetRow).toBeVisible();

    await targetRow.getByRole('button', { name: '프로필 보기' }).click();
    await page.getByRole('button', { name: '조직 정보 수정' }).click();

    const dialog = page.getByRole('dialog', { name: '사용자 수정' });
    await expect(dialog).toBeVisible();
    const nameField = dialog.getByRole('textbox', { name: '이름' });
    await nameField.click();
    await nameField.clear();
    await nameField.pressSequentially(updatedName, { delay: 10 });
    await expect(nameField).toHaveValue(updatedName);
    await dialog.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('사용자 정보가 저장되었습니다.')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: updatedName, level: 2 })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(
      page.getByRole('cell', {
        name: new RegExp(
          `${updatedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
        )
      })
    ).toBeVisible();
  });

  test('AC-09: 초대 상태 대신 소속 컬럼이 표시된다', async ({ page }) => {
    await page.goto('/dashboard/users');

    await expect(page.getByRole('columnheader', { name: '소속' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '초대 상태' })).toHaveCount(0);
  });

  test('AC-7 plan21: admin이 부서/사업장·생일을 수정할 수 있다', async ({ page }) => {
    const email = uniqueEmail('ac7-plan21');
    await createUserViaApi(email, `부서사업장수정${Date.now()}`);

    await page.goto('/dashboard/users');
    const targetRow = page.getByRole('row', {
      name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    });
    await expect(targetRow).toBeVisible();

    await targetRow.getByRole('button', { name: '프로필 보기' }).click();
    await page.getByRole('button', { name: '조직 정보 수정' }).click();

    const dialog = page.getByRole('dialog', { name: '사용자 수정' });
    await expect(dialog).toBeVisible();
    await selectOption(page, dialog.getByRole('combobox', { name: '부서/사업장' }), '마케팅팀');

    await fillBirthday(page, dialog, {
      year: '1991년',
      month: '2월',
      day: '2일'
    });

    await dialog.getByRole('button', { name: '저장' }).click();
    await expect(page.getByText('사용자 정보가 저장되었습니다.')).toBeVisible();

    const profileDialog = page.getByRole('dialog', { name: new RegExp('부서사업장수정') });
    await expect(profileDialog.getByText('마케팅팀', { exact: true })).toBeVisible();
    await expect(profileDialog.getByText('1991년 2월 2일')).toBeVisible();
  });

  test('AC-8 plan21: NULL 생일 사용자에게 생일을 설정할 수 있다', async ({ page }) => {
    const email = uniqueEmail('ac8-plan21');
    const fullName = `생일보완${Date.now()}`;
    const userId = await createUserViaApi(email, fullName);

    const nullBirthdayResponse = await page.request.put(`/api/users/${userId}`, {
      data: { birthday: null, phone: E2E_TEST_PHONE }
    });
    expect(nullBirthdayResponse.status()).toBe(200);

    await page.goto('/dashboard/users');
    const targetRow = page.getByRole('row', {
      name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    });
    await expect(targetRow).toBeVisible();

    await targetRow.getByRole('button', { name: '프로필 보기' }).click();
    await page.getByRole('button', { name: '조직 정보 수정' }).click();

    const dialog = page.getByRole('dialog', { name: '사용자 수정' });
    await fillBirthday(page, dialog, {
      year: '1992년',
      month: '3월',
      day: '3일'
    });
    await dialog.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('사용자 정보가 저장되었습니다.')).toBeVisible();

    const profileDialog = page.getByRole('dialog', { name: new RegExp(fullName) });
    await expect(profileDialog.getByText('1992년 3월 3일')).toBeVisible();
  });

  test('AC-9 plan21: 프로필 Dialog에 소속·부서/사업장만 표시된다', async ({ page }) => {
    const email = uniqueEmail('ac9-plan21');
    await createUserViaApi(email, `프로필확인${Date.now()}`);

    await page.goto('/dashboard/users');
    const targetRow = page.getByRole('row', {
      name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    });
    await targetRow.getByRole('button', { name: '프로필 보기' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('소속', { exact: true })).toBeVisible();
    await expect(dialog.getByText('부서/사업장', { exact: true })).toBeVisible();
    await expect(dialog.getByText('부서', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('직책', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('못 먹는 음식')).toHaveCount(0);
  });
});
