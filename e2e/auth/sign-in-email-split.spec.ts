import { expect, test } from '@playwright/test';
import { resolveE2EPassword } from '../helpers/e2e-credentials';

test.use({ storageState: { cookies: [], origins: [] } });

function parseE2EUserEmail() {
  const email = process.env.E2E_USER_EMAIL;
  test.skip(!email, 'E2E_USER_EMAIL required');

  const atIndex = email!.indexOf('@');
  test.skip(atIndex <= 0, 'E2E_USER_EMAIL must contain @');

  return {
    localPart: email!.slice(0, atIndex),
    domain: email!.slice(atIndex + 1),
    password: resolveE2EPassword(process.env.E2E_USER_PASSWORD)
  };
}

async function gotoSignIn(page: import('@playwright/test').Page) {
  await page.goto('/auth/sign-in');
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
}

async function selectDomain(page: import('@playwright/test').Page, domain: string) {
  await page.getByTestId('login-domain-combobox').click();
  const presetOption = page.getByRole('option', { name: domain, exact: true });
  if (await presetOption.isVisible()) {
    await presetOption.click();
    return;
  }

  await page.getByPlaceholder('도메인 검색 또는 입력…').fill(domain);
  await page.getByRole('option', { name: `「${domain}」 사용` }).click();
}

test.describe('로그인 이메일 분리 입력', () => {
  test('AC-1: 로그인 페이지에 분리 필드와 기본 도메인이 표시된다', async ({ page }) => {
    await gotoSignIn(page);

    await expect(page.getByRole('textbox', { name: '아이디' })).toBeVisible();
    await expect(page.getByTestId('login-domain-combobox')).toBeVisible();
    await expect(page.getByTestId('login-domain-combobox')).toContainText('wakecorp.com');
  });

  test('AC-2: 로컬 파트에 @ 입력이 차단된다', async ({ page }) => {
    await gotoSignIn(page);

    const localInput = page.getByRole('textbox', { name: '아이디' });
    await localInput.fill('user@name');
    await expect(localInput).toHaveValue('username');
  });

  test('AC-3: 로컬 파트 비움 시 필수 에러가 표시된다', async ({ page }) => {
    await gotoSignIn(page);

    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page.getByText('이메일을 입력해 주세요.')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('AC-4: 올바른 자격 증명으로 로그인에 성공한다', async ({ page }) => {
    const { localPart, domain, password } = parseE2EUserEmail();

    await gotoSignIn(page);

    await page.getByRole('textbox', { name: '아이디' }).fill(localPart);
    if (domain !== 'wakecorp.com') {
      await selectDomain(page, domain);
    }
    await page.getByPlaceholder('비밀번호를 입력하세요').fill(password);
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page.getByText('로그인되었습니다.')).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/overview/, { timeout: 30_000 });
  });

  test('AC-5: 잘못된 자격 증명 시 실패 토스트가 표시된다', async ({ page }) => {
    await gotoSignIn(page);

    await page.getByRole('textbox', { name: '아이디' }).fill('not-a-valid-local');
    await page.getByPlaceholder('비밀번호를 입력하세요').fill('wrong-password-123');
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(
      page.getByText('이메일 또는 비밀번호가 올바르지 않습니다.')
    ).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('AC-6: 도메인 Combobox에서 gmail.com을 선택할 수 있다', async ({ page }) => {
    await gotoSignIn(page);

    await page.getByTestId('login-domain-combobox').click();
    await page.getByRole('option', { name: 'gmail.com', exact: true }).click();

    await expect(page.getByTestId('login-domain-combobox')).toContainText('gmail.com');
  });

  test('AC-7: Combobox free text로 임의 도메인을 입력할 수 있다', async ({ page }) => {
    await gotoSignIn(page);

    await selectDomain(page, 'example.co.kr');

    await expect(page.getByTestId('login-domain-combobox')).toContainText('example.co.kr');
  });

  test('AC-8: 잘못된 조합 이메일 형식 시 검증 에러가 표시된다', async ({ page }) => {
    await gotoSignIn(page);

    await page.getByRole('textbox', { name: '아이디' }).fill('ab');
    await selectDomain(page, 'not..valid');
    await page.getByPlaceholder('비밀번호를 입력하세요').fill('any-password');
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page.getByText('올바른 이메일 주소를 입력해 주세요.')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('AC-9: 로그인 성공 직후 폼 입력값이 초기화된다', async ({ page }) => {
    const { localPart, domain, password } = parseE2EUserEmail();

    await gotoSignIn(page);

    await page.getByRole('textbox', { name: '아이디' }).fill(localPart);
    if (domain !== 'wakecorp.com') {
      await selectDomain(page, domain);
    }
    await page.getByPlaceholder('비밀번호를 입력하세요').fill(password);
    await page.getByRole('button', { name: '로그인' }).click();

    await expect(page.getByText('로그인되었습니다.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: '아이디' })).toHaveValue('');
    await expect(page.getByPlaceholder('비밀번호를 입력하세요')).toHaveValue('');
  });

  test('AC-10: 모바일 viewport에서 로그인 CTA가 접근 가능하다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSignIn(page);

    await expect(page.getByRole('textbox', { name: '아이디' })).toBeVisible();
    await expect(page.getByTestId('login-domain-combobox')).toBeVisible();
    await expect(page.getByPlaceholder('비밀번호를 입력하세요')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });
});
