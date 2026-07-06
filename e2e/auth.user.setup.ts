import { expect, test } from '@playwright/test';

const userAuthFile = 'e2e/.auth/user.json';

test('authenticate as user', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set before running E2E tests.'
    );
  }

  await page.goto('/auth/sign-in');
  await page.getByPlaceholder('이메일을 입력하세요').fill(email);
  await page.getByPlaceholder('비밀번호를 입력하세요').fill(password);
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await page.context().storageState({ path: userAuthFile });
});
