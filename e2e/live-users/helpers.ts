import fs from 'node:fs';
import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page
} from '@playwright/test';
import {
  createAdminRequest,
  e2eBaseURL,
  normalizePlaywrightStorageState,
  readNormalizedStorageState
} from '../helpers/auth-request';

export { createAdminRequest } from '../helpers/auth-request';
import { resolveE2EPassword } from '../helpers/e2e-credentials';
import { authenticateStorageState } from '../helpers/supabase-auth-storage';
import { uniqueEmail } from '../notifications/helpers';

export interface E2EUserProfile {
  id: string;
  email: string;
  full_name: string;
}

export function liveUsersCard(page: Page) {
  return page.getByTestId('live-users-card');
}

async function waitForDevCompilation(page: Page, timeout = 120_000) {
  await expect
    .poll(async () => page.evaluate(() => !document.body.innerText.includes('Compiling')), {
      timeout
    })
    .toBe(true);
}

export async function waitForDashboardPresenceReady(page: Page, timeout = 90_000) {
  await waitForDevCompilation(page, timeout);

  await expect
    .poll(
      async () =>
        page.evaluate(() => document.documentElement.dataset.presenceSynced === 'true'),
      { timeout }
    )
    .toBe(true);
}

export async function resolveUserProfileByEmail(
  request: APIRequestContext,
  email: string
): Promise<E2EUserProfile> {
  const response = await request.get(
    `/api/users?search=${encodeURIComponent(email)}&limit=5`
  );
  expect(response.status()).toBe(200);

  const body = (await response.json()) as {
    users?: Array<{ id: string; email: string; full_name: string }>;
  };
  const user = body.users?.find((item) => item.email === email);
  expect(user?.id).toBeTruthy();
  return user!;
}

export async function waitForLiveUsersSynced(card: Locator, timeout = 45_000) {
  await card.scrollIntoViewIfNeeded().catch(() => {});

  await expect
    .poll(async () => card.getAttribute('data-synced'), { timeout })
    .toBe('true');
}

export async function waitForLiveUsersWithNames(
  card: Locator,
  names: string[],
  timeout = 60_000
) {
  await waitForLiveUsersSynced(card, timeout);

  for (const name of names) {
    await expect(card.getByText(name, { exact: true })).toBeVisible({ timeout });
  }
}

export async function readLiveUsersDescriptionCount(card: Locator) {
  const text = await card.getByTestId('live-users-description').textContent();
  const match = text?.match(/(\d+)명이 접속 중입니다/);
  return match ? Number(match[1]) : 0;
}

export async function waitForLiveUsersCount(
  card: Locator,
  count: number,
  timeout = 60_000
) {
  await card.scrollIntoViewIfNeeded();

  await expect
    .poll(async () => {
      const synced = await card.getAttribute('data-synced');
      const text = await card.innerText();

      if (count === 0) {
        return synced === 'true' && text.includes('현재 접속 중인 사용자가 없습니다');
      }

      const match = text.match(/(\d+)명이 접속 중입니다/);
      return synced === 'true' && match ? Number(match[1]) === count : false;
    }, { timeout })
    .toBe(true);
}

export async function waitForLiveUsersMinCount(
  card: Locator,
  minCount: number,
  timeout = 60_000
) {
  await waitForLiveUsersSynced(card, timeout);

  await expect
    .poll(async () => {
      const text = await card.innerText();
      const match = text.match(/(\d+)명이 접속 중입니다/);
      return match ? Number(match[1]) : 0;
    }, { timeout })
    .toBeGreaterThanOrEqual(minCount);
}

/** Shared Realtime channel may include non-E2E sessions — assert E2E profiles are listed. */
export async function waitForLiveUsersIncludeProfiles(
  card: Locator,
  profiles: E2EUserProfile[],
  timeout = 60_000
) {
  await card.scrollIntoViewIfNeeded();
  await waitForLiveUsersSynced(card, timeout);

  await expect
    .poll(async () => {
      const synced = await card.getAttribute('data-synced');
      if (synced !== 'true') {
        return false;
      }

      for (const profile of profiles) {
        if ((await card.getByTestId(`live-user-${profile.id}`).count()) === 0) {
          return false;
        }
      }

      return true;
    }, { timeout })
    .toBe(true);
}

function normalizeStorageStateForBrowser(
  storageState: Awaited<ReturnType<APIRequestContext['storageState']>>,
  baseURL: string
) {
  return normalizePlaywrightStorageState(storageState, baseURL);
}

async function mirrorAuthCookiesForAlternateHost(context: BrowserContext, baseURL: string) {
  const cookies = await context.cookies(baseURL);
  const alternateBaseURL = baseURL.includes('localhost')
    ? baseURL.replace('localhost', '127.0.0.1')
    : baseURL.replace('127.0.0.1', 'localhost');
  const alternateDomain = new URL(alternateBaseURL).hostname;
  const mirrored = cookies
    .filter((cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token'))
    .map((cookie) => ({ ...cookie, domain: alternateDomain }));

  if (mirrored.length > 0) {
    await context.addCookies(mirrored);
  }
}

export async function openDashboardContext(
  browser: Browser,
  storageState: string,
  path = '/dashboard/overview'
) {
  const baseURL = e2eBaseURL;
  const context = await browser.newContext({
    storageState: readNormalizedStorageState(storageState),
    baseURL
  });
  await mirrorAuthCookiesForAlternateHost(context, baseURL);
  const page = await context.newPage();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await waitForDevCompilation(page);

    if (/\/dashboard/.test(page.url())) {
      break;
    }

    if (attempt === 3) {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });
    }
  }

  await waitForDashboardPresenceReady(page);

  if (path.includes('/dashboard/overview')) {
    const card = liveUsersCard(page);
    await expect(card).toBeVisible({ timeout: 45_000 });
    await card.scrollIntoViewIfNeeded();
  }

  return { context, page };
}

interface OpenAuthenticatedDashboardContextOptions {
  waitPresence?: boolean;
}

export async function openAuthenticatedDashboardContext(
  browser: Browser,
  email: string,
  password: string,
  path = '/dashboard/overview',
  options: OpenAuthenticatedDashboardContextOptions = {}
) {
  const { waitPresence = true } = options;
  const baseURL = e2eBaseURL;
  const apiContext = await playwrightRequest.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] }
  });

  try {
    await expect
      .poll(async () => {
        try {
          const signInResponse = await apiContext.post('/api/auth/sign-in', {
            data: { email, password }
          });
          if (signInResponse.status() !== 200) {
            return null;
          }
          const body = (await signInResponse.json()) as { mustChange?: boolean };
          return body.mustChange ? null : true;
        } catch {
          return null;
        }
      }, { timeout: 90_000, intervals: [2_000] })
      .toBe(true);

    const probeResponse = await apiContext.get('/api/notifications?limit=1');
    if (probeResponse.status() !== 200) {
      throw new Error(
        `auth probe failed (${probeResponse.status()}) for ${email} before browser context`
      );
    }

    const storageState = normalizeStorageStateForBrowser(
      await apiContext.storageState(),
      baseURL
    );
    const context = await browser.newContext({ storageState, baseURL });
    await mirrorAuthCookiesForAlternateHost(context, baseURL);
    const page = await context.newPage();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForDevCompilation(page);

      if (/\/dashboard/.test(page.url())) {
        break;
      }

      if (attempt === 3) {
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });
      }
    }

    if (waitPresence) {
      await waitForDashboardPresenceReady(page);

      if (path.includes('/dashboard/overview')) {
        await expect(liveUsersCard(page)).toBeVisible({ timeout: 45_000 });
      }
    } else {
      await expect
        .poll(
          async () =>
            page.evaluate(() => document.documentElement.dataset.presenceSynced === 'true'),
          { timeout: 30_000 }
        )
        .toBe(true)
        .catch(() => {});
    }

    return { context, page };
  } finally {
    await apiContext.dispose();
  }
}

export async function openAuthenticatedDashboardContextWithRetry(
  browser: Browser,
  email: string,
  password: string,
  path = '/dashboard/overview',
  options: OpenAuthenticatedDashboardContextOptions = {},
  maxAttempts = 4
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await openAuthenticatedDashboardContext(
        browser,
        email,
        password,
        path,
        options
      );
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 3_000 * (attempt + 1)));
    }
  }

  throw lastError;
}

function tryReadStorageState(storageStatePath: string) {
  try {
    if (!fs.existsSync(storageStatePath)) {
      return null;
    }
    return readNormalizedStorageState(storageStatePath);
  } catch {
    return null;
  }
}

type OpenDashboardContextOptions = {
  waitPresence?: boolean;
};

async function openDashboardContextWithFallback(
  browser: Browser,
  storageStatePath: string,
  email: string | undefined,
  passwordEnv: string | undefined,
  path: string,
  options: OpenDashboardContextOptions = {}
) {
  const { waitPresence = true } = options;
  const cachedState = tryReadStorageState(storageStatePath);

  if (!cachedState || cachedState.cookies.length === 0) {
    if (!email || !passwordEnv) {
      throw new Error(`missing storage state and credentials for ${storageStatePath}`);
    }
    return openAuthenticatedDashboardContext(
      browser,
      email,
      resolveE2EPassword(passwordEnv),
      path,
      { waitPresence }
    );
  }

  const baseURL = e2eBaseURL;
  const context = await browser.newContext({
    storageState: cachedState,
    baseURL
  });
  await mirrorAuthCookiesForAlternateHost(context, baseURL);
  const page = await context.newPage();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await waitForDevCompilation(page, 90_000);
    } catch {
      if (attempt === 3) {
        await context.close();
        if (!email || !passwordEnv) {
          throw new Error(`storage state auth failed for ${storageStatePath}`);
        }
        return openAuthenticatedDashboardContext(
          browser,
          email,
          resolveE2EPassword(passwordEnv),
          path,
          { waitPresence }
        );
      }
      continue;
    }

    if (/\/dashboard/.test(page.url())) {
      break;
    }

    if (attempt === 3) {
      await context.close();
      if (!email || !passwordEnv) {
        throw new Error(`storage state auth failed for ${storageStatePath}`);
      }
      return openAuthenticatedDashboardContext(
        browser,
        email,
        resolveE2EPassword(passwordEnv),
        path,
        { waitPresence }
      );
    }
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });

  if (waitPresence) {
    await waitForDashboardPresenceReady(page);

    if (path.includes('/dashboard/overview')) {
      await expect(liveUsersCard(page)).toBeVisible({ timeout: 45_000 });
    }
  } else {
    await expect
      .poll(
        async () =>
          page.evaluate(() => document.documentElement.dataset.presenceSynced === 'true'),
        { timeout: 30_000 }
      )
      .toBe(true)
      .catch(() => {});
  }

  return { context, page };
}

export async function openAdminDashboardContext(
  browser: Browser,
  path = '/dashboard/overview',
  options?: OpenDashboardContextOptions
) {
  return openDashboardContextWithFallback(
    browser,
    'e2e/.auth/admin.json',
    process.env.E2E_ADMIN_EMAIL,
    process.env.E2E_ADMIN_PASSWORD,
    path,
    options
  );
}

export async function openUserDashboardContext(
  browser: Browser,
  path = '/dashboard/overview',
  options?: OpenDashboardContextOptions
) {
  return openDashboardContextWithFallback(
    browser,
    'e2e/.auth/user.json',
    process.env.E2E_USER_EMAIL,
    process.env.E2E_USER_PASSWORD,
    path,
    options
  );
}

export async function openUser2Context(browser: Browser, path = '/dashboard/overview') {
  return openDashboardContextWithFallback(
    browser,
    'e2e/.auth/user2.json',
    process.env.E2E_USER2_EMAIL,
    process.env.E2E_USER2_PASSWORD,
    path
  );
}

/** user track 먼저, admin overview는 user presence 반영 후 연다. */
export async function openAdminAndUserPresenceContexts(
  browser: Browser,
  userPath = '/dashboard/wallet'
) {
  const userSession = await openUserDashboardContext(browser, userPath);
  await waitForDashboardPresenceReady(userSession.page, 60_000);
  await waitForDevCompilation(userSession.page);

  const adminSession = await openAdminDashboardContext(browser);
  const adminCard = liveUsersCard(adminSession.page);

  try {
    await waitForLiveUsersSynced(adminCard, 30_000);
  } catch {
    await adminSession.page.reload({ waitUntil: 'domcontentloaded' });
    await waitForDashboardPresenceReady(adminSession.page, 60_000);
    await expect(liveUsersCard(adminSession.page)).toBeVisible({ timeout: 45_000 });
  }

  return { adminSession, userSession };
}

export function sortFullNamesKo(names: string[]) {
  return [...names].sort((a, b) => a.localeCompare(b, 'ko'));
}

export async function readVisibleLiveUserNames(card: Locator) {
  const rows = card.locator('[data-testid^="live-user-"]');
  const count = await rows.count();
  const names: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const name = await rows.nth(index).locator('p').first().textContent();
    if (name) {
      names.push(name.trim());
    }
  }

  return names;
}

export async function readVisibleLiveUserIds(card: Locator) {
  const rows = card.locator('[data-testid^="live-user-"]');
  const count = await rows.count();
  const ids: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const testId = await rows.nth(index).getAttribute('data-testid');
    const id = testId?.replace('live-user-', '');
    if (id) {
      ids.push(id);
    }
  }

  return ids;
}

/** Prior serial tests may leave stale presence — poll until only expected profiles remain. */
export async function waitForLiveUsersOnlyProfiles(
  card: Locator,
  profiles: E2EUserProfile[],
  timeout = 60_000
) {
  await waitForLiveUsersSynced(card, timeout);
  const expectedIds = profiles.map((profile) => profile.id).toSorted();

  await expect
    .poll(async () => {
      const ids = (await readVisibleLiveUserIds(card)).toSorted();
      return ids.length === expectedIds.length && ids.join(',') === expectedIds.join(',');
    }, { timeout })
    .toBe(true);
}

export async function closeContextSafe(context: BrowserContext) {
  for (const page of context.pages()) {
    await page
      .evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        window.dispatchEvent(new Event('beforeunload'));
      })
      .catch(() => {});
    await page.waitForTimeout(1_000);
  }
  await context.close();
}

/** dashboard layout unmount 후 presence untrack 전파 시간 확보 */
export async function disconnectDashboardPresenceSession(session: {
  context: BrowserContext;
  page: Page;
}) {
  if (!session.page.isClosed() && /\/dashboard/.test(session.page.url())) {
    await session.page.goto('/auth/sign-in', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    await waitForDevCompilation(session.page, 60_000);
    await session.page.waitForTimeout(3_000);
  }

  if (!session.page.isClosed()) {
    await session.page.close().catch(() => {});
  }

  await closeContextSafe(session.context);
}

const INITIAL_PASSWORD = '12341234a';

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

async function completeForcePasswordChangeViaBrowser(
  browser: Browser,
  email: string,
  newPassword: string
) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    baseURL: e2eBaseURL
  });
  const page = await context.newPage();

  try {
    await expect
      .poll(async () => {
        await context.clearCookies();
        await page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
        await waitForDevCompilation(page);
        await fillSignInCredentials(page, email, INITIAL_PASSWORD);

        try {
          await Promise.all([
            page.waitForURL(/\/auth\/force-password-change/, { timeout: 45_000 }),
            page.getByRole('button', { name: '로그인' }).click()
          ]);
          return page.url();
        } catch {
          return null;
        }
      }, { timeout: 120_000, intervals: [3000] })
      .toMatch(/\/auth\/force-password-change/);

    await page.getByTestId('force-password-new').fill(newPassword);
    await page.getByTestId('force-password-confirm').fill(newPassword);
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 60_000 }),
      page.getByTestId('force-password-submit').click()
    ]);
  } finally {
    await context.close();
  }
}

export async function loadCachedE2EProfiles(playwright: {
  request: {
    newContext: (options: Record<string, unknown>) => Promise<APIRequestContext>;
  };
}) {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const userEmail = process.env.E2E_USER_EMAIL;
  if (!adminEmail || !userEmail) {
    throw new Error('E2E_ADMIN_EMAIL and E2E_USER_EMAIL are required');
  }

  let adminRequest = await createAdminRequest(playwright);
  const usersProbe = await adminRequest.get('/api/users?limit=1');

  if (usersProbe.status() !== 200) {
    await adminRequest.dispose();
    adminRequest = await createIsolatedAdminRequest(playwright);
  }

  try {
    return {
      adminProfile: await resolveUserProfileByEmail(adminRequest, adminEmail),
      userProfile: await resolveUserProfileByEmail(adminRequest, userEmail)
    };
  } finally {
    await adminRequest.dispose();
  }
}

export async function createIsolatedAdminRequest(playwright: {
  request: {
    newContext: (options: Record<string, unknown>) => Promise<APIRequestContext>;
  };
}) {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = resolveE2EPassword(process.env.E2E_ADMIN_PASSWORD);
  if (!adminEmail || !process.env.E2E_ADMIN_PASSWORD) {
    throw new Error('E2E_ADMIN credentials required');
  }

  const adminRequest = await playwright.request.newContext({
    baseURL: e2eBaseURL,
    storageState: { cookies: [], origins: [] }
  });

  let signedIn = false;
  let mustChange = false;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let signInResponse;

    try {
      signInResponse = await adminRequest.post('/api/auth/sign-in', {
        data: { email: adminEmail, password: adminPassword }
      });
    } catch (error) {
      if (attempt === 4) {
        await adminRequest.dispose();
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
      continue;
    }

    if (signInResponse.status() === 200) {
      const body = (await signInResponse.json()) as { mustChange?: boolean };
      mustChange = body.mustChange === true;
      signedIn = true;
      break;
    }

    const status = signInResponse.status();
    const bodyText = await signInResponse.text();
    const retryable = status === 429 || /rate limit|too many/i.test(bodyText);

    if (!retryable || attempt === 4) {
      await adminRequest.dispose();
      throw new Error(`admin sign-in failed (${status}): ${bodyText}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
  }

  if (!signedIn) {
    await adminRequest.dispose();
    throw new Error('admin sign-in failed after retries');
  }

  if (mustChange) {
    await adminRequest.dispose();
    throw new Error('E2E admin must change password before isolated request');
  }

  const probe = await adminRequest.get('/api/users?limit=1');
  if (probe.status() !== 200) {
    await adminRequest.dispose();
    throw new Error(`admin probe failed after sign-in (${probe.status()})`);
  }

  return adminRequest;
}

export async function refreshAdminStorageState(browser: Browser) {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = resolveE2EPassword(process.env.E2E_ADMIN_PASSWORD);
  if (!email || !process.env.E2E_ADMIN_PASSWORD) {
    throw new Error('E2E_ADMIN credentials required');
  }

  const context = await browser.newContext();
  try {
    await authenticateStorageState(
      context,
      email,
      password,
      'e2e/.auth/admin.json',
      '/api/users?limit=1'
    );
  } finally {
    await context.close();
  }
}

export async function refreshUserStorageState(browser: Browser) {
  const email = process.env.E2E_USER_EMAIL;
  const password = resolveE2EPassword(process.env.E2E_USER_PASSWORD);
  if (!email || !process.env.E2E_USER_PASSWORD) {
    throw new Error('E2E_USER credentials required');
  }

  const context = await browser.newContext();
  try {
    await authenticateStorageState(context, email, password, 'e2e/.auth/user.json');
  } finally {
    await context.close();
  }
}

export async function refreshUser2StorageState(browser: Browser) {
  const email = process.env.E2E_USER2_EMAIL;
  const password = resolveE2EPassword(process.env.E2E_USER2_PASSWORD);
  if (!email || !process.env.E2E_USER2_PASSWORD) {
    throw new Error('E2E_USER2 credentials required');
  }

  const context = await browser.newContext();
  try {
    await authenticateStorageState(context, email, password, 'e2e/.auth/user2.json');
  } finally {
    await context.close();
  }
}

export async function refreshAllE2EStorageStates(browser: Browser) {
  try {
    await refreshAdminStorageState(browser);
    await refreshUserStorageState(browser);
    await refreshUser2StorageState(browser);
  } catch {
    // best-effort between serial tests — do not fail the spec on refresh errors
  }
}

export async function getAuthenticatedAdminRequest(playwright: {
  request: {
    newContext: (options: Record<string, unknown>) => Promise<APIRequestContext>;
  };
}) {
  let adminRequest = await createAdminRequest(playwright);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const usersProbe = await adminRequest.get('/api/users?limit=1');
      if (usersProbe.status() === 200) {
        return adminRequest;
      }
    } catch {
      // retry with fresh admin session
    }

    await adminRequest.dispose();
    adminRequest = await createIsolatedAdminRequest(playwright);
    await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
  }

  throw new Error('admin request probe failed after retries');
}

function uniqueE2EPhone() {
  return `010${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
}

export async function createDashboardReadyUser(
  adminRequest: APIRequestContext,
  playwright: {
    request: {
      newContext: (options: Record<string, unknown>) => Promise<APIRequestContext>;
    };
  },
  fullName: string,
  browser?: Browser
) {
  const email = uniqueEmail('live-user');
  const newPassword = `Live${Date.now()}a1`;
  const phone = uniqueE2EPhone();

  let userId = '';

  await expect
    .poll(async () => {
      try {
        const response = await adminRequest.post('/api/users', {
          data: {
            email,
            full_name: fullName,
            affiliation: 'wake',
            rank: '경영진',
            system_role: 'user',
            birthday: '1990-01-01',
            phone
          }
        });

        if (response.status() !== 201) {
          return null;
        }

        const body = (await response.json()) as { user_id?: string };
        userId = body.user_id ?? '';
        return userId ? 201 : null;
      } catch {
        return null;
      }
    }, { timeout: 60_000, intervals: [2000] })
    .toBe(201);

  await new Promise((resolve) => setTimeout(resolve, 3_000));

  const mustChangeRequest = await playwright.request.newContext({
    baseURL: e2eBaseURL,
    storageState: { cookies: [], origins: [] }
  });

  try {
    let passwordChanged = false;

    try {
      await expect
        .poll(async () => {
          try {
            const signInResponse = await mustChangeRequest.post('/api/auth/sign-in', {
              data: { email, password: INITIAL_PASSWORD }
            });
            if (signInResponse.status() !== 200) {
              return null;
            }
            const body = (await signInResponse.json()) as { mustChange?: boolean };
            return body.mustChange === true ? true : null;
          } catch {
            return null;
          }
        }, { timeout: 60_000, intervals: [2000] })
        .toBe(true);

      await expect
        .poll(async () => {
          try {
            const changeResponse = await mustChangeRequest.patch('/api/auth/force-password-change', {
              data: {
                new_password: newPassword,
                confirm_password: newPassword
              }
            });
            return changeResponse.status() === 200 ? 200 : null;
          } catch {
            return null;
          }
        }, { timeout: 30_000, intervals: [2000] })
        .toBe(200);
      passwordChanged = true;
    } catch {
      if (!browser) {
        throw new Error(`API password change failed for ${email}`);
      }
      await completeForcePasswordChangeViaBrowser(browser, email, newPassword);
      passwordChanged = true;
    }

    expect(passwordChanged).toBe(true);
  } finally {
    await mustChangeRequest.dispose();
  }

  const sessionRequest = await playwright.request.newContext({
    baseURL: e2eBaseURL,
    storageState: { cookies: [], origins: [] }
  });

  let storageState: Awaited<ReturnType<APIRequestContext['storageState']>>;

  try {
    await expect
      .poll(async () => {
        const signInResponse = await sessionRequest.post('/api/auth/sign-in', {
          data: { email, password: newPassword }
        });
        if (signInResponse.status() !== 200) {
          return null;
        }
        const body = (await signInResponse.json()) as { mustChange?: boolean };
        return body.mustChange === false ? true : null;
      }, { timeout: 60_000, intervals: [2000] })
      .toBe(true);

    storageState = await sessionRequest.storageState();
  } finally {
    await sessionRequest.dispose();
  }

  return { email, password: newPassword, fullName, storageState, userId };
}

export async function openDashboardContextFromStorageState(
  browser: Browser,
  storageState: Awaited<ReturnType<APIRequestContext['storageState']>>,
  path = '/dashboard/overview',
  options?: { waitPresence?: boolean }
) {
  const baseURL = e2eBaseURL;
  const waitPresence = options?.waitPresence ?? true;
  const context = await browser.newContext({
    storageState: normalizeStorageStateForBrowser(storageState, baseURL),
    baseURL
  });
  await mirrorAuthCookiesForAlternateHost(context, baseURL);
  const page = await context.newPage();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await waitForDevCompilation(page);

    if (/\/dashboard/.test(page.url())) {
      break;
    }

    if (attempt === 3) {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });
    }
  }

  if (waitPresence) {
    await waitForDashboardPresenceReady(page);
  }

  if (path.includes('/dashboard/overview')) {
    await expect(liveUsersCard(page)).toBeVisible({ timeout: 45_000 });
  }

  return { context, page };
}
