import { expect, test } from '@playwright/test';
import {
  birthdaySelectTriggers,
  fillBirthday
} from '../helpers/birthday-select';
import { createPendingGoogleUser } from '../helpers/supabase-direct-auth';

test.describe('Users admin pending actions', () => {
  test.setTimeout(60_000);

  test('AC-07: pending 행은 수락/거절만 보이고 수정/비활성화/활성화는 없다', async ({ page }) => {
    const pending = await createPendingGoogleUser('ac07-users');
    const googleEmail = pending.email;

    await page.goto(
      `/dashboard/users?status=pending_approval&name=${encodeURIComponent(googleEmail.split('@')[0])}`
    );
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible({
      timeout: 30_000
    });

    const row = page.getByRole('row').filter({ hasText: googleEmail });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('승인 대기')).toBeVisible();

    await expect(row.getByRole('button', { name: '수락' })).toBeVisible();
    await expect(row.getByRole('button', { name: '거절' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Open menu' })).toHaveCount(0);

  });

  test('AC-08 UI: pending 사용자 수락 Sheet 제출 후 active로 갱신', async ({ page }) => {
    const pending = await createPendingGoogleUser('ac08-users');
    const fullName = `E2E UI 승인 ${Date.now()}`;

    await page.goto(
      `/dashboard/users?status=pending_approval&name=${encodeURIComponent(pending.email.split('@')[0])}`
    );
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible({
      timeout: 30_000
    });

    const row = page.getByRole('row').filter({ hasText: pending.email });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: '수락' }).click({ force: true });

    const sheet = page.getByRole('dialog').filter({ hasText: '가입 요청 승인' });
    await expect(sheet).toBeVisible();

    await sheet.getByRole('textbox', { name: '이름' }).fill(fullName);
    await sheet.getByRole('textbox', { name: '연락처' }).fill('01012345678');
    await sheet.getByRole('combobox', { name: '소속' }).click();
    await page.getByRole('option', { name: '웨이크', exact: true }).click();
    await sheet.getByRole('combobox', { name: '부서/사업장' }).click();
    await page.getByRole('option', { name: '경영진', exact: true }).click();
    await sheet.getByRole('combobox', { name: '시스템 역할' }).click();
    await page.getByRole('option', { name: 'User', exact: true }).click();

    await sheet.getByRole('button', { name: '미설정' }).click();

    await fillBirthday(page, sheet, {
      year: '1990년',
      month: '1월',
      day: '1일'
    });

    await sheet.getByRole('button', { name: '승인' }).click();

    await expect(page.getByText('사용자가 승인되었습니다.')).toBeVisible({ timeout: 15_000 });

    await page.goto(`/dashboard/users?name=${encodeURIComponent(fullName)}`);
    const approvedRow = page.getByRole('row').filter({ hasText: fullName });
    await expect(approvedRow).toBeVisible({ timeout: 15_000 });
    await expect(approvedRow.getByText('활성')).toBeVisible();
  });

  test('AC-01 plan58 UI: 생일 미설정 상태로 승인할 수 있다', async ({ page }) => {
    const pending = await createPendingGoogleUser('ac01-plan58-ui');
    const fullName = `E2E 미설정 승인 ${Date.now()}`;

    await page.goto(
      `/dashboard/users?status=pending_approval&name=${encodeURIComponent(pending.email.split('@')[0])}`
    );
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible({
      timeout: 30_000
    });

    const row = page.getByRole('row').filter({ hasText: pending.email });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: '수락' }).click({ force: true });

    const sheet = page.getByRole('dialog').filter({ hasText: '가입 요청 승인' });
    await expect(sheet).toBeVisible();

    await sheet.getByRole('textbox', { name: '이름' }).fill(fullName);
    await sheet.getByRole('textbox', { name: '연락처' }).fill('01012345678');
    await sheet.getByRole('combobox', { name: '소속' }).click();
    await page.getByRole('option', { name: '웨이크', exact: true }).click();
    await sheet.getByRole('combobox', { name: '부서/사업장' }).click();
    await page.getByRole('option', { name: '경영진', exact: true }).click();
    await sheet.getByRole('combobox', { name: '시스템 역할' }).click();
    await page.getByRole('option', { name: 'User', exact: true }).click();

    await expect(sheet.getByRole('button', { name: '미설정' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(birthdaySelectTriggers(sheet).year).toBeDisabled();

    await sheet.getByRole('button', { name: '승인' }).click();
    await expect(page.getByText('사용자가 승인되었습니다.')).toBeVisible({ timeout: 15_000 });

    await page.goto(`/dashboard/users?name=${encodeURIComponent(fullName)}`);
    const approvedRow = page.getByRole('row').filter({ hasText: fullName });
    await expect(approvedRow).toBeVisible({ timeout: 15_000 });
    await expect(approvedRow.getByText('활성')).toBeVisible();
    await expect(approvedRow.getByRole('cell', { name: '—', exact: true }).first()).toBeVisible();
  });
});
