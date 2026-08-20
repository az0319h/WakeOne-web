import {
  expect,
  test,
  type Browser,
  type Page
} from '@playwright/test';
import { createAdminRequest, e2eBaseURL } from '../helpers/auth-request';

const INITIAL_PASSWORD = '12341234a';
const NEW_PASSWORD = 'NewPass123';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const E2E_TEST_PHONE = '01012345678';

function createUserPayload(email: string, fullName = 'E2E ForceChange') {
  return {
    email,
    full_name: fullName,
    affiliation: 'wake',
    rank: '경영진',
    system_role: 'user',
    birthday: '1990-01-01',
    phone: E2E_TEST_PHONE
  };
}

async function createUserViaApi(
  playwright: { request: { newContext: (options: Record<string, unknown>) => Promise<import('@playwright/test').APIRequestContext> } },
  email: string
) {
  const adminRequest = await createAdminRequest(playwright);
  const guestRequest = await playwright.request.newContext({
    baseURL: e2eBaseURL,
    storageState: { cookies: [], origins: [] }
  });

  try {
    await expect
      .poll(async () => {
        const response = await adminRequest.post('/api/users', {
          data: createUserPayload(email)
        });
        return response.status();
      }, { timeout: 30_000 })
      .toBe(201);

    await expect
      .poll(async () => {
        const signInResponse = await guestRequest.post('/api/auth/sign-in', {
          data: { email, password: INITIAL_PASSWORD }
        });
        if (signInResponse.status() !== 200) {
          return null;
        }
        const body = (await signInResponse.json()) as { mustChange?: boolean };
        return body.mustChange === true ? true : null;
      }, { timeout: 30_000 })
      .toBe(true);
  } finally {
    await guestRequest.dispose();
    await adminRequest.dispose();
  }
  return email;
}

async function withGuestPage(
  browser: Browser,
  run: (page: Page) => Promise<void>
) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] }
  });
  const page = await context.newPage();

  try {
    await run(page);
  } finally {
    await context.close();
  }
}

async function fillSignInCredentials(page: Page, email: string, password: string) {
  const atIndex = email.indexOf('@');
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  await page.getByRole('textbox', { name: '아이디' }).fill(localPart);

  if (domain !== 'wakecorp.com') {
    await page.getByTestId('login-domain-combobox').click();
    await page.getByPlaceholder('도메인 검색 또는 입력…').fill(domain);
    await page.getByRole('option', { name: `「${domain}」 사용` }).click();
  }

  await page.getByPlaceholder('비밀번호를 입력하세요').fill(password);
}

async function signInWithInitialPassword(page: Page, email: string) {
  await page.goto('/auth/sign-in');
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  await fillSignInCredentials(page, email, INITIAL_PASSWORD);

  await Promise.all([
    page.waitForURL(/\/auth\/force-password-change/, { timeout: 30_000 }),
    page.getByRole('button', { name: '로그인' }).click()
  ]);
}

async function signInExpectDashboard(page: Page, email: string, password: string) {
  await expect
    .poll(async () => {
      await fillSignInCredentials(page, email, password);

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/auth/sign-in') &&
          response.request().method() === 'POST',
        { timeout: 20_000 }
      );

      await page.getByRole('button', { name: '로그인' }).click();
      const signInResponse = await responsePromise;
      if (signInResponse.status() !== 200) {
        return null;
      }

      const body = (await signInResponse.json()) as {
        success?: boolean;
        mustChange?: boolean;
      };
      if (!body.success || body.mustChange) {
        return null;
      }

      try {
        await page.waitForURL(/\/dashboard\/overview/, { timeout: 15_000 });
      } catch {
        // Client navigation may lag behind the API response.
      }

      return page.url().includes('/dashboard/overview') ? page.url() : null;
    }, { timeout: 60_000, intervals: [1500] })
    .toMatch(/\/dashboard\/overview/);

  await expect(page).not.toHaveURL(/\/auth\/force-password-change/);
}

async function submitForcePasswordChange(page: Page, newPassword: string, confirmPassword?: string) {
  await page.getByTestId('force-password-new').fill(newPassword);
  await page.getByTestId('force-password-confirm').fill(confirmPassword ?? newPassword);
  await page.getByTestId('force-password-submit').click();
}

test.describe('초기 비밀번호 강제 변경', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);

  test('AC-1: 초기 비밀번호 로그인 시 force-change 페이지와 안내가 표시된다', async ({
    browser,
    playwright
  }) => {
    const email = uniqueEmail('ac1-force');
    await createUserViaApi(playwright, email);

    await withGuestPage(browser, async (page) => {
      await signInWithInitialPassword(page, email);

      await expect(page.getByRole('heading', { name: '비밀번호 변경' })).toBeVisible({
        timeout: 30_000
      });
      await expect(page.getByTestId('force-password-change-alert')).toContainText(
        '12341234a 비밀번호는 사용할 수 없습니다. 비밀번호를 변경해 주세요'
      );
    });
  });

  test('AC-2: force-change 상태에서 /dashboard/overview 접근이 차단된다', async ({
    browser,
    playwright
  }) => {
    const email = uniqueEmail('ac2-force');
    await createUserViaApi(playwright, email);

    await withGuestPage(browser, async (page) => {
      await signInWithInitialPassword(page, email);

      await page.goto('/dashboard/overview');
      await expect(page).toHaveURL(/\/auth\/force-password-change/, { timeout: 15_000 });
      await expect(page.getByRole('heading', { name: '개요' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: '비밀번호 변경' })).toBeVisible();
    });
  });

  test('AC-3: force-change 상태에서 /dashboard/users 접근이 차단된다', async ({
    browser,
    playwright
  }) => {
    const email = uniqueEmail('ac3-force');
    await createUserViaApi(playwright, email);

    await withGuestPage(browser, async (page) => {
      await signInWithInitialPassword(page, email);

      await page.goto('/dashboard/users');
      await expect(page).toHaveURL(/\/auth\/force-password-change/, { timeout: 15_000 });
      await expect(page.getByRole('heading', { name: '사용자 관리' })).toHaveCount(0);
    });
  });

  test('AC-5: 새 비밀번호로 12341234a를 사용하면 validation 에러가 표시된다', async ({
    browser,
    playwright
  }) => {
    const email = uniqueEmail('ac5-force');
    await createUserViaApi(playwright, email);

    await withGuestPage(browser, async (page) => {
      await signInWithInitialPassword(page, email);
      await submitForcePasswordChange(page, INITIAL_PASSWORD, INITIAL_PASSWORD);

      await expect(
        page.locator('[data-slot="form-message"]').filter({
          hasText: '12341234a 비밀번호는 사용할 수 없습니다. 비밀번호를 변경해 주세요'
        })
      ).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/force-password-change/);
    });
  });

  test('AC-6: 정책 충족 새 비밀번호 변경 성공 시 sign-in으로 이동한다', async ({
    browser,
    playwright
  }) => {
    test.setTimeout(60_000);
    const email = uniqueEmail('ac6-force');
    await createUserViaApi(playwright, email);

    await withGuestPage(browser, async (page) => {
      await signInWithInitialPassword(page, email);
      await submitForcePasswordChange(page, NEW_PASSWORD);

      await expect(page.getByText('비밀번호가 변경되었습니다. 다시 로그인해 주세요.')).toBeVisible({
        timeout: 30_000
      });
      await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 30_000 });
    });
  });

  test('AC-7: 비밀번호 변경 후 새 비밀번호로 대시보드에 진입한다', async ({
    browser,
    playwright
  }) => {
    test.setTimeout(60_000);
    const email = uniqueEmail('ac7-force');
    const newPassword = `Changed${Date.now()}a1`;
    await createUserViaApi(playwright, email);

    await withGuestPage(browser, async (page) => {
      await signInWithInitialPassword(page, email);
      await submitForcePasswordChange(page, newPassword);

      await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 30_000 });
      await signInExpectDashboard(page, email, newPassword);
    });
  });

  test('AC-8: 비로그인 상태에서 force-change 페이지 접근 시 sign-in으로 redirect', async ({
    browser
  }) => {
    await withGuestPage(browser, async (page) => {
      await page.goto('/auth/force-password-change');
      await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15_000 });
    });
  });

  test('AC-9: 비밀번호 변경 완료 계정은 force-change redirect 없이 로그인한다', async ({
    browser,
    playwright
  }) => {
    test.setTimeout(90_000);
    const email = uniqueEmail('ac9-force');
    const newPassword = `Stable${Date.now()}b2`;
    await createUserViaApi(playwright, email);

    await withGuestPage(browser, async (page) => {
      await signInWithInitialPassword(page, email);
      await submitForcePasswordChange(page, newPassword);

      await expect(page.getByText('비밀번호가 변경되었습니다. 다시 로그인해 주세요.')).toBeVisible({
        timeout: 30_000
      });
      await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 30_000 });
      await signInExpectDashboard(page, email, newPassword);
    });
  });
});
