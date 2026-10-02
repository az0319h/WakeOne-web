import { createClient } from '@supabase/supabase-js';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createActiveTestUser } from '../helpers/supabase-direct-auth';

const E2E_TEST_PHONE = '01012345678';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function createUserViaApi(email: string, fullName = 'E2E 테스트') {
  const created = await createActiveTestUser('e2e-admin-phone', {
    email,
    fullName,
    phone: E2E_TEST_PHONE
  });
  return created.userId;
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(url, 'NEXT_PUBLIC_SUPABASE_URL is required').toBeTruthy();
  expect(serviceKey, 'SUPABASE_SERVICE_ROLE_KEY is required').toBeTruthy();

  return createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function setProfilePhoneNull(userId: string) {
  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from('profiles')
    .update({ phone: null })
    .eq('user_id', userId);
  expect(error).toBeNull();
}

async function openUserEditDialog(page: Page, email: string) {
  await page.goto('/dashboard/users');
  await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible({
    timeout: 30_000
  });
  const targetRow = page.getByRole('row', {
    name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  });
  await expect(targetRow).toBeVisible();
  await targetRow.getByRole('button', { name: '프로필 보기' }).click();
  await page.getByRole('button', { name: '조직 정보 수정' }).click();
  const dialog = page.getByRole('dialog', { name: '사용자 수정' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe.configure({ mode: 'serial' });

test.describe('admin 사용자 연락처 Sheet', () => {
  test('AC-3 plan30: 수정 Sheet에서 연락처를 비우면 오류가 표시되고 저장되지 않는다', async ({
    page
  }) => {
    const email = uniqueEmail('ac3-plan30');
    await createUserViaApi(email, `AC3-${Date.now()}`);

    const dialog = await openUserEditDialog(page, email);
    await dialog.getByRole('textbox', { name: '연락처' }).clear();
    await dialog.getByRole('button', { name: '저장' }).click();

    await expect(
      dialog.getByRole('alert').filter({ hasText: '연락처를 입력해 주세요.' })
    ).toBeVisible();
    await expect(page.getByText('사용자 정보가 저장되었습니다.')).toHaveCount(0);
  });

  test('AC-4 plan30: 수정 Sheet에서 연락처 변경 시 하이픈 형식으로 반영된다', async ({
    page
  }) => {
    const email = uniqueEmail('ac4-plan30');
    const fullName = `AC4-${Date.now()}`;
    await createUserViaApi(email, fullName);

    const dialog = await openUserEditDialog(page, email);
    await dialog.getByRole('textbox', { name: '연락처' }).clear();
    await dialog.getByRole('textbox', { name: '연락처' }).fill('01098765432');
    await dialog.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('사용자 정보가 저장되었습니다.')).toBeVisible();

    const profileDialog = page.getByRole('dialog', { name: new RegExp(fullName) });
    await expect(profileDialog.getByText('010-9876-5432')).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: email })
        .getByRole('cell', { name: '010-9876-5432' })
    ).toBeVisible();
  });

  test('AC-5 plan30: legacy NULL 연락처 사용자에게 연락처 입력 후 저장된다', async ({
    page
  }) => {
    const email = uniqueEmail('ac5-plan30');
    const fullName = `AC5-${Date.now()}`;
    const userId = await createUserViaApi(email, fullName);
    await setProfilePhoneNull(userId);

    await page.goto('/dashboard/users');
    await page.reload();

    const dialog = await openUserEditDialog(page, email);
    await expect(dialog.getByRole('textbox', { name: '연락처' })).toHaveValue('');
    await dialog.getByRole('textbox', { name: '연락처' }).fill('01055556666');
    await dialog.getByRole('button', { name: '저장' }).click();

    await expect(page.getByText('사용자 정보가 저장되었습니다.')).toBeVisible({
      timeout: 30_000
    });

    const profileDialog = page.getByRole('dialog', { name: new RegExp(fullName) });
    await expect(profileDialog.getByText('010-5555-6666')).toBeVisible();
  });

});
