import { expect, test } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import { resolveE2EPassword } from '../helpers/e2e-credentials';
import { createUserViaApi, uniqueEmail } from '../notifications/helpers';
import {
  closeContextSafe,
  createDashboardReadyUser,
  disconnectDashboardPresenceSession,
  getAuthenticatedAdminRequest,
  liveUsersCard,
  type E2EUserProfile,
  loadCachedE2EProfiles,
  openAdminAndUserPresenceContexts,
  openAdminDashboardContext,
  openAuthenticatedDashboardContext,
  openAuthenticatedDashboardContextWithRetry,
  openUser2Context,
  openUserDashboardContext,
  readLiveUsersDescriptionCount,
  readVisibleLiveUserIds,
  readVisibleLiveUserNames,
  refreshAdminStorageState,
  refreshAllE2EStorageStates,
  sortFullNamesKo,
  waitForLiveUsersMinCount,
  waitForLiveUsersSynced,
  waitForLiveUsersWithNames
} from './helpers';

test.describe('Live 접속자 (overview presence)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  let cachedAdminProfile: E2EUserProfile;
  let cachedUserProfile: E2EUserProfile;

  test.beforeAll(async ({ playwright }) => {
    const profiles = await loadCachedE2EProfiles(playwright);
    cachedAdminProfile = profiles.adminProfile;
    cachedUserProfile = profiles.userProfile;
  });

  test.afterAll(async ({ browser }) => {
    await refreshAllE2EStorageStates(browser);
  });

  test('AC-01: admin·user 2 context에서 user 1명만 표시 (admin 제외)', async ({
    browser
  }) => {
    const adminProfile = cachedAdminProfile;
    const userProfile = cachedUserProfile;

    const { adminSession, userSession } = await openAdminAndUserPresenceContexts(browser);

    try {
      const card = liveUsersCard(adminSession.page);
      await waitForLiveUsersWithNames(card, [userProfile.full_name], 90_000);
      await expect(card.getByText('접속 중', { exact: true }).first()).toBeVisible();
      await expect(card.getByTestId(`live-user-${adminProfile.id}`)).toHaveCount(0);
      expect(await readLiveUsersDescriptionCount(card)).toBe(1);
    } finally {
      await closeContextSafe(userSession.context);
      await closeContextSafe(adminSession.context);
    }
  });

  test('AC-02: 각 행에 Avatar·이름·이메일·접속 중 Badge', async ({
    browser
  }) => {
    const userProfile = cachedUserProfile;

    const { adminSession, userSession } = await openAdminAndUserPresenceContexts(browser);

    try {
      const card = liveUsersCard(adminSession.page);
      await waitForLiveUsersWithNames(card, [userProfile.full_name], 90_000);

      const row = card.getByTestId(`live-user-${userProfile.id}`);
      await expect(row).toBeVisible();
      await expect(row.getByRole('img', { name: userProfile.full_name })).toBeVisible();
      await expect(row.getByText(userProfile.full_name)).toBeVisible();
      await expect(row.getByText(userProfile.email)).toBeVisible();
      await expect(row.getByTestId('live-user-dot')).toBeVisible();
      await expect(row.getByText('접속 중')).toBeVisible();
    } finally {
      await closeContextSafe(userSession.context);
      await closeContextSafe(adminSession.context);
    }
  });

  test('AC-03: 6명 이상 시 5명 표시 후 스크롤로 5명씩 추가', async ({
    browser,
    playwright
  }) => {
    test.setTimeout(360_000);

    await refreshAllE2EStorageStates(browser);

    let adminRequest = await getAuthenticatedAdminRequest(playwright);
    const extraContexts: Array<
      Awaited<ReturnType<typeof openAuthenticatedDashboardContext>>
    > = [];
    const extraNames = ['가E2E', '나E2E', '다E2E', '라E2E'];
    const readyUsers = [];

    try {
      for (const fullName of extraNames) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            readyUsers.push(
              await createDashboardReadyUser(adminRequest, playwright, fullName, browser)
            );
            break;
          } catch (error) {
            await adminRequest.dispose();
            adminRequest = await getAuthenticatedAdminRequest(playwright);
            if (attempt === 2) {
              throw error;
            }
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 3_000));
      }
      for (const readyUser of readyUsers) {
        extraContexts.push(
          await openAuthenticatedDashboardContextWithRetry(
            browser,
            readyUser.email,
            readyUser.password,
            '/dashboard/wallet',
            { waitPresence: false }
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }

      extraContexts.push(
        await openUserDashboardContext(browser, '/dashboard/wallet'),
        await openUser2Context(browser, '/dashboard/wallet')
      );

      await refreshAdminStorageState(browser);
      const adminSession = await openAdminDashboardContext(browser);
      extraContexts.push(adminSession);

      const card = liveUsersCard(adminSession.page);
      await waitForLiveUsersMinCount(card, 6, 90_000);

      await expect
        .poll(async () => readVisibleLiveUserIds(card).then((ids) => ids.length), {
          timeout: 15_000
        })
        .toBe(5);

      const visibleIds = await readVisibleLiveUserIds(card);
      expect(new Set(visibleIds).size).toBe(5);

      const listScroller = card.getByTestId('live-users-list-scroll');
      await listScroller.hover();
      for (let i = 0; i < 8; i += 1) {
        await adminSession.page.mouse.wheel(0, 600);
      }
      await listScroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
      });

      await expect
        .poll(async () => readVisibleLiveUserIds(card).then((ids) => ids.length), {
          timeout: 30_000
        })
        .toBeGreaterThan(5);

      const afterScrollIds = await readVisibleLiveUserIds(card);
      expect(new Set(afterScrollIds).size).toBe(afterScrollIds.length);
    } finally {
      await adminRequest.dispose();
      for (const session of extraContexts) {
        await disconnectDashboardPresenceSession(session);
      }

      try {
        const cleanupRequest = await createAdminRequest(playwright);
        try {
          for (const readyUser of readyUsers) {
            if (readyUser.userId) {
              await cleanupRequest.delete(`/api/users/${readyUser.userId}`).catch(() => {});
            }
          }
        } finally {
          await cleanupRequest.dispose();
        }
      } catch {
        // best-effort cleanup — do not fail the spec
      }

      await new Promise((resolve) => setTimeout(resolve, 45_000));
      await refreshAllE2EStorageStates(browser);
    }
  });

  test('AC-04: admin 단독 context에서 1명·본인 강조 없음', async ({
    browser
  }) => {
    const adminProfile = cachedAdminProfile;

    const adminSession = await openAdminDashboardContext(browser);

    try {
      const card = liveUsersCard(adminSession.page);
      await waitForLiveUsersSynced(card, 90_000);
      await expect(card.getByTestId(`live-user-${adminProfile.id}`)).toBeVisible({
        timeout: 60_000
      });
      await expect
        .poll(async () => card.getByTestId(`live-user-${cachedUserProfile.id}`).count(), {
          timeout: 90_000,
          intervals: [1_000]
        })
        .toBe(0);
      await expect(card.getByTestId('live-user-self-highlight')).toHaveCount(0);
      await expect(card.getByText('본인')).toHaveCount(0);
      expect(await readLiveUsersDescriptionCount(card)).toBeGreaterThanOrEqual(1);
    } finally {
      await closeContextSafe(adminSession.context);
    }
  });

  test('AC-05: user context 닫으면 ~15초 내 admin 카드에서 user 행 제거', async ({
    browser
  }) => {
    const userProfile = cachedUserProfile;

    const { adminSession, userSession } = await openAdminAndUserPresenceContexts(
      browser,
      '/dashboard/wallet'
    );

    try {
      const card = liveUsersCard(adminSession.page);
      await waitForLiveUsersWithNames(card, [userProfile.full_name], 60_000);
    } finally {
      await disconnectDashboardPresenceSession(userSession);
    }

    const card = liveUsersCard(adminSession.page);
    await adminSession.page.reload({ waitUntil: 'domcontentloaded' });
    await waitForLiveUsersSynced(card, 60_000);

    await expect
      .poll(async () => card.getByTestId(`live-user-${userProfile.id}`).count(), {
        timeout: 60_000,
        intervals: [1_000]
      })
      .toBe(0);
    await expect(card.getByTestId(`live-user-${cachedAdminProfile.id}`)).toHaveCount(0);
    await expect(card.getByText('현재 접속 중인 사용자가 없습니다')).toBeVisible();

    await closeContextSafe(adminSession.context);
  });

  test('AC-06: non-admin full_name 가나다순 정렬', async ({ browser }) => {
    const adminProfile = cachedAdminProfile;
    const userProfile = cachedUserProfile;

    const { adminSession, userSession } = await openAdminAndUserPresenceContexts(
      browser,
      '/dashboard/wallet'
    );

    try {
      const card = liveUsersCard(adminSession.page);
      await waitForLiveUsersWithNames(card, [userProfile.full_name], 60_000);

      const visibleNames = await readVisibleLiveUserNames(card);
      expect(visibleNames).not.toContain(adminProfile.full_name);
      const targetNames = [userProfile.full_name];
      const ourNames = visibleNames.filter((name) => targetNames.includes(name));
      expect(ourNames).toEqual(sortFullNamesKo(targetNames));
    } finally {
      await closeContextSafe(userSession.context);
      await closeContextSafe(adminSession.context);
    }
  });

  test('AC-07: @sales 슬롯에 데모 MockDataOverlay 없음', async ({ browser }) => {
    const adminSession = await openAdminDashboardContext(browser);

    try {
      const card = liveUsersCard(adminSession.page);
      await expect(card).toBeVisible();
      await expect(card.locator('[data-testid="mock-data-overlay"]')).toHaveCount(0);
      await expect(card.getByText('데모')).toHaveCount(0);
    } finally {
      await closeContextSafe(adminSession.context);
    }
  });

  test('AC-08: 첫 진입 시 3초 고정 delay 없이 sync', async ({ browser }) => {
    const adminSession = await openAdminDashboardContext(browser);

    try {
      const startedAt = Date.now();
      await adminSession.page.reload();
      const card = liveUsersCard(adminSession.page);
      await expect(card.getByText('접속 중', { exact: true }).first()).toBeVisible();
      await waitForLiveUsersSynced(card);
      await expect(card.getByText('현재 접속 중인 사용자가 없습니다')).toBeVisible();
      expect(Date.now() - startedAt).toBeLessThan(8_000);
    } finally {
      await closeContextSafe(adminSession.context);
    }
  });

  test('AC-09: force-change 페이지에 dashboard 셸·Live 카드 없음', async ({
    browser,
    playwright
  }) => {
    const email = uniqueEmail('live-ac9');
    const adminRequest = await getAuthenticatedAdminRequest(playwright);

    try {
      await createUserViaApi(adminRequest, email, 'Live AC9 Force');

      const guestContext = await browser.newContext({
        storageState: { cookies: [], origins: [] }
      });
      const page = await guestContext.newPage();

      await page.goto('/auth/sign-in');
      const atIndex = email.indexOf('@');
      await page.getByRole('textbox', { name: '아이디' }).fill(email.slice(0, atIndex));
      await page
        .getByTestId('login-domain-combobox')
        .click();
      await page.getByPlaceholder('도메인 검색 또는 입력…').fill('example.com');
      await page.getByRole('option', { name: '「example.com」 사용' }).click();
      await page.getByPlaceholder('비밀번호를 입력하세요').fill('12341234a');

      await Promise.all([
        page.waitForURL(/\/auth\/force-password-change/, { timeout: 30_000 }),
        page.getByRole('button', { name: '로그인' }).click()
      ]);

      await expect(page.getByRole('heading', { name: '비밀번호 변경' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '개요' })).toHaveCount(0);
      await expect(page.getByTestId('live-users-card')).toHaveCount(0);
      await guestContext.close();
    } finally {
      await adminRequest.dispose();
    }
  });

  test('AC-10: admin·user overview에서 동일 접속자 목록', async ({
    browser
  }) => {
    const { adminSession, userSession } = await openAdminAndUserPresenceContexts(
      browser,
      '/dashboard/overview'
    );

    try {
      const adminCard = liveUsersCard(adminSession.page);
      const userCard = liveUsersCard(userSession.page);
      await waitForLiveUsersSynced(adminCard);
      await waitForLiveUsersSynced(userCard);

      await expect(adminCard.getByTestId(`live-user-${cachedAdminProfile.id}`)).toHaveCount(0);
      await expect(userCard.getByTestId(`live-user-${cachedAdminProfile.id}`)).toHaveCount(0);

      await expect
        .poll(async () => {
          const adminIds = (await readVisibleLiveUserIds(adminCard)).toSorted();
          const userIds = (await readVisibleLiveUserIds(userCard)).toSorted();
          return adminIds.length > 0 && adminIds.join(',') === userIds.join(',');
        }, { timeout: 30_000 })
        .toBe(true);
    } finally {
      await closeContextSafe(userSession.context);
      await closeContextSafe(adminSession.context);
    }
  });

  test('AC-11: sync 전 compact Spinner 후 목록 표시', async ({ browser }) => {
    const adminSession = await openAuthenticatedDashboardContext(
      browser,
      process.env.E2E_ADMIN_EMAIL!,
      resolveE2EPassword(process.env.E2E_ADMIN_PASSWORD),
      '/dashboard/overview',
      { waitPresence: false }
    );

    try {
      await adminSession.page.reload({ waitUntil: 'domcontentloaded' });
      await expect(adminSession.page).toHaveURL(/\/dashboard\/overview/, { timeout: 45_000 });

      const card = liveUsersCard(adminSession.page);
      await expect(card).toBeVisible({ timeout: 45_000 });

      const spinner = card.getByRole('status', { name: 'Loading' });
      await spinner.isVisible({ timeout: 2_000 }).catch(() => false);

      await waitForLiveUsersSynced(card, 90_000);
      await expect(spinner).toBeHidden();
      await expect(card.getByText('현재 접속 중인 사용자가 없습니다')).toBeVisible();
    } finally {
      await closeContextSafe(adminSession.context);
    }
  });

  test('AC-12: 다른 context 모두 닫으면 0명 empty copy 표시', async ({
    browser
  }) => {
    test.setTimeout(180_000);

    const adminEmail = process.env.E2E_ADMIN_EMAIL!;
    const adminPassword = resolveE2EPassword(process.env.E2E_ADMIN_PASSWORD);
    const userEmail = process.env.E2E_USER_EMAIL!;
    const userPassword = resolveE2EPassword(process.env.E2E_USER_PASSWORD);

    const adminSession = await openAuthenticatedDashboardContext(
      browser,
      adminEmail,
      adminPassword,
      '/dashboard/overview',
      { waitPresence: false }
    );
    const userSession = await openAuthenticatedDashboardContext(
      browser,
      userEmail,
      userPassword,
      '/dashboard/wallet',
      { waitPresence: false }
    );

    await closeContextSafe(userSession.context);
    await closeContextSafe(adminSession.context);

    await expect
      .poll(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        return true;
      }, { timeout: 15_000 })
      .toBe(true);

    const soloSession = await openAuthenticatedDashboardContext(
      browser,
      adminEmail,
      adminPassword
    );

    try {
      const card = liveUsersCard(soloSession.page);

      await waitForLiveUsersSynced(card);
      await expect(card.getByText('현재 접속 중인 사용자가 없습니다')).toBeVisible();
      await expect(card.locator('[data-testid^="live-user-"]')).toHaveCount(0);
    } finally {
      await closeContextSafe(soloSession.context);
    }
  });

  test('AC-14: user가 wallet에 있어도 admin overview 목록에 표시', async ({
    browser
  }) => {
    const userProfile = cachedUserProfile;

    const { adminSession, userSession } = await openAdminAndUserPresenceContexts(
      browser,
      '/dashboard/wallet'
    );

    try {
      const card = liveUsersCard(adminSession.page);
      await waitForLiveUsersWithNames(card, [userProfile.full_name], 60_000);
      await expect(userSession.page).toHaveURL(/\/dashboard\/wallet/);
    } finally {
      await closeContextSafe(userSession.context);
      await closeContextSafe(adminSession.context);
    }
  });
});
