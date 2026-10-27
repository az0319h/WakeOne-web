import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { createAnnouncementOrThrow, uniqueAnnouncementTitle } from '../announcements/helpers';
import { resolveE2EPassword } from '../helpers/e2e-credentials';
import { createActiveTestUser, createPendingGoogleUser } from '../helpers/supabase-direct-auth';
import { fillKbarSearch, kbarSearchInput } from '../kbar/helpers';
import {
  anonKey,
  BASE_URL,
  findActivityLog,
  MSG,
  pageAs,
  profileByEmail,
  readAccountMeta,
  readJson,
  serviceClient,
  toast,
  withApi
} from './helpers';

// plan 89 §A 소속·접근 차단 — docs/plans/89 (퀵 업무 흐름 plan) · plan 92 AC-29 재실행 대상
test.describe('plan 89 A. 동방특송 소속 · 접근 차단', () => {
  test.describe.configure({ timeout: 120_000 });

  test('AC-01: 승인 Sheet 「동방특송」 → 부서·직급·리더 숨김 · 승인 · DB null · user.approve 로그', async ({
    browser
  }) => {
    const pending = await createPendingGoogleUser('ac01-p89-dongbang');
    const fullName = `E2E 동방승인 ${Date.now()}`;
    const { context, page } = await pageAs(browser, 'admin');
    try {
      await page.goto(
        `/dashboard/users?status=pending_approval&name=${encodeURIComponent(pending.email.split('@')[0])}`
      );
      await expect(page.getByRole('heading', { name: '사용자 관리', exact: true })).toBeVisible({ timeout: 30_000 });
      const row = page.getByRole('row').filter({ hasText: pending.email });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole('button', { name: '수락' }).click({ force: true });

      const sheet = page.getByRole('dialog').filter({ hasText: '가입 요청 승인' });
      await expect(sheet).toBeVisible();
      await sheet.getByRole('textbox', { name: '이름' }).fill(fullName);
      await sheet.getByRole('textbox', { name: '연락처' }).fill('01012345678');
      await sheet.getByRole('combobox', { name: '시스템 역할' }).click();
      await page.getByRole('option', { name: 'User', exact: true }).click();
      await sheet.getByRole('combobox', { name: '소속' }).click();
      await page.getByRole('option', { name: '동방특송', exact: true }).click();

      await expect(sheet.getByTestId('user-dongbang-notice')).toHaveText(
        '동방특송은 퀵 화면만 이용할 수 있습니다.'
      );
      await expect(sheet.getByRole('combobox', { name: '부서/사업장' })).toHaveCount(0);
      await expect(sheet.getByRole('combobox', { name: '직급' })).toHaveCount(0);
      await expect(sheet.getByRole('combobox', { name: /리더/ })).toHaveCount(0);

      const approvePromise = page.waitForResponse(
        (res) => res.url().includes('/approval/approve') && res.request().method() === 'POST'
      );
      await sheet.getByRole('button', { name: '승인' }).click();
      const approveResponse = await approvePromise;
      expect(approveResponse.status()).toBe(200);
      await expect(toast(page, '사용자가 승인되었습니다.')).toBeVisible({ timeout: 15_000 });

      const profile = await profileByEmail(pending.email);
      expect(profile.affiliation).toBe('dongbang');
      expect(profile.rank).toBeNull();
      expect(profile.position_level).toBeNull();
      expect(profile.leader_role).toBeNull();
      expect(profile.status).toBe('active');

      const requestId = approveResponse.headers()['x-request-id'];
      expect(requestId).toBeTruthy();
      await findActivityLog(
        'user.approve',
        (item) => item.request_id === requestId && item.http_status === 200,
        'user.approve log'
      );
    } finally {
      await context.close();
    }
  });

  test('AC-02: 수정 Sheet 소속 → 「동방특송」 저장 · 조직 필드 숨김·null · 표 소속 「동방특송」', async ({
    browser
  }) => {
    const fullName = `E2E 동방수정 ${Date.now()}`;
    const created = await createActiveTestUser('ac02-p89-dongbang', { fullName });
    const { context, page } = await pageAs(browser, 'admin');
    try {
      await page.goto(`/dashboard/users?name=${encodeURIComponent(fullName)}`);
      const row = page.getByRole('row').filter({ hasText: fullName });
      await expect(row).toBeVisible({ timeout: 30_000 });
      await row.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('menuitem', { name: '수정' }).click();

      const sheet = page.getByRole('dialog').filter({ hasText: '사용자 수정' });
      await expect(sheet).toBeVisible();
      await sheet.getByRole('combobox', { name: '소속' }).click();
      await page.getByRole('option', { name: '동방특송', exact: true }).click();
      await expect(sheet.getByTestId('user-dongbang-notice')).toBeVisible();
      await expect(sheet.getByRole('combobox', { name: '부서/사업장' })).toHaveCount(0);
      await expect(sheet.getByRole('combobox', { name: '직급' })).toHaveCount(0);

      await sheet.getByRole('button', { name: '저장' }).click();
      await expect(toast(page, '사용자 정보가 저장되었습니다.')).toBeVisible({ timeout: 15_000 });

      const profile = await profileByEmail(created.email);
      expect(profile.affiliation).toBe('dongbang');
      expect(profile.rank).toBeNull();
      expect(profile.position_level).toBeNull();
      expect(profile.leader_role).toBeNull();

      await page.goto(`/dashboard/users?name=${encodeURIComponent(fullName)}`);
      const updatedRow = page.getByRole('row').filter({ hasText: fullName });
      await expect(updatedRow).toBeVisible({ timeout: 30_000 });
      await expect(updatedRow.getByRole('cell', { name: '동방특송', exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('AC-03: 동방특송 사이드바·kbar — 퀵 대시보드·알림·활동 로그만', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await page.goto('/dashboard/quick', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });

      for (const name of ['퀵 대시보드', '알림', '활동 로그']) {
        await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
      }
      for (const name of [
        '퀵 요청하기',
        '대시보드',
        '조직도',
        '공지사항',
        '칸반',
        '문서함',
        '사용자 관리',
        '계약서 관리',
        '내 복지비',
        'CS 문의'
      ]) {
        await expect(page.getByRole('link', { name, exact: true }), `nav ${name}`).toHaveCount(0);
      }
      await expect(page.getByTestId('quick-request-new-button')).toHaveCount(0);

      // kbar — 같은 필터
      await page.keyboard.press('ControlOrMeta+k');
      await expect(kbarSearchInput(page)).toBeVisible({ timeout: 10_000 });
      await fillKbarSearch(page, '퀵 대시보드');
      await expect(page.getByTestId('kbar-result-item').filter({ hasText: '퀵 대시보드' })).toHaveCount(1, {
        timeout: 10_000
      });
      for (const query of ['퀵 요청하기', '조직도', '공지사항']) {
        await fillKbarSearch(page, query);
        await page.waitForTimeout(400);
        await expect(
          page.getByTestId('kbar-result-item').filter({ hasText: query }),
          `kbar ${query}`
        ).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  });

  test('AC-04: 동방특송 금지 페이지 직접 입력 → /dashboard/quick · access-denied 토스트', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      const cases: { path: string; toast: string | null }[] = [
        { path: '/dashboard', toast: null },
        { path: '/dashboard/overview', toast: null },
        { path: '/dashboard/org-chart', toast: '동방특송 계정은 퀵 화면만 이용할 수 있습니다.' },
        { path: '/dashboard/announcements', toast: '동방특송 계정은 퀵 화면만 이용할 수 있습니다.' },
        { path: '/dashboard/my-benefits', toast: '동방특송 계정은 퀵 화면만 이용할 수 있습니다.' },
        { path: '/dashboard/kanban', toast: '동방특송 계정은 퀵 화면만 이용할 수 있습니다.' },
        {
          path: '/dashboard/quick/request',
          toast: '동방특송 계정은 퀵 요청을 등록할 수 없습니다.'
        },
        { path: '/dashboard/support', toast: '동방특송 계정은 퀵 화면만 이용할 수 있습니다.' }
      ];
      for (const item of cases) {
        await page.goto(item.path, { waitUntil: 'domcontentloaded' });
        await expect(page, item.path).toHaveURL(/\/dashboard\/quick(\?.*)?$/, { timeout: 30_000 });
        await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
        if (item.toast) {
          await expect(toast(page, item.toast), `toast ${item.path}`).toBeVisible({ timeout: 10_000 });
        } else {
          await page.waitForTimeout(800);
          await expect(
            toast(page, '동방특송 계정은 퀵 화면만 이용할 수 있습니다.'),
            `no toast ${item.path}`
          ).toHaveCount(0);
        }
      }
    } finally {
      await context.close();
    }
  });

  test('AC-05: 동방특송 금지 API → 403 {"success":false,"message":"접근 권한이 없습니다."}', async () => {
    await withApi('dongbang', async (api) => {
      const calls: { label: string; run: () => ReturnType<typeof api.get> }[] = [
        { label: 'GET org-chart', run: () => api.get('/api/org-chart?affiliation=wake') },
        { label: 'GET announcements', run: () => api.get('/api/announcements') },
        { label: 'GET users', run: () => api.get('/api/users') },
        { label: 'GET my-benefits', run: () => api.get('/api/my-benefits') },
        { label: 'GET google-tasks lists', run: () => api.get('/api/google-tasks/lists') },
        { label: 'POST quick-request', run: () => api.post('/api/quick-request', { data: {} }) },
        { label: 'GET quick-request notes', run: () => api.get('/api/quick-request/notes') },
        {
          label: 'GET quick-request recent-addresses',
          run: () => api.get('/api/quick-request/recent-addresses')
        }
      ];
      for (const call of calls) {
        const response = await call.run();
        expect(response.status(), call.label).toBe(403);
        expect(await response.json(), call.label).toEqual({
          success: false,
          message: MSG.forbidden
        });
      }
    });
  });

  test('AC-06: 동방특송 허용 API → 200 (/api/profile은 GET 핸들러가 없어 proxy 통과 후 405 · PATCH 도달)', async () => {
    await withApi('dongbang', async (api) => {
      // [기획 정정 필요] plan AC-06의 `GET /api/profile`은 Route에 GET이 없다(PATCH만). proxy가 막지 않았는지(≠403)만 본다
      // PATCH는 기존 정책상 관리자 전용(Route 403 「프로필 정보는 관리자만 수정할 수 있습니다.」) — proxy 403 본문이 아니면 통과
      const profileGet = await api.get('/api/profile');
      expect(profileGet.status(), 'GET /api/profile (proxy 통과 · 405)').toBe(405);
      const profilePatch = await api.patch('/api/profile', { data: {} });
      const patchBody = (await profilePatch.json()) as { message?: string };
      expect(patchBody.message, 'PATCH /api/profile proxy 통과').not.toBe(MSG.forbidden);
      for (const path of [
        '/api/notifications',
        '/api/activity-logs',
        '/api/quick-request',
        '/api/quick-request/summary'
      ]) {
        const response = await api.get(path);
        expect(response.status(), path).toBe(200);
      }
    });
  });

  test('AC-07: 동방특송은 조직도·복지비 명단·공지 fan-out 제외 · announcements RLS 0행', async ({
    browser
  }) => {
    const dongbang = readAccountMeta('dongbang');

    // ① 조직도 (user.json) — 각 소속 탭 API에 동방 사용자 없음 + UI 탭에 「동방특송」 없음
    await withApi('user', async (api) => {
      for (const affiliation of ['wake', 'sans', 'sans_foundry']) {
        const response = await api.get(`/api/org-chart?affiliation=${affiliation}`);
        expect(response.status(), affiliation).toBe(200);
        const text = await response.text();
        expect(text, `org-chart ${affiliation}`).not.toContain(dongbang.userId);
        expect(text).not.toContain(dongbang.fullName);
      }
    });
    const { context, page } = await pageAs(browser, 'user');
    try {
      await page.goto('/dashboard/org-chart', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('tab', { name: '동방특송' })).toHaveCount(0);
      await expect(page.getByText(dongbang.fullName)).toHaveCount(0);
    } finally {
      await context.close();
    }

    // ② 복지비 명단 (admin)
    await withApi('admin', async (api) => {
      for (const affiliation of ['wake', 'sans', 'sans_foundry', 'dongbang']) {
        const response = await api.get(`/api/benefits?affiliation=${affiliation}`);
        if (response.status() !== 200) {
          expect(affiliation, 'only dongbang may be rejected').toBe('dongbang');
          continue;
        }
        const body = await readJson<{ data?: { members?: { user_id: string }[] } }>(response);
        const ids = (body.data?.members ?? []).map((member) => member.user_id);
        expect(ids, `benefits ${affiliation}`).not.toContain(dongbang.userId);
      }
    });
    const admin = await pageAs(browser, 'admin');
    try {
      await admin.page.goto(`/dashboard/benefits?name=${encodeURIComponent(dongbang.fullName)}`, {
        waitUntil: 'domcontentloaded'
      });
      await expect(admin.page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
      await admin.page.waitForTimeout(1_500);
      await expect(admin.page.getByText(dongbang.fullName)).toHaveCount(0);
    } finally {
      await admin.context.close();
    }

    // ③ 공지 발행 fan-out — 동방특송 수신 0건 (user는 1건)
    const title = uniqueAnnouncementTitle('p89-ac07');
    const announcement = await withApi('admin', (api) => createAnnouncementOrThrow(api, { title }));
    const user = await profileByEmail(process.env.E2E_USER_EMAIL!);
    const countFor = async (userId: string) => {
      const { count, error } = await serviceClient()
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', userId)
        .eq('type', 'announcement.published')
        .eq('metadata->>announcement_id', String(announcement.id));
      if (error) throw new Error(error.message);
      return count ?? 0;
    };
    await expect.poll(() => countFor(user.user_id), { timeout: 20_000 }).toBe(1);
    expect(await countFor(dongbang.userId)).toBe(0);

    // ④ Supabase client 직접 조회 (RLS) — 동방 세션 0행 · user 세션 ≥1행
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const selectAs = async (email: string, password: string) => {
      const client = createClient(url, anonKey(), {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);
      const { data, error } = await client.from('announcements').select('id').limit(5);
      if (error) throw new Error(error.message);
      const attachments = await client.from('announcement_attachments').select('id').limit(5);
      return { announcements: data?.length ?? 0, attachments: attachments.data?.length ?? 0 };
    };
    const dongbangRows = await selectAs(dongbang.email, dongbang.password);
    expect(dongbangRows).toEqual({ announcements: 0, attachments: 0 });
    const userRows = await selectAs(
      process.env.E2E_USER_EMAIL!,
      resolveE2EPassword(process.env.E2E_USER_PASSWORD)
    );
    expect(userRows.announcements).toBeGreaterThan(0);
    expect(BASE_URL).toBeTruthy();
  });
});
