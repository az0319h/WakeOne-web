import { expect, test } from '@playwright/test';
import { birthdaySelectTriggers } from '../helpers/birthday-select';
import { waitForDashboardPresenceReady } from '../live-users/helpers';
import { fillProvisionSheet, uniqueEmail } from './helpers';

test.describe('dev 사용자 사전 등록 UI (plan 70)', () => {
  test.setTimeout(90_000);

  test('AC-07: dev 환경 admin users 페이지에 사용자 추가 버튼이 보인다', async ({
    page
  }) => {
    await page.goto('/dashboard/users');
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByRole('button', { name: '사용자 추가' })).toBeVisible();
  });

  test('AC-09: 필수 필드 비우고 제출하면 필드 오류·제출 차단', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page.getByRole('button', { name: '사용자 추가' })).toBeVisible({
      timeout: 30_000
    });

    await page.getByRole('button', { name: '사용자 추가' }).click();
    const sheet = page.getByRole('dialog').filter({ hasText: '사용자 추가' });
    await expect(sheet).toBeVisible();

    await sheet.getByTestId('user-provision-submit').click();

    await expect(sheet.getByText('올바른 이메일 주소를 입력해 주세요.')).toBeVisible();
    await expect(sheet.getByText('이름을 입력해 주세요.')).toBeVisible();
    await expect(sheet.getByText('연락처를 입력해 주세요.')).toBeVisible();
    await expect(page.getByText('사용자가 추가되었습니다.')).toHaveCount(0);
  });

  test('AC-10: 유효 입력 제출 후 toast·목록 갱신', async ({ page }) => {
    const email = uniqueEmail('ac10-provision');
    const fullName = `E2E AC10 ${Date.now()}`;

    await page.goto('/dashboard/users');
    await expect(page.getByRole('button', { name: '사용자 추가' })).toBeVisible({
      timeout: 30_000
    });

    await page.getByRole('button', { name: '사용자 추가' }).click();
    const sheet = page.getByRole('dialog').filter({ hasText: '사용자 추가' });
    await expect(sheet).toBeVisible();

    await fillProvisionSheet(page, sheet, { email, fullName });
    await sheet.getByTestId('user-provision-submit').click();

    await expect(page.getByText('사용자가 추가되었습니다.')).toBeVisible({
      timeout: 15_000
    });

    const row = page.getByRole('row').filter({ hasText: email });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('활성')).toBeVisible();
    await expect(row.getByText(fullName)).toBeVisible();
  });

  test('AC-11: 생일 미설정 ON 상태로 제출하면 birthday null 저장', async ({ page }) => {
    const email = uniqueEmail('ac11-provision');
    const fullName = `E2E AC11 ${Date.now()}`;

    await page.goto('/dashboard/users');
    await expect(page.getByRole('button', { name: '사용자 추가' })).toBeVisible({
      timeout: 30_000
    });

    await page.getByRole('button', { name: '사용자 추가' }).click();
    const sheet = page.getByRole('dialog').filter({ hasText: '사용자 추가' });
    await expect(sheet).toBeVisible();

    await fillProvisionSheet(page, sheet, { email, fullName, birthdayUnset: true });
    await expect(sheet.getByRole('button', { name: '미설정' })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 10_000 }
    );
    await expect(birthdaySelectTriggers(sheet).year).toBeDisabled();

    await sheet.getByTestId('user-provision-submit').click();
    await expect(page.getByText('사용자가 추가되었습니다.')).toBeVisible({
      timeout: 15_000
    });

    await page.goto(`/dashboard/users?name=${encodeURIComponent(fullName)}`);
    const row = page.getByRole('row').filter({ hasText: fullName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByRole('cell', { name: '—', exact: true }).first()).toBeVisible();
  });

  test('AC-15: users 페이지는 dashboard layout DashboardPresenceTrack을 상속한다', async ({
    page
  }) => {
    await page.goto('/dashboard/users');
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible({
      timeout: 30_000
    });
    await waitForDashboardPresenceReady(page);
  });
});
