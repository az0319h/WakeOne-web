import { expect, test, type Page } from '@playwright/test';
import { createOrgChartTestUser, readCanvasInnerText, uniqueOrgChartEmail } from '../helpers/org-chart';
import { signInWithSupabasePassword } from '../helpers/supabase-direct-auth';
import {
  clickDesktopRegister,
  confirmPreviewAndRegister,
  fillQuickRequestOrder,
  gotoQuickRequest,
  previewDialog,
  quickRequestMain,
  VIEWPORT_DESKTOP
} from '../quick-request/helpers';
import {
  buildCreateBody,
  callAs,
  createQuickRequestApi,
  dbNotificationsByEvent,
  dbQuickRequest,
  expectDetailStatus,
  gotoDetail,
  pageAs,
  seedQuickRequest,
  serviceClient,
  uniqueTag,
  withApi
} from '../quick-workflow/helpers';
import { PHONE_TEXT, SRC_ROOT, grepDir } from './helpers';

/**
 * plan 97 §C 전화번호 9~11자리 (AC-18 ~ AC-22 · AC-17은 `node --test src/lib/__tests__/phone.test.mjs`)
 * docs/plans/97_quick-period-filter-recent-address-split-phone-plan.md
 * - 퀵 폼(user) · 배차 Dialog(dongbang) · users 수정 Sheet(admin) · 조직도 hover·프로필(user) 회귀
 */
const PHONE_02_9 = '021234567';
const PHONE_02_10 = '0212345678';
const PHONE_031 = '0311234567';
const PHONE_010 = '01012345678';
const PHONE_SHORT = '0101234';

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

async function gotoWakeOrgChartDesktop(page: Page) {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto('/dashboard/org-chart?affiliation=wake');
  await expect(page.getByTestId('org-chart-canvas')).toBeVisible({ timeout: 30_000 });
}

async function waitForPersonOnCanvas(page: Page, fullName: string) {
  const canvas = page.getByTestId('org-chart-canvas');
  await expect.poll(async () => readCanvasInnerText(canvas), { timeout: 30_000 }).toContain(fullName);
}

async function hoverPersonNode(page: Page, userId: string) {
  const node = page.getByTestId(`org-chart-person-node-${userId}`);
  await expect(node).toBeVisible({ timeout: 30_000 });
  await node.scrollIntoViewIfNeeded();
  await node.hover();
  const card = page.getByTestId('org-chart-person-hover-card');
  await expect(card).toBeVisible({ timeout: 10_000 });
  return card;
}

async function expectProfilePhoneAs(browser: import('@playwright/test').Browser, email: string, password: string, display: string) {
  const { storageState } = await signInWithSupabasePassword(email, password);
  const context = await browser.newContext({ storageState, viewport: VIEWPORT_DESKTOP });
  const page = await context.newPage();
  try {
    await page.goto('/dashboard/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('profile-readonly-phone')).toHaveText(display, { timeout: 30_000 });
  } finally {
    await context.close();
  }
}

async function dbProfilePhone(userId: string): Promise<string | null> {
  const { data, error } = await serviceClient().from('profiles').select('phone').eq('user_id', userId).single();
  if (error) throw new Error(error.message);
  return (data?.phone as string | null) ?? null;
}

test.describe('plan 97 C. 전화번호 9~11자리', () => {
  test.describe.configure({ timeout: 150_000 });

  test('AC-18: 퀵 요청 폼 — 출발 연락처 021234567(UI 등록) · 0311234567 / 01012345678(API 등록) → 상세 02-123-4567·031-123-4567·010-1234-5678 · tel: 숫자 그대로 · 0101234 → 「연락처는 숫자 9~11자리로 입력해 주세요.」 + API 400', async ({
    page
  }) => {
    const tag = uniqueTag('E2E97PH');
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const main = quickRequestMain(page);
    const phoneInput = main.getByTestId('quick-request-origin-contact-phone');
    await expect(phoneInput).toHaveAttribute('placeholder', PHONE_TEXT.placeholder);
    await expect(main.getByText(PHONE_TEXT.hint).first()).toBeVisible();

    await fillQuickRequestOrder(page);
    // 하이픈 입력 → 숫자만 남는다 (designer K4)
    await phoneInput.fill('02-123-4567');
    await expect(phoneInput).toHaveValue(PHONE_02_9);

    // 잘못된 자릿수 → 제출 시 에러 · 미리보기 미오픈
    await phoneInput.fill(PHONE_SHORT);
    await clickDesktopRegister(page);
    await expect(main.getByText(PHONE_TEXT.error, { exact: true }).first()).toBeVisible();
    await expect(previewDialog(page)).toHaveCount(0);

    // 9자리 02 → 등록 성공
    await phoneInput.fill(PHONE_02_9);
    await main.getByTestId('quick-request-origin-detail-address').fill(`${tag} 출발 9자리`);
    await clickDesktopRegister(page);
    const { requestNo } = await confirmPreviewAndRegister(page);
    const route = page.getByTestId('quick-detail-section-route');
    const link = route.getByRole('link', { name: '02-123-4567', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', `tel:${PHONE_02_9}`);
    const row = await dbQuickRequest(requestNo);
    expect(row.status).toBe('requested');

    // API — 10자리·11자리 등록 성공 · 상세 표시
    const created = await withApi('user', async (api) => {
      const ten = await createQuickRequestApi(
        api,
        buildCreateBody(tag, { origin: { ...buildCreateBody(tag).origin, contactPhone: PHONE_031 } })
      );
      const eleven = await createQuickRequestApi(
        api,
        buildCreateBody(tag, { origin: { ...buildCreateBody(tag).origin, contactPhone: PHONE_010 } })
      );
      return { ten, eleven };
    });
    await gotoDetail(page, created.ten.requestNo);
    const tenLink = page.getByTestId('quick-detail-section-route').getByRole('link', { name: '031-123-4567', exact: true });
    await expect(tenLink).toBeVisible();
    await expect(tenLink).toHaveAttribute('href', `tel:${PHONE_031}`);
    await gotoDetail(page, created.eleven.requestNo);
    const elevenLink = page.getByTestId('quick-detail-section-route').getByRole('link', { name: '010-1234-5678', exact: true });
    await expect(elevenLink).toBeVisible();
    await expect(elevenLink).toHaveAttribute('href', `tel:${PHONE_010}`);

    // API — 7자리 400
    const bad = await callAs('user', (api) =>
      api.post('/api/quick-request', {
        data: buildCreateBody(tag, { origin: { ...buildCreateBody(tag).origin, contactPhone: PHONE_SHORT } })
      })
    );
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain(PHONE_TEXT.error);
    const bad8 = await callAs('user', (api) =>
      api.post('/api/quick-request', {
        data: buildCreateBody(tag, { destination: { ...buildCreateBody(tag).destination, contactPhone: '12345678' } })
      })
    );
    expect(bad8.status).toBe(400);
    expect(JSON.stringify(bad8.body)).toContain(PHONE_TEXT.error);
  });

  test('AC-19: 동방 배차 Dialog — 기사 연락처 0212345678 저장 성공 · DB driver_phone=0212345678 · 상세 02-1234-5678 · 알림 본문에 연락처 없음', async ({
    browser
  }) => {
    const { requestNo } = await seedQuickRequest('dispatching', 'user', uniqueTag('E2E97DISP'));
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDetail(page, requestNo);
      await page.getByTestId('quick-detail-dispatch').click();
      const dialog = page.getByTestId('quick-dispatch-dialog');
      await expect(dialog).toBeVisible();
      const phone = dialog.getByTestId('quick-dispatch-driver-phone');
      await expect(phone).toHaveAttribute('placeholder', PHONE_TEXT.placeholder);
      await expect(dialog.getByText(PHONE_TEXT.hint, { exact: true })).toBeVisible();

      await dialog.getByTestId('quick-dispatch-estimated-amount').fill('20000');
      await dialog.getByTestId('quick-dispatch-vehicle-info').fill('21마 6543');
      await dialog.getByTestId('quick-dispatch-driver-name').fill('홍길동');
      await phone.fill(PHONE_SHORT);
      await dialog.getByTestId('quick-dispatch-submit').click();
      await expect(dialog.getByText(PHONE_TEXT.error, { exact: true })).toBeVisible();

      await phone.fill(PHONE_02_10);
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes(`/api/quick-request/${requestNo}/dispatch`) && res.request().method() === 'POST'
      );
      await dialog.getByTestId('quick-dispatch-submit').click();
      const response = await responsePromise;
      expect(response.status(), await response.text()).toBe(200);
      await expect(dialog).toBeHidden({ timeout: 15_000 });
      await expectDetailStatus(page, 'dispatched');
      const driverPhone = page.getByTestId('quick-detail-driver-phone');
      await expect(driverPhone).toHaveText('02-1234-5678');
      await expect(driverPhone).toHaveAttribute('href', `tel:${PHONE_02_10}`);
    } finally {
      await context.close();
    }

    const { data, error } = await serviceClient().from('quick_requests').select('driver_phone').eq('request_no', requestNo).single();
    if (error) throw new Error(error.message);
    expect(data?.driver_phone).toBe(PHONE_02_10);

    const notifications = await dbNotificationsByEvent(requestNo, 'dispatched');
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    for (const row of notifications) {
      expect(row.body).not.toContain(PHONE_02_10);
      expect(row.body).not.toContain('02-1234-5678');
      expect(row.title).not.toContain(PHONE_02_10);
    }
  });

  test('AC-20: admin users 수정 Sheet — 0212345678 저장 → 표·프로필 모달 02-1234-5678 · 본인 프로필 읽기 전용 동일 · PUT 8자리 400 「연락처는 숫자 9~11자리로 입력해 주세요.」 · DB CHECK 통과', async ({
    browser
  }) => {
    const email = uniqueOrgChartEmail('p97-users-phone');
    const fullName = `E2E 전화97 ${Date.now()}`;
    // 수정 Sheet 조직 검증을 통과하는 wake 부서(마케팅팀·과장)로 만든다 — `경영진` fixture는 「소속에 맞지 않는 부서」(기존 users/list 알려진 실패)
    const created = await createOrgChartTestUser('p97-users-phone', {
      email,
      fullName,
      phone: PHONE_010,
      rank: '마케팅팀',
      position_level: '과장'
    });

    const { context, page } = await pageAs(browser, 'admin');
    try {
      await page.goto('/dashboard/users', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: '사용자 관리', exact: true })).toBeVisible({ timeout: 30_000 });
      const targetRow = page.getByRole('row').filter({ hasText: email });
      await expect(targetRow).toBeVisible({ timeout: 30_000 });
      await expect(targetRow.getByRole('cell', { name: '010-1234-5678' })).toBeVisible();
      await targetRow.getByRole('button', { name: '프로필 보기' }).click();
      await page.getByRole('button', { name: '조직 정보 수정' }).click();
      const dialog = page.getByRole('dialog', { name: '사용자 수정' });
      await expect(dialog).toBeVisible();
      const phone = dialog.getByRole('textbox', { name: '연락처' });
      await expect(phone).toHaveAttribute('placeholder', PHONE_TEXT.placeholder);
      await expect(dialog.getByText(PHONE_TEXT.hint, { exact: true })).toBeVisible();

      await phone.clear();
      await phone.fill('12345678');
      await dialog.getByRole('button', { name: '저장' }).click();
      await expect(dialog.getByRole('alert').filter({ hasText: PHONE_TEXT.error })).toBeVisible();

      await phone.clear();
      await phone.fill(PHONE_02_10);
      await dialog.getByRole('button', { name: '저장' }).click();
      await expect(page.getByText('사용자 정보가 저장되었습니다.')).toBeVisible({ timeout: 30_000 });
      const profileDialog = page.getByRole('dialog', { name: new RegExp(fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
      await expect(profileDialog.getByText('02-1234-5678')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(profileDialog).toBeHidden();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('row').filter({ hasText: email }).getByRole('cell', { name: '02-1234-5678' })).toBeVisible({
        timeout: 30_000
      });
    } finally {
      await context.close();
    }

    expect(await dbProfilePhone(created.userId)).toBe(PHONE_02_10);
    await expectProfilePhoneAs(browser, created.email, created.password, '02-1234-5678');

    const bad = await callAs('admin', (api) =>
      api.put(`/api/users/${created.userId}`, {
        data: { affiliation: 'wake', rank: '마케팅팀', position_level: '과장', system_role: 'user', birthday: '1990-01-01', phone: '12345678' }
      })
    );
    expect(bad.status).toBe(400);
    expect(bad.headers['x-request-id']).toBeTruthy();
    expect(bad.body.message).toBe(PHONE_TEXT.error);

    const nine = await callAs('admin', (api) =>
      api.put(`/api/users/${created.userId}`, {
        data: { affiliation: 'wake', rank: '마케팅팀', position_level: '과장', system_role: 'user', birthday: '1990-01-01', phone: PHONE_02_9 }
      })
    );
    expect(nine.status, JSON.stringify(nine.body)).toBe(200);
    expect(await dbProfilePhone(created.userId)).toBe(PHONE_02_9);
  });

  test('AC-21: 조직도 hover 카드 · 프로필 페이지 — 02 번호 사용자 02-1234-5678 표시 (68 회귀)', async ({ browser }) => {
    const stamp = Date.now();
    const person = await createOrgChartTestUser('hover-p97', {
      fullName: `E2E Hover P97 ${stamp}`,
      phone: PHONE_02_10,
      rank: '마케팅팀',
      position_level: '과장'
    });

    const { context, page } = await pageAs(browser, 'user');
    try {
      await gotoWakeOrgChartDesktop(page);
      await waitForPersonOnCanvas(page, person.fullName);
      const card = await hoverPersonNode(page, person.userId);
      await expect(card.getByText('02-1234-5678')).toBeVisible();
      await expect(card.getByText(PHONE_02_10, { exact: true })).toHaveCount(0);
    } finally {
      await context.close();
    }

    await expectProfilePhoneAs(browser, person.email, person.password, '02-1234-5678');
  });

  test('AC-22: grep — 「11자리」 문구 0건(「9~11자리」 제외) · src·신규 SQL(95~99) `\\d{11}` 0건', async () => {
    const fixedDigits = grepDir('src', '11자리').filter((line) => !line.includes('9~11자리'));
    expect(fixedDigits, '「11자리」 고정 문구').toEqual([]);
    expect(grepDir('src', '\\d{11}'), 'src \\d{11}').toEqual([]);
    const sqlHits = grepDir('supabase/sql', '\\d{11}').filter((line) => /^supabase\/sql\/9[5-9]_/.test(line));
    expect(sqlHits, 'SQL 95~99 \\d{11}').toEqual([]);
    expect(SRC_ROOT).toBeTruthy();
  });
});
