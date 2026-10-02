import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

async function gotoSignIn(page: import('@playwright/test').Page, query = '') {
  await page.goto(`/auth/sign-in${query}`);
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
}

test.describe('Google 로그인 전용 sign-in', () => {
  test('AC-12: 이메일/비밀번호 input과 비밀번호 찾기 링크가 없고 Google CTA가 보인다', async ({
    page
  }) => {
    await gotoSignIn(page);

    await expect(page.getByRole('link', { name: 'Google로 로그인' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '아이디' })).toHaveCount(0);
    await expect(page.getByPlaceholder('비밀번호를 입력하세요')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /비밀번호 찾기/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '로그인' })).toHaveCount(0);
  });

  test('AC-03: authStatus=pending_approval toast가 표시된다', async ({ page }) => {
    await gotoSignIn(page, '?authStatus=pending_approval');

    await expect(
      page.getByText('관리자 승인 대기 중입니다. 승인 완료 후 로그인할 수 있습니다.')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('AC-04: authStatus=rejected toast가 표시된다', async ({ page }) => {
    await gotoSignIn(page, '?authStatus=rejected');

    await expect(
      page.getByText('가입 요청이 거절되었습니다. 관리자에게 문의해 주세요.')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('AC-05: accountDisabled=1 toast가 표시된다', async ({ page }) => {
    await gotoSignIn(page, '?accountDisabled=1');

    await expect(
      page.getByRole('region', { name: 'Notifications alt+T' }).getByText('비활성화된 계정입니다.')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('AC-05b: Supabase user_banned hash에서도 비활성 toast가 표시된다', async ({ page }) => {
    await page.goto(
      '/auth/sign-in?authError=google_oauth_denied#error=access_denied&error_code=user_banned&error_description=User+is+banned'
    );
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();

    await expect(
      page.getByRole('region', { name: 'Notifications alt+T' }).getByText('비활성화된 계정입니다.')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('AC-18: pending/rejected 전용 dashboard 페이지 UI가 없다', async ({ page }) => {
    for (const path of ['/dashboard/pending', '/dashboard/pending-approval', '/dashboard/rejected']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: /승인 대기 대시보드|가입 승인 현황/ })).toHaveCount(0);
      await expect(page.getByText(/관리자 승인을 기다리는 전용 페이지/)).toHaveCount(0);
    }
  });
});
