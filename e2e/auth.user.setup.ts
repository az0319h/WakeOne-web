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

  await page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 15_000 });

  const emailField = page.getByRole('textbox', { name: '이메일' });
  const passwordField = page.getByRole('textbox', { name: '비밀번호' });

  await emailField.click();
  await emailField.clear();
  await emailField.pressSequentially(email, { delay: 15 });
  await passwordField.click();
  await passwordField.clear();
  await passwordField.pressSequentially(password, { delay: 15 });

  await expect(emailField).toHaveValue(email);
  await expect(passwordField).toHaveValue(password);

  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await page.context().storageState({ path: userAuthFile });
});
