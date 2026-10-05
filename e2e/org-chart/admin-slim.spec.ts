import { expect, test } from '@playwright/test';
import {
  createOrgChartTestUser,
  fetchUserProfile
} from '../helpers/org-chart';
import { createPendingGoogleUser } from '../helpers/supabase-direct-auth';

test.describe('admin 프로필·Users 슬림화', () => {
  test.setTimeout(90_000);

  test('AC-12: admin 프로필은 아바타·이메일·이름(read-only)만', async ({ page }) => {
    await page.goto('/dashboard/profile');

    await expect(page.getByText('관리자 계정의 기본 정보입니다.')).toBeVisible();
    await expect(page.getByText('이메일', { exact: true })).toBeVisible();
    await expect(page.getByText('이름', { exact: true })).toBeVisible();

    await expect(page.getByText('소속', { exact: true })).toHaveCount(0);
    await expect(page.getByText('부서/사업장', { exact: true })).toHaveCount(0);
    await expect(page.getByText('연락처', { exact: true })).toHaveCount(0);
    await expect(page.getByText('생일', { exact: true })).toHaveCount(0);
    await expect(page.getByText('직급', { exact: true })).toHaveCount(0);
    await expect(page.getByText('리더 역할', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '계정 정보' })).toHaveCount(0);
  });

  test('AC-13: admin 대상 수정 Sheet는 아바타 URL·시스템 역할만', async ({ page }) => {
    const adminTarget = await createOrgChartTestUser('ac13-admin', {
      fullName: `E2E AC13 Admin ${Date.now()}`,
      system_role: 'admin',
      rank: null,
      position_level: null
    });

    await page.goto(
      `/dashboard/users?name=${encodeURIComponent(adminTarget.fullName)}`
    );
    await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible({
      timeout: 30_000
    });

    const row = page.getByRole('row').filter({ hasText: adminTarget.fullName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: '수정' }).click();

    const sheet = page.getByRole('dialog', { name: '사용자 수정' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('관리자 계정의 아바타 URL과 시스템 역할만')).toBeVisible();

    await expect(sheet.getByRole('textbox', { name: '아바타 URL' })).toBeVisible();
    await expect(sheet.getByRole('combobox', { name: '시스템 역할' })).toBeVisible();
    await expect(sheet.getByRole('textbox', { name: '이름' })).toHaveCount(0);
    await expect(sheet.getByText('소속', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('부서/사업장', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('연락처', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('생일', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('직급', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('리더 역할', { exact: true })).toHaveCount(0);
  });

  test('AC-14: pending admin 승인 Sheet에서 org·직급·리더·생일 숨김', async ({
    page
  }) => {
    const pending = await createPendingGoogleUser('ac14-admin');

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

    await sheet.getByRole('combobox', { name: '시스템 역할' }).click();
    await page.getByRole('option', { name: 'Admin', exact: true }).click();

    await expect(sheet.getByText('소속', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('부서/사업장', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('직급', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('리더 역할', { exact: true })).toHaveCount(0);
    await expect(sheet.getByText('생일', { exact: true })).toHaveCount(0);
  });

  test('VAL-01/VAL-02: user 승인 시 직급 미선택이면 승인되지 않는다', async ({ page }) => {
    const pending = await createPendingGoogleUser('val02-position');
    const fullName = `E2E VAL02 ${Date.now()}`;

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
    await sheet.getByRole('textbox', { name: '이름' }).fill(fullName);
    await sheet.getByRole('textbox', { name: '연락처' }).fill('01012345678');
    await sheet.getByRole('combobox', { name: '소속' }).click();
    await page.getByRole('option', { name: '웨이크', exact: true }).click();
    await sheet.getByRole('combobox', { name: '부서/사업장' }).click();
    await page.getByRole('option', { name: '마케팅팀', exact: true }).click();
    await sheet.getByRole('combobox', { name: '시스템 역할' }).click();
    await page.getByRole('option', { name: 'User', exact: true }).click();
    await sheet.getByRole('button', { name: '미설정' }).click();

    await sheet.getByRole('button', { name: '승인' }).click();
    await expect(sheet.getByText('직급을 선택해 주세요.')).toBeVisible();
    await expect(page.getByText('사용자가 승인되었습니다.')).toHaveCount(0);
  });

  test('VAL-04: pending admin 승인 Sheet에 직급 필드 없음·승인 성공', async ({
    page,
    request
  }) => {
    const pending = await createPendingGoogleUser('val04-admin');
    const fullName = `E2E VAL04 Admin ${Date.now()}`;

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
    await sheet.getByRole('textbox', { name: '이름' }).fill(fullName);
    await sheet.getByRole('textbox', { name: '연락처' }).fill('01012345678');
    await sheet.getByRole('combobox', { name: '시스템 역할' }).click();
    await page.getByRole('option', { name: 'Admin', exact: true }).click();
    await expect(sheet.getByText('직급', { exact: true })).toHaveCount(0);

    await sheet.getByRole('button', { name: '승인' }).click();
    await expect(page.getByText('사용자가 승인되었습니다.')).toBeVisible({
      timeout: 15_000
    });

    const profile = await fetchUserProfile(request, pending.userId);
    expect(profile?.system_role).toBe('admin');
    expect(profile?.affiliation).toBeNull();
    expect(profile?.rank).toBeNull();
    expect(profile?.position_level).toBeNull();
    expect(profile?.leader_role).toBeNull();
  });

  test('RANK-01: user 승인 Sheet rank Select에 경영진 옵션 없음', async ({ page }) => {
    const pending = await createPendingGoogleUser('rank01');

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
    await sheet.getByRole('combobox', { name: '소속' }).click();
    await page.getByRole('option', { name: '웨이크', exact: true }).click();
    await sheet.getByRole('combobox', { name: '부서/사업장' }).click();

    await expect(page.getByRole('option', { name: '경영진', exact: true })).toHaveCount(0);
    await expect(page.getByRole('option', { name: '마케팅팀', exact: true })).toBeVisible();
  });
});
