import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { createAnnouncementOrThrow, uniqueAnnouncementTitle } from '../announcements/helpers';
import { buildImportPayload, importAuthHeaders, uniqueDocumentNumber } from '../helpers/contracts';
import { resolveE2EPassword } from '../helpers/e2e-credentials';
import { createOrgChartTestUser } from '../helpers/org-chart';
import { importBenefitForNotifications, uniqueBenefitDocumentNumber } from '../helpers/benefit-notifications';
import {
  getPushPreferences,
  mockEndpoint,
  PUSH_PREFERENCES_PATH,
  registerMockDevice,
  resetPushStateForUser
} from '../helpers/push-mock';
import { createDoc, uid } from '../workflow/helpers';
import {
  anonKey,
  apiAs,
  callAs,
  createAs,
  fixtureUser,
  pageAs,
  readAccountMeta,
  readJson,
  serviceClient,
  uniqueTag,
  withApi
} from '../quick-workflow/helpers';
import { grepDir, readSource, SRC_ROOT } from './helpers';

/**
 * plan 95 — 동방특송 노출 범위 감사 · 서버 제외 일원화
 * docs/plans/95_dongbang-visibility-audit-plan.md (AC-01 ~ AC-12)
 *
 * - 동방 fixture: e2e/.auth/dongbang.json (+ dongbang.meta.json · setup-dongbang · `E2E 동방특송 …` · example.com → teardown 삭제)
 * - 예외 3곳(사용자 관리 · 활동 로그 콤보 · 알림 「타인 보기」 콤보)만 동방이 보이고, 그 밖(식대·복지비 proxy·CS·이름 매칭)은 0건
 * - 알림: `insertNotifications` 단일 가드 → 동방 수신 행은 `quick_request`·`profile` 그룹만
 * - AC-12(CLI)는 verifier가 tsc·lint·build·회귀 Playwright로 판정한다 (spec 없음)
 * - plan 102 AC-04: 동방 세션 `GET /api/birthdays` 403 · 생일 명단 동방 제외(S-10a) 1건 추가
 */
test.describe('plan 95 동방특송 노출 범위 감사', () => {
  test.describe.configure({ mode: 'serial', timeout: 150_000 });

  const DONGBANG_LABEL = '동방특송';
  const COMBO_PLACEHOLDER = '이름·이메일 검색…';
  const PUSH_INVALID_GROUP_MESSAGE = '알림 종류가 올바르지 않습니다.';
  const DONGBANG_ALLOWED_TYPES = ['user.update', 'quick_request.vendor_event', 'quick_request.requester_event', 'quick_request.chat_message'];

  type UsersBody = { users?: Array<{ id: string; email: string; affiliation: string | null }> };

  function dongbang() {
    return readAccountMeta('dongbang');
  }

  async function listActiveDongbangEmails(): Promise<string[]> {
    const { data, error } = await serviceClient()
      .from('profiles')
      .select('email')
      .eq('affiliation', 'dongbang')
      .eq('status', 'active');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.email as string);
  }

  /** 동방 수신 알림 중 허용 그룹(퀵·프로필) 밖의 행 수 */
  async function countDisallowedDongbangNotifications(userId: string): Promise<number> {
    const { data, error } = await serviceClient()
      .from('notifications')
      .select('id, type')
      .eq('recipient_user_id', userId);
    if (error) throw new Error(error.message);
    return (data ?? []).filter((row) => !DONGBANG_ALLOWED_TYPES.includes(row.type as string)).length;
  }

  async function listDongbangNotificationsSince(userId: string, sinceIso: string) {
    const { data, error } = await serviceClient()
      .from('notifications')
      .select('id, type, title, created_at')
      .eq('recipient_user_id', userId)
      .gte('created_at', sinceIso)
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: number; type: string; title: string; created_at: string }>;
  }

  /** 제외 콤보 공통 판정 — `wakecorp` 검색은 비어 있지 않되 동방 이메일은 0건 · 동방 fixture 이메일 검색은 「사용자를 찾을 수 없습니다.」 */
  async function expectComboExcludesDongbang(page: Page, testId: string, dongbangEmails: string[]) {
    const combobox = page.getByTestId(testId);
    await expect(combobox).toBeVisible({ timeout: 30_000 });
    await combobox.click();
    const search = page.getByPlaceholder(COMBO_PLACEHOLDER);
    await expect(search).toBeVisible();

    await search.fill('wakecorp');
    // 「본인」 고정 항목 + 사용자 항목 ≥1 (목록이 비어 있지 않음을 먼저 확인)
    await expect
      .poll(async () => page.getByRole('option').count(), { timeout: 15_000, message: `${testId} wakecorp options` })
      .toBeGreaterThanOrEqual(2);
    for (const email of dongbangEmails) {
      await expect(page.getByRole('option').filter({ hasText: email }), `${testId} ${email} 노출`).toHaveCount(0);
    }

    // 동방 fixture 이메일 검색 → 사용자 항목(이메일 포함) 0건 · 고정 항목(본인 등)만 남는다
    // (cmdk CommandEmpty는 고정 항목이 있으면 렌더되지 않는 기존 동작 → 「사용자를 찾을 수 없습니다.」 문구는 판정하지 않는다)
    await search.fill(dongbang().email);
    await expect
      .poll(async () => page.getByRole('option').filter({ hasText: '@' }).count(), {
        timeout: 15_000,
        message: `${testId} 동방 fixture 검색 → 사용자 항목 0`
      })
      .toBe(0);
    await expect(page.getByRole('option').filter({ hasText: dongbang().email })).toHaveCount(0);
    await expect(page.getByRole('option').first(), '고정 항목 유지').toBeVisible();
    await page.keyboard.press('Escape');
  }

  /** 예외 콤보 공통 판정 — 동방 fixture 검색 → 항목 있음 → 선택 시 URL 파라미터 + trigger 라벨 실명 */
  async function selectDongbangInCombo(page: Page, testId: string, urlParam: string) {
    const meta = dongbang();
    const combobox = page.getByTestId(testId);
    await expect(combobox).toBeVisible({ timeout: 30_000 });
    await combobox.click();
    const search = page.getByPlaceholder(COMBO_PLACEHOLDER);
    await expect(search).toBeVisible();
    await search.fill(meta.email);
    const option = page.getByRole('option').filter({ hasText: meta.email });
    await expect(option, `${testId} 동방 항목`).toBeVisible({ timeout: 15_000 });
    await option.click();
    await expect(page).toHaveURL(new RegExp(`${urlParam}=${meta.userId}`), { timeout: 15_000 });
    await expect(combobox).toContainText(meta.fullName, { timeout: 15_000 });
    await expect(combobox).not.toContainText('선택한 사용자');
  }

  test('AC-01: `from(\'profiles\')` 전수 grep → plan §감사표에 파일 전부 등재 · 표 밖 매치 0 · `applyDongbangScope` 적용 5곳', async () => {
    const plan = readSource('docs/plans/95_dongbang-visibility-audit-plan.md');
    const hits = [...grepDir('src', "from('profiles')"), ...grepDir('src', 'from("profiles")')];
    expect(hits.length, 'profiles 조회 grep 결과').toBeGreaterThan(0);

    const missing = hits.filter((hit) => {
      const file = hit.slice(0, hit.indexOf(':')).replace(/\\/g, '/');
      const relative = file.replace(/^src\//, '');
      return !plan.includes(relative);
    });
    expect(missing, '감사표 미등재 파일').toEqual([]);

    // 조치 A — 서버 제외 진입점 적용 (S-1 · S-3 · S-4 · S-5 · S-6)
    for (const file of [
      'src/features/users/api/service.server.ts',
      'src/features/contracts/api/service.server.ts',
      'src/features/wallet/api/service.server.ts',
      'src/features/wallet/api/balance-email.service.server.ts',
      'src/features/wallet-balance-email-logs/api/service.server.ts',
      'src/features/support/api/service.server.ts'
    ]) {
      expect(readSource(file), `${file} applyDongbangScope`).toContain('applyDongbangScope(');
    }
    expect(fs.existsSync(path.join(SRC_ROOT, 'src/features/users/api/profile-scope.server.ts'))).toBe(true);
  });

  test('AC-02: GET /api/users 기본 동방 0건 · includeDongbang=1 동방 1건 · user.json 403', async () => {
    const meta = dongbang();

    const base = await callAs('admin', (api) => api.get('/api/users?limit=200'));
    expect(base.status).toBe(200);
    const baseUsers = (base.body as UsersBody).users ?? [];
    expect(baseUsers.length).toBeGreaterThan(0);
    expect(baseUsers.filter((user) => user.affiliation === 'dongbang'), '기본 응답 동방').toEqual([]);
    expect(baseUsers.some((user) => user.id === meta.userId)).toBe(false);

    const included = await callAs('admin', (api) => api.get('/api/users?limit=200&includeDongbang=1'));
    expect(included.status).toBe(200);
    const includedUsers = (included.body as UsersBody).users ?? [];
    const fixtureRows = includedUsers.filter((user) => user.id === meta.userId);
    expect(fixtureRows, 'includeDongbang=1 동방 fixture').toHaveLength(1);
    expect(fixtureRows[0].affiliation).toBe('dongbang');
    expect(includedUsers.length).toBeGreaterThan(baseUsers.length);

    const forbidden = await callAs('user', (api) => api.get('/api/users?limit=200&includeDongbang=1'));
    expect(forbidden.status).toBe(403);
  });

  test('AC-03: /dashboard/users 목록에 동방 사용자 보임 · 소속 「동방특송」 · 수정 Sheet 열림(89 AC-02 회귀)', async ({ browser }) => {
    const meta = dongbang();
    const { context, page } = await pageAs(browser, 'admin');
    try {
      await page.goto(`/dashboard/users?name=${encodeURIComponent(meta.fullName)}`);
      await expect(page.getByRole('heading', { name: '사용자 관리', exact: true })).toBeVisible({ timeout: 30_000 });
      const row = page.getByRole('row').filter({ hasText: meta.fullName });
      await expect(row).toBeVisible({ timeout: 30_000 });
      await expect(row.getByRole('cell', { name: DONGBANG_LABEL, exact: true })).toBeVisible();

      // SSR 행이 hydration 전에 보이면 Radix 트리거 클릭이 유실된다(콜드 dev 로드) → 메뉴가 열릴 때까지 재시도
      await expect(async () => {
        await row.getByRole('button', { name: 'Open menu' }).click();
        await expect(page.getByRole('menuitem', { name: '수정' })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      await page.getByRole('menuitem', { name: '수정' }).click();
      const sheet = page.getByRole('dialog').filter({ hasText: '사용자 수정' });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByRole('combobox', { name: '소속' })).toContainText(DONGBANG_LABEL);
      await expect(sheet.getByTestId('user-dongbang-notice')).toBeVisible();
      await expect(sheet.getByRole('button', { name: '저장' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('AC-04: /dashboard/logs 「사용자 선택」 · /dashboard/notifications 「타인 보기」 콤보에 동방 있음 · 선택 시 조회 200', async ({
    browser
  }) => {
    const meta = dongbang();
    const { context, page } = await pageAs(browser, 'admin');
    try {
      await page.goto('/dashboard/logs');
      await expect(page.getByTestId('activity-logs-page')).toBeVisible({ timeout: 30_000 });
      await selectDongbangInCombo(page, 'log-user-combobox', 'log_user');

      await page.goto('/dashboard/notifications');
      await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 30_000 });
      await selectDongbangInCombo(page, 'notif-user-combobox', 'notif_user');
    } finally {
      await context.close();
    }

    const logs = await callAs('admin', (api) => api.get(`/api/activity-logs?log_user=${meta.userId}&limit=20`));
    expect(logs.status, '동방 로그 조회').toBe(200);
    const notifications = await callAs('admin', (api) =>
      api.get(`/api/notifications?notif_user=${meta.userId}&limit=20`)
    );
    expect(notifications.status, '동방 알림 조회').toBe(200);
  });

  test('AC-05 ①②③: 식대 카드 · 내 복지비 proxy(admin · hr) · CS 필터 콤보에 동방 0건', async ({ browser }) => {
    const dongbangEmails = await listActiveDongbangEmails();
    expect(dongbangEmails).toContain(dongbang().email);

    const admin = await pageAs(browser, 'admin');
    try {
      await admin.page.goto('/dashboard/wallet');
      await expect(admin.page.getByTestId('wallet-page-content')).toBeVisible({ timeout: 30_000 });
      await expectComboExcludesDongbang(admin.page, 'wallet-user-combobox', dongbangEmails);

      await admin.page.goto('/dashboard/my-benefits');
      await expectComboExcludesDongbang(admin.page, 'wallet-user-combobox', dongbangEmails);

      await admin.page.goto('/dashboard/support');
      await expect(admin.page.getByTestId('support-page')).toBeVisible({ timeout: 30_000 });
      await expectComboExcludesDongbang(admin.page, 'support-user-combobox', dongbangEmails);
    } finally {
      await admin.context.close();
    }

    // hr(복지비 관리자 · 비admin)은 proxy 콤보 자체가 없고 사용자 목록 API도 403 → 노출 경로 없음
    const hrState = 'e2e/.auth/hr-benefits.json';
    if (!fs.existsSync(hrState)) {
      console.warn('[plan 95 AC-05 ②] hr-benefits.json 없음 → hr 판정 생략 (admin 판정은 위에서 완료)');
      return;
    }
    const hrContext = await browser.newContext({ storageState: hrState });
    try {
      const hrPage = await hrContext.newPage();
      await hrPage.goto('/dashboard/my-benefits');
      await expect(hrPage.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
      await expect(hrPage.getByTestId('wallet-user-combobox')).toHaveCount(0);
      const hrUsers = await hrContext.request.get('/api/users?limit=200');
      expect(hrUsers.status()).toBe(403);
    } finally {
      await hrContext.close();
    }
  });

  test('AC-05 ④: 계약서 author 이름 = 동방 이름 → 독촉 run에서 unmatched (동방 미매칭)', async ({ request }) => {
    // 2026-10-28 사고 재발 방지: 이 run은 실제 SMTP 발송을 일으킨다 (실직원 3명 × 7통).
    // 서버가 E2E_REMINDER_DRY_RUN=1(e2e 범위 계약서만 · 미발송)로 떠 있을 때만 실행한다.
    test.skip(
      process.env.E2E_REMINDER_DRY_RUN !== '1',
      'E2E_REMINDER_DRY_RUN=1 required — POST /api/contracts/reminders sends real emails otherwise'
    );
    const headers = importAuthHeaders();
    test.skip(!headers, 'CONTRACT_IMPORT_TOKEN required');
    const meta = dongbang();
    const documentNumber = uniqueDocumentNumber('E2E95DB');

    const imported = await request.post('/api/contracts/import', {
      headers,
      data: buildImportPayload(documentNumber, { author_name: meta.fullName, author_email: null })
    });
    expect(imported.status(), await imported.text()).toBe(201);

    // 동방 author 매칭 알림(contract.import_author)은 생성되지 않는다 (S-10e 회귀 + S-7 가드)
    expect(await countDisallowedDongbangNotifications(meta.userId)).toBe(0);

    const run = await callAs('admin', (api) =>
      api.post('/api/contracts/reminders', { data: { run_key: `E2E95-${Date.now()}` }, timeout: 120_000 })
    );
    expect(run.status, JSON.stringify(run.body)).toBe(200);
    const unmatched = (run.body.unmatched_targets ?? []) as Array<{ author_name: string; document_numbers: string[] }>;
    const target = unmatched.find((item) => item.document_numbers.includes(documentNumber));
    expect(target, '동방 이름 author는 unmatched').toBeTruthy();
    expect(target!.author_name).toBe(meta.fullName);
    const recipients = (run.body.recipients ?? []) as Array<{ user_id?: string; recipient_user_id?: string }>;
    expect(recipients.some((item) => (item.user_id ?? item.recipient_user_id) === meta.userId)).toBe(false);
  });

  test('AC-05 ⑤: 식대 동기화 fixture에 동방 이름 → 매칭 0 · wallet_syncs user_id null · 잔액 메일 대상 코드 제외', async ({
    request
  }) => {
    const token = process.env.WALLET_SYNC_TOKEN;
    test.skip(!token, 'WALLET_SYNC_TOKEN required');
    const meta = dongbang();

    const response = await request.post('/api/wallet/sync', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        synced_at: new Date().toISOString(),
        items: [{ name: meta.fullName, monthly_limit: 100_000, monthly_remaining: 50_000 }]
      }
    });
    const requestId = response.headers()['x-request-id'];
    try {
      expect(response.status(), await response.text()).toBe(200);
      const body = (await response.json()) as { matched: number; unmatched: string[] };
      expect(body.matched).toBe(0);
      expect(body.unmatched).toEqual([meta.fullName]);

      const { data, error } = await serviceClient()
        .from('wallet_syncs')
        .select('user_id, status, matched_name')
        .eq('request_id', requestId!);
      if (error) throw new Error(error.message);
      expect(data).toHaveLength(1);
      expect(data![0].user_id).toBeNull();
      expect(data![0].status).toBe('unmatched');

      // 잔액 메일 대상(S-5) — 단건 조회에도 scope 적용 (코드 판정)
      expect(readSource('src/features/wallet/api/balance-email.service.server.ts')).toContain('applyDongbangScope(');
      expect(readSource('src/features/wallet-balance-email-logs/api/service.server.ts')).toContain('applyDongbangScope(');
    } finally {
      if (requestId) {
        await serviceClient().from('wallet_syncs').delete().eq('request_id', requestId);
      }
    }
  });

  test('AC-06: 공지 발행 · 워크플로우 결재 요청 · CS 문의 · 복지비 import → 동방 수신 알림 0건(퀵·user.update 제외)', async ({
    playwright
  }) => {
    const meta = dongbang();
    const user = await fixtureUser('user');
    expect(await countDisallowedDongbangNotifications(meta.userId), '사전 상태').toBe(0);

    // ① 공지 발행 (전원 fan-out)
    const title = uniqueAnnouncementTitle('p95-ac06');
    const announcement = await withApi('admin', (api) => createAnnouncementOrThrow(api, { title }));

    // ② 워크플로우 결재 요청 (결재선 user2 · fan-out만)
    const userApi = await apiAs('user');
    try {
      await createDoc(userApi, { steps: [[uid('user2')]] });
      // ③ CS 문의 등록 (admin fan-out)
      const support = await userApi.post('/api/support', {
        data: { title: `E2E95 CS ${Date.now()}`, body: 'plan 95 AC-06 동방 수신 가드' }
      });
      expect(support.status(), await support.text()).toBe(201);
    } finally {
      await userApi.dispose();
    }

    // ④ 복지비 import — 신청자 이름 = 동방 이름은 명단 제외(S-10b) → 422 미매칭 · user 이름은 정상 import(운영진·신청자 fan-out)
    const benefitRequest = await playwright.request.newContext({ storageState: 'e2e/.auth/admin.json' });
    try {
      const rejected = await importBenefitForNotifications(benefitRequest, {
        documentNumber: uniqueBenefitDocumentNumber('95DB'),
        taskKey: `e2e-ben-95db-${Date.now()}`,
        applicantName: meta.fullName
      });
      expect(rejected.status(), await rejected.text()).toBe(422);
      expect(((await rejected.json()) as { message: string }).message).toContain('이름이 일치하지 않습니다');

      const imported = await importBenefitForNotifications(benefitRequest, {
        documentNumber: uniqueBenefitDocumentNumber('95OK'),
        taskKey: `e2e-ben-95ok-${Date.now()}`,
        applicantName: user.fullName
      });
      expect([200, 201], await imported.text()).toContain(imported.status());
    } finally {
      await benefitRequest.dispose();
    }

    // 동기점: user는 공지 알림 1건 수신
    const announcementCount = async (userId: string) => {
      const { count, error } = await serviceClient()
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', userId)
        .eq('type', 'announcement.published')
        .eq('metadata->>announcement_id', String(announcement.id));
      if (error) throw new Error(error.message);
      return count ?? 0;
    };
    await expect.poll(() => announcementCount(user.userId), { timeout: 20_000 }).toBe(1);
    expect(await announcementCount(meta.userId), '동방 공지 알림').toBe(0);
    expect(await countDisallowedDongbangNotifications(meta.userId), '동방 비허용 알림').toBe(0);
  });

  test('AC-08: dongbang.json GET preferences groups 2개 · Dialog Switch 2개 · PUT announcement 400 · PUT quick_request 200', async ({
    browser
  }) => {
    const dongbangApi = await apiAs('dongbang');
    try {
      await resetPushStateForUser(dongbangApi);
      const prefs = await getPushPreferences(dongbangApi);
      expect(prefs.groups.map((group) => group.key)).toEqual(['profile', 'quick_request']);

      const invalid = await dongbangApi.put(PUSH_PREFERENCES_PATH, { data: { disabled_groups: ['announcement'] } });
      expect(invalid.status()).toBe(400);
      expect(invalid.headers()['x-request-id']).toBeTruthy();
      expect(((await invalid.json()) as { message: string }).message).toBe(PUSH_INVALID_GROUP_MESSAGE);

      const valid = await dongbangApi.put(PUSH_PREFERENCES_PATH, { data: { disabled_groups: ['quick_request'] } });
      expect(valid.status()).toBe(200);
      expect(((await valid.json()) as { data: { disabled_groups: string[] } }).data.disabled_groups).toEqual([
        'quick_request'
      ]);
      const profileOnly = await dongbangApi.put(PUSH_PREFERENCES_PATH, { data: { disabled_groups: ['profile'] } });
      expect(profileOnly.status()).toBe(200);
      await resetPushStateForUser(dongbangApi);
    } finally {
      await dongbangApi.dispose();
    }

    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await page.goto('/dashboard/notifications');
      await expect(page.getByTestId('notifications-page')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('push-preferences-open').click();
      const dialog = page.getByTestId('push-preferences-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByTestId('push-group-list')).toBeVisible({ timeout: 15_000 });
      await expect(dialog.getByRole('switch')).toHaveCount(2);
      await expect(dialog.getByTestId('push-group-profile')).toBeVisible();
      await expect(dialog.getByTestId('push-group-quick_request')).toBeVisible();
      await expect(dialog.getByTestId('push-group-announcement')).toHaveCount(0);
      await expect(dialog.getByTestId('push-group-workflow')).toHaveCount(0);
      await page.keyboard.press('Escape');

      // 프로필 페이지 「휴대폰 알림」 섹션도 같은 RSC prefetch(`getPushPreferencesForUser`)를 쓴다 → 2그룹
      await page.goto('/dashboard/profile', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/dashboard\/profile$/, { timeout: 30_000 });
      const profileOpen = page.getByTestId('push-section-preferences-open');
      await expect(profileOpen).toBeVisible({ timeout: 30_000 });
      await profileOpen.click();
      const profileDialog = page.getByTestId('push-preferences-dialog');
      await expect(profileDialog.getByTestId('push-group-list')).toBeVisible({ timeout: 15_000 });
      await expect(profileDialog.getByRole('switch')).toHaveCount(2);
    } finally {
      await context.close();
    }
  });

  test('AC-09: 조직도·복지비 명단 API에 동방 없음 (89 AC-07 API 회귀 · UI는 quick-workflow/access.spec 회귀)', async () => {
    const meta = dongbang();
    await withApi('user', async (api) => {
      for (const affiliation of ['wake', 'sans', 'sans_foundry']) {
        const response = await api.get(`/api/org-chart?affiliation=${affiliation}`);
        expect(response.status(), affiliation).toBe(200);
        const text = await response.text();
        expect(text, `org-chart ${affiliation}`).not.toContain(meta.userId);
      }
    });
    await withApi('admin', async (api) => {
      for (const affiliation of ['wake', 'sans', 'sans_foundry', 'dongbang']) {
        const response = await api.get(`/api/benefits?affiliation=${affiliation}`);
        if (response.status() !== 200) {
          expect(affiliation, 'only dongbang may be rejected').toBe('dongbang');
          continue;
        }
        const body = await readJson<{ data?: { members?: { user_id: string }[] } }>(response);
        expect((body.data?.members ?? []).map((member) => member.user_id)).not.toContain(meta.userId);
      }
    });
  });

  test('AC-10: SQL 94 — 동방 세션 workflow 양식 4테이블 select 0행 · user 세션 templates ≥1', async () => {
    const meta = dongbang();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const selectAs = async (email: string, password: string) => {
      const client = createClient(url, anonKey(), { auth: { autoRefreshToken: false, persistSession: false } });
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const result: Record<string, number> = {};
      for (const table of [
        'workflow_templates',
        'workflow_template_fields',
        'workflow_template_default_approvers',
        'workflow_template_default_referrers'
      ]) {
        const { data, error: selectError } = await client.from(table).select('*').limit(20);
        if (selectError) throw new Error(`${table}: ${selectError.message}`);
        result[table] = data?.length ?? 0;
      }
      return result;
    };

    const asDongbang = await selectAs(meta.email, meta.password);
    expect(asDongbang).toEqual({
      workflow_templates: 0,
      workflow_template_fields: 0,
      workflow_template_default_approvers: 0,
      workflow_template_default_referrers: 0
    });

    const asUser = await selectAs(process.env.E2E_USER_EMAIL!, resolveE2EPassword(process.env.E2E_USER_PASSWORD!));
    expect(asUser.workflow_templates).toBeGreaterThanOrEqual(1);
    expect(asUser.workflow_template_fields).toBeGreaterThanOrEqual(1);
  });

  test('AC-11: 동방 allowlist 변경 없음 — 퀵 API·알림·푸시 설정 200 · 사용자 목록·조직도 403 (89 AC-04~06 회귀)', async () => {
    const allowed = ['/api/quick-request?limit=5', '/api/notifications?limit=5', PUSH_PREFERENCES_PATH, '/api/activity-logs?limit=5'];
    for (const path of allowed) {
      const result = await callAs('dongbang', (api) => api.get(path));
      expect(result.status, path).toBe(200);
    }
    for (const path of ['/api/users?limit=5', '/api/org-chart?affiliation=wake', '/api/benefits?affiliation=wake']) {
      const result = await callAs('dongbang', (api) => api.get(path));
      expect(result.status, path).toBe(403);
    }
  });

  test('plan 102 AC-04: dongbang.json GET /api/birthdays → 403 「접근 권한이 없습니다.」 · 생일 있는 동방 사용자는 명단 0건(S-10a)', async () => {
    const denied = await callAs('dongbang', (api) => api.get('/api/birthdays'));
    expect(denied.status, JSON.stringify(denied.body)).toBe(403);
    expect(denied.body.message).toBe('접근 권한이 없습니다.');

    // 동방 fixture는 birthday null이라 제외 판정이 무의미 → 생일이 오늘인 active 동방 일회용 사용자로 확인
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    const created = await createOrgChartTestUser('e2e102-dongbang95', {
      fullName: `E2E생일-dongbang95-${Date.now()}`,
      affiliation: 'dongbang',
      rank: null,
      position_level: null,
      birthday: `1992-${today.slice(5)}`
    });
    try {
      const listed = await callAs('admin', (api) => api.get('/api/birthdays'));
      expect(listed.status, JSON.stringify(listed.body)).toBe(200);
      const celebrants = (listed.body.data as { celebrants: { user_id: string; affiliation: string | null }[] })
        .celebrants;
      expect(celebrants.length).toBeGreaterThan(0);
      const ids = celebrants.map((celebrant) => celebrant.user_id);
      expect(ids).not.toContain(created.userId);
      expect(ids).not.toContain(dongbang().userId);
      expect(celebrants.filter((celebrant) => celebrant.affiliation === 'dongbang')).toHaveLength(0);
    } finally {
      await serviceClient().auth.admin.deleteUser(created.userId);
    }
  });

  test('AC-07: 동방 구독 1개 → admin 이름 변경 + user 퀵 등록 → 동방 알림 2건(user.update·vendor_event) · 푸시 2건(last_used_at 갱신) · 그 밖 0', async () => {
    const meta = dongbang();
    const startedAt = new Date();
    const renamed = `${meta.fullName} 개명`;
    const dongbangApi = await apiAs('dongbang');
    const adminApi = await apiAs('admin');
    const lastUsed = async () => (await getPushPreferences(dongbangApi)).devices[0]?.last_used_at ?? null;
    try {
      await resetPushStateForUser(dongbangApi);
      expect((await registerMockDevice(dongbangApi, mockEndpoint('ok'), 'E2E95 dongbang device')).status()).toBe(201);
      expect(await lastUsed()).toBeNull();

      // ① admin이 동방 프로필 이름 변경 → user.update
      const rename = await adminApi.put(`/api/users/${meta.userId}`, {
        data: { full_name: renamed, affiliation: 'dongbang', phone: '01055550001' }
      });
      expect(rename.status(), await rename.text()).toBe(200);
      await expect
        .poll(async () => (await listDongbangNotificationsSince(meta.userId, startedAt.toISOString())).map((row) => row.type), {
          timeout: 20_000
        })
        .toEqual(['user.update']);
      await expect.poll(lastUsed, { timeout: 20_000, message: 'user.update 푸시 last_used_at' }).not.toBeNull();
      const firstUsed = await lastUsed();
      expect(new Date(firstUsed!).getTime()).toBeGreaterThan(startedAt.getTime() - 2_000);

      // ② user 퀵 등록 → vendor_event
      await new Promise((resolve) => setTimeout(resolve, 1_100));
      const created = await createAs('user', uniqueTag('E2E95PUSH'));
      await expect
        .poll(async () => (await listDongbangNotificationsSince(meta.userId, startedAt.toISOString())).map((row) => row.type), {
          timeout: 20_000
        })
        .toEqual(['user.update', 'quick_request.vendor_event']);
      await expect
        .poll(async () => {
          const used = await lastUsed();
          return used ? new Date(used).getTime() > new Date(firstUsed!).getTime() : false;
        }, { timeout: 20_000, message: 'vendor_event 푸시 last_used_at 재갱신' })
        .toBe(true);

      const rows = await listDongbangNotificationsSince(meta.userId, startedAt.toISOString());
      expect(rows).toHaveLength(2);
      expect(rows[1].title).toContain(created.requestNo);
      expect(await countDisallowedDongbangNotifications(meta.userId), '그 밖 알림 0').toBe(0);
    } finally {
      await adminApi.put(`/api/users/${meta.userId}`, {
        data: { full_name: meta.fullName, affiliation: 'dongbang', phone: '01055550001' }
      });
      await resetPushStateForUser(dongbangApi);
      await adminApi.dispose();
      await dongbangApi.dispose();
    }
  });
});
