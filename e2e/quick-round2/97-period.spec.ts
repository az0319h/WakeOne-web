import { expect, test, type Page } from '@playwright/test';
import { ABSOLUTE_DATETIME_RE } from '../quick-workflow/helpers';
import {
  buildCreateBody,
  callAs,
  createAs,
  createQuickRequestApi,
  gotoDashboard,
  pageAs,
  uniqueTag,
  withApi
} from '../quick-workflow/helpers';
import { sendMessageAs, SUBSCRIBE_SETTLE_MS } from '../quick-chat/helpers';
import {
  RANGE_TEXT,
  REALTIME_TIMEOUT_MS,
  createManyAs,
  dashboardCardSum,
  dashboardDataRows,
  daysAgoDateString,
  daysAgoIso,
  grepDir,
  pickCalendarDate,
  setRequestedAt,
  setRequestedAtMany,
  summaryTotalAs
} from './helpers';

/**
 * plan 97 §A 기간·페이지 (AC-01 ~ AC-10)
 * docs/plans/97_quick-period-filter-recent-address-split-phone-plan.md
 *
 * - 공유 dev DB라 표 건수는 `?search={tag}`(요청자 fixture 상세주소 표식)로 격리하고,
 *   카드 숫자는 검색과 무관(D-4)하므로 「같은 기간의 summary API 합계와 동일」 + 「기간을 넓힐수록 fixture만큼 증가」로 판정한다.
 * - `requested_at`은 service role로 과거로 옮긴다.
 */
test.describe('plan 97 A. 기간 필터 · 페이지네이션 · 대화 무한스크롤', () => {
  test.describe.configure({ timeout: 150_000 });

  /** AC-01~03·09 공용 fixture — 오늘 3 · 20일 전 2 · 60일 전 1 · 200일 전 1 (요청자 user · 동방이 본다) */
  const period = { tag: '', today: [] as string[], d20: [] as string[], d60: [] as string[], d200: [] as string[] };

  test.beforeAll(async () => {
    period.tag = uniqueTag('E2E97P');
    const nos = await createManyAs('user', period.tag, 7);
    period.today = nos.slice(0, 3);
    period.d20 = nos.slice(3, 5);
    period.d60 = nos.slice(5, 6);
    period.d200 = nos.slice(6, 7);
    await setRequestedAtMany(period.d20, daysAgoIso(20));
    await setRequestedAtMany(period.d60, daysAgoIso(60));
    await setRequestedAtMany(period.d200, daysAgoIso(200));
  });

  async function expectRows(page: Page, requestNos: string[], absent: string[] = []) {
    for (const no of requestNos) {
      await expect(page.getByTestId(`quick-row-detail-${no}`)).toBeVisible({ timeout: 30_000 });
    }
    for (const no of absent) {
      await expect(page.getByTestId(`quick-row-detail-${no}`)).toHaveCount(0);
    }
    await expect(dashboardDataRows(page)).toHaveCount(requestNos.length);
  }

  async function expectCardsMatchSummary(page: Page, query: string, atLeast: number) {
    const summary = await summaryTotalAs('dongbang', query);
    expect(summary, `summary ${query} >= ${atLeast}`).toBeGreaterThanOrEqual(atLeast);
    await expect.poll(() => dashboardCardSum(page), { timeout: 15_000, message: `카드 합계 = summary ${query}` }).toBe(summary);
    return summary;
  }

  test('AC-01: 동방 기본 — 「기간: 최근 7일」 · 표 3건(오늘) · 카드 합계 = 7일 summary · URL에 range 없음', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDashboard(page, `?search=${period.tag}`);
      await expect(page.getByTestId('quick-dashboard-range-label')).toHaveText(RANGE_TEXT.label7d);
      await expect(page.getByTestId('quick-dashboard-range-7d')).toHaveAttribute('data-state', 'on');
      await expectRows(page, period.today, [...period.d20, ...period.d60, ...period.d200]);
      await expect(page.getByTestId('quick-dashboard-total')).toHaveText('총 3건');
      expect(new URL(page.url()).searchParams.get('range')).toBeNull();
      await expectCardsMatchSummary(page, '', 3);
    } finally {
      await context.close();
    }
  });

  test('AC-02: 「30일」→「90일」→「전체」 — 표 5 → 6 → 7건 · 카드 합계도 기간을 따라 증가 · URL range=30d/90d/all · 전환마다 page 제거 · 200일 전 건도 「전체」에서 보임', async ({
    browser
  }) => {
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDashboard(page, `?search=${period.tag}&page=1`);
      await expectRows(page, period.today);
      const base7 = await expectCardsMatchSummary(page, '', 3);

      await page.getByTestId('quick-dashboard-range-30d').click();
      await expect(page).toHaveURL(/[?&]range=30d/);
      expect(new URL(page.url()).searchParams.get('page'), 'page=1 리셋(제거)').toBeNull();
      await expect(page.getByTestId('quick-dashboard-range-label')).toHaveText(RANGE_TEXT.label30d);
      await expectRows(page, [...period.today, ...period.d20], [...period.d60, ...period.d200]);
      await expect(page.getByTestId('quick-dashboard-total')).toHaveText('총 5건');
      const base30 = await expectCardsMatchSummary(page, '?range=30d', base7 + 2);

      await page.getByTestId('quick-dashboard-range-90d').click();
      await expect(page).toHaveURL(/[?&]range=90d/);
      await expect(page.getByTestId('quick-dashboard-range-label')).toHaveText(RANGE_TEXT.label90d);
      await expectRows(page, [...period.today, ...period.d20, ...period.d60], period.d200);
      await expect(page.getByTestId('quick-dashboard-total')).toHaveText('총 6건');
      const base90 = await expectCardsMatchSummary(page, '?range=90d', base30 + 1);

      await page.getByTestId('quick-dashboard-range-all').click();
      await expect(page).toHaveURL(/[?&]range=all/);
      await expect(page.getByTestId('quick-dashboard-range-label')).toHaveText(RANGE_TEXT.labelAll);
      await expectRows(page, [...period.today, ...period.d20, ...period.d60, ...period.d200]);
      await expect(page.getByTestId('quick-dashboard-total')).toHaveText('총 7건');
      await expectCardsMatchSummary(page, '?range=all', base90 + 1);
      expect(new URL(page.url()).searchParams.get('page')).toBeNull();
    } finally {
      await context.close();
    }
  });

  test('AC-03: 「기간 직접 선택」 달력 25일 전 ~ 15일 전 → 표 2건(20일 전) · URL range=custom&from&to · 「기간: {from} ~ {to}」 · 새로고침 유지', async ({
    browser
  }) => {
    const from = daysAgoDateString(25);
    const to = daysAgoDateString(15);
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDashboard(page, `?search=${period.tag}`);
      await expectRows(page, period.today);
      await page.getByTestId('quick-dashboard-range-custom').click();
      const popover = page.getByTestId('quick-dashboard-range-popover');
      await expect(popover).toBeVisible();
      await expect(popover.getByTestId('quick-dashboard-range-calendar')).toBeVisible();
      await pickCalendarDate(popover, from);
      await pickCalendarDate(popover, to);
      await popover.getByTestId('quick-dashboard-range-apply').click();
      await expect(popover).toBeHidden();

      await expect(page).toHaveURL(new RegExp(`range=custom`));
      const params = new URL(page.url()).searchParams;
      expect(params.get('from')).toBe(from);
      expect(params.get('to')).toBe(to);
      expect(params.get('page')).toBeNull();
      await expect(page.getByTestId('quick-dashboard-range-label')).toHaveText(`기간: ${from} ~ ${to}`);
      await expect(page.getByTestId('quick-dashboard-range-custom')).toHaveAttribute('data-state', 'on');
      await expect(page.getByTestId('quick-dashboard-range-custom')).toHaveText(`${from} ~ ${to}`);
      await expectRows(page, period.d20, [...period.today, ...period.d60, ...period.d200]);
      await expect(page.getByTestId('quick-dashboard-total')).toHaveText('총 2건');
      await expectCardsMatchSummary(page, `?range=custom&from=${from}&to=${to}`, 2);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('quick-dashboard')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('quick-dashboard-range-label')).toHaveText(`기간: ${from} ~ ${to}`);
      await expectRows(page, period.d20, period.today);
    } finally {
      await context.close();
    }
  });

  test('AC-04: API — custom from>to 400 「기간을 확인해 주세요.」 · range=zzz 200 + 7d · perPage=999 → limit 50 클램프', async () => {
    const bad = await callAs('dongbang', (api) =>
      api.get('/api/quick-request?range=custom&from=2026-10-20&to=2026-10-01')
    );
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe(RANGE_TEXT.invalid);

    const zzz = await callAs('dongbang', (api) => api.get('/api/quick-request?range=zzz'));
    expect(zzz.status).toBe(200);
    expect((zzz.body.data as { range: { kind: string } }).range.kind).toBe('7d');

    const big = await callAs('dongbang', (api) => api.get('/api/quick-request?perPage=999'));
    expect(big.status).toBe(200);
    expect((big.body.data as { limit: number }).limit).toBe(50);
    const bigLimit = await callAs('dongbang', (api) => api.get('/api/quick-request?limit=999'));
    expect((bigLimit.body.data as { limit: number }).limit).toBe(50);

    const summaryBad = await callAs('dongbang', (api) =>
      api.get('/api/quick-request/summary?range=custom&from=2026-10-20&to=2026-10-01')
    );
    expect(summaryBad.status).toBe(400);
    expect(summaryBad.body.message).toBe(RANGE_TEXT.invalid);
  });

  test('AC-05: 45건(오늘) — 1페이지 20행 · 「1 / 3 페이지」(plan 106 AC-20 한국어) · 2페이지 URL page=2 행 21~40 · 기간·상태 카드 클릭 시 page 제거 · perPage 50 → 45행', async ({
    browser
  }) => {
    const tag = uniqueTag('E2E97PG');
    const requestNos = await createManyAs('user', tag, 45);
    expect(requestNos).toHaveLength(45);

    const listPage = async (page: number, limit = 20) => {
      const result = await callAs('dongbang', (api) =>
        api.get(`/api/quick-request?search=${encodeURIComponent(tag)}&page=${page}&limit=${limit}`)
      );
      expect(result.status).toBe(200);
      const data = result.body.data as { rows: { requestNo: string }[]; total: number; page: number; limit: number };
      return data;
    };
    const first = await listPage(1);
    expect(first.total).toBe(45);
    expect(first.rows).toHaveLength(20);
    const second = await listPage(2);
    expect(second.rows).toHaveLength(20);
    expect(second.page).toBe(2);
    const third = await listPage(3);
    expect(third.rows).toHaveLength(5);
    const fifty = await listPage(1, 50);
    expect(fifty.rows).toHaveLength(45);
    expect(new Set(fifty.rows.map((row) => row.requestNo)).size).toBe(45);

    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDashboard(page, `?search=${tag}`);
      const table = page.getByTestId('quick-dashboard-table');
      await expect(page.getByTestId('quick-dashboard-total')).toHaveText('총 45건', { timeout: 30_000 });
      await expect(dashboardDataRows(page)).toHaveCount(20);
      await expect(table.getByText('1 / 3 페이지')).toBeVisible();
      for (const row of first.rows) {
        await expect(page.getByTestId(`quick-row-detail-${row.requestNo}`)).toBeVisible();
      }

      await table.getByRole('button', { name: '다음 페이지' }).click();
      await expect(page).toHaveURL(/[?&]page=2/);
      await expect(table.getByText('2 / 3 페이지')).toBeVisible({ timeout: 30_000 });
      await expect(dashboardDataRows(page)).toHaveCount(20);
      for (const row of second.rows) {
        await expect(page.getByTestId(`quick-row-detail-${row.requestNo}`)).toBeVisible();
      }
      await expect(page.getByTestId(`quick-row-detail-${first.rows[0].requestNo}`)).toHaveCount(0);

      // 기간 전환 → page=1 (URL에서 제거)
      await page.getByTestId('quick-dashboard-range-30d').click();
      await expect(page).toHaveURL(/[?&]range=30d/);
      expect(new URL(page.url()).searchParams.get('page'), '기간 전환 시 page 리셋').toBeNull();
      await expect(table.getByText('1 / 3 페이지')).toBeVisible({ timeout: 30_000 });

      // 상태 카드 클릭(필터) → page=1
      await table.getByRole('button', { name: '다음 페이지' }).click();
      await expect(page).toHaveURL(/[?&]page=2/);
      await page.getByTestId('quick-dashboard-card-requested').click();
      await expect(page).toHaveURL(/[?&]status=requested/);
      expect(new URL(page.url()).searchParams.get('page'), '상태 카드 클릭 시 page 리셋').toBeNull();
      await expect(table.getByText('1 / 3 페이지')).toBeVisible({ timeout: 30_000 });

      // perPage 50 → 1페이지 45행
      await table.getByRole('combobox').click();
      const options = page.getByRole('option');
      await expect(options).toHaveText(['10', '20', '50']);
      await options.filter({ hasText: /^50$/ }).click();
      await expect(page).toHaveURL(/[?&]perPage=50/);
      await expect(table.getByText('1 / 1 페이지')).toBeVisible({ timeout: 30_000 });
      await expect(dashboardDataRows(page)).toHaveCount(45);
      await expect(page.getByTestId('quick-dashboard-total')).toHaveText('총 45건');
    } finally {
      await context.close();
    }
  });

  test('AC-06: user 「전체」 — 본인 2건만 · user2 건 0건 (89 AC-29 권한 유지)', async ({ browser }) => {
    const tag = uniqueTag('E2E97OWN');
    const mine = await createManyAs('user', tag, 2);
    await setRequestedAt(mine[1], daysAgoIso(40));
    const other = await createAs('user2', tag);

    const { context, page } = await pageAs(browser, 'user');
    try {
      await gotoDashboard(page, `?search=${tag}`);
      await expect(page.getByRole('heading', { name: '나의 퀵 내역', exact: true }).first()).toBeVisible();
      await page.getByTestId('quick-dashboard-range-all').click();
      await expect(page).toHaveURL(/[?&]range=all/);
      await expectRows(page, mine, [other.requestNo]);
      await expect(page.getByTestId('quick-dashboard-total')).toHaveText('총 2건');
    } finally {
      await context.close();
    }
    const list = await callAs('user', (api) => api.get(`/api/quick-request?range=all&search=${encodeURIComponent(tag)}`));
    expect((list.body.data as { total: number }).total).toBe(2);
  });

  test('AC-07: 「퀵 대화」 — 25건(7일) + 30일 전 안 읽음 있음/없음 → 20건 → 스크롤 → +6(안 읽음 건 포함 · 없음 건 제외) · 끝 문구 · 「전체」 27건 · tab=unread 유지', async ({
    browser
  }) => {
    const tag = uniqueTag('E2E97CHAT');
    const recent = await createManyAs('user', tag, 25);
    const unreadOld = await createAs('user', tag);
    const readOld = await createAs('user', tag);
    await setRequestedAtMany([unreadOld.requestNo, readOld.requestNo], daysAgoIso(30));
    await sendMessageAs('user', unreadOld.requestNo, `30일 전 건 안 읽은 메시지 ${tag}`);

    const api7 = await callAs('dongbang', (api) => api.get(`/api/quick-request/conversations?q=${encodeURIComponent(tag)}`));
    expect(api7.status).toBe(200);
    const data7 = api7.body.data as {
      conversations: { requestNo: string }[];
      nextCursor: string | null;
      totals?: { conversations: number; unreadConversations: number };
    };
    expect(data7.conversations).toHaveLength(20);
    expect(data7.nextCursor).toBeTruthy();
    expect(data7.totals?.conversations).toBe(26);
    const api7b = await callAs('dongbang', (api) =>
      api.get(`/api/quick-request/conversations?q=${encodeURIComponent(tag)}&cursor=${encodeURIComponent(data7.nextCursor!)}`)
    );
    const data7b = api7b.body.data as typeof data7;
    expect(data7b.conversations).toHaveLength(6);
    expect(data7b.nextCursor).toBeNull();
    expect(data7b.totals, 'totals는 첫 페이지에만').toBeUndefined();
    const all7 = [...data7.conversations, ...data7b.conversations].map((row) => row.requestNo);
    expect(new Set(all7).size).toBe(26);
    expect(all7).toContain(unreadOld.requestNo);
    expect(all7).not.toContain(readOld.requestNo);
    for (const no of recent) expect(all7).toContain(no);

    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await page.goto(`/dashboard/quick/chat?q=${encodeURIComponent(tag)}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('quick-chat-range-label')).toHaveText(RANGE_TEXT.label7d);
      const items = page.getByRole('list', { name: '퀵 대화 목록' }).getByRole('listitem');
      await expect(items).toHaveCount(20, { timeout: 30_000 });
      await expect(page.getByTestId('quick-chat-list-summary')).toHaveText('대화 26건 · 안 읽은 대화 1건');
      const sentinel = page.getByTestId('quick-chat-list-sentinel');
      await expect(sentinel).toHaveAttribute('data-state', 'more');
      await expect(page.getByText(RANGE_TEXT.chatEnd)).toHaveCount(0);

      await page.getByTestId('quick-chat-list-load-more').scrollIntoViewIfNeeded();
      await expect(items).toHaveCount(26, { timeout: 30_000 });
      await expect(sentinel).toHaveAttribute('data-state', 'end', { timeout: 15_000 });
      await expect(sentinel).toHaveText(RANGE_TEXT.chatEnd);
      await expect(page.getByTestId(`quick-chat-list-item-${unreadOld.requestNo}`)).toBeVisible();
      await expect(page.getByTestId(`quick-chat-list-item-${readOld.requestNo}`)).toHaveCount(0);
      for (const no of recent) {
        await expect(page.getByTestId(`quick-chat-list-item-${no}`)).toHaveCount(1);
      }

      // 「전체」 → 27건 (30일 전 안 읽음 없는 건 포함)
      await page.getByTestId('quick-chat-range-all').click();
      await expect(page).toHaveURL(/[?&]range=all/);
      await expect(page.getByTestId('quick-chat-range-label')).toHaveText(RANGE_TEXT.labelAll);
      await expect(page.getByTestId('quick-chat-list-summary')).toHaveText('대화 27건 · 안 읽은 대화 1건', { timeout: 30_000 });
      await expect(items).toHaveCount(20, { timeout: 30_000 });
      await page.getByTestId('quick-chat-list-load-more').scrollIntoViewIfNeeded();
      await expect(items).toHaveCount(27, { timeout: 30_000 });
      await expect(page.getByTestId(`quick-chat-list-item-${readOld.requestNo}`)).toBeVisible();

      // tab=unread 유지 — 기간을 바꿔도 탭이 남고 안 읽은 건만
      await page.getByTestId('quick-chat-tab-unread').click();
      await expect(page).toHaveURL(/[?&]tab=unread/);
      await expect(items).toHaveCount(1, { timeout: 30_000 });
      await page.getByTestId('quick-chat-range-30d').click();
      await expect(page).toHaveURL(/[?&]range=30d/);
      await expect(page).toHaveURL(/[?&]tab=unread/);
      await expect(items).toHaveCount(1, { timeout: 30_000 });
      await expect(page.getByTestId(`quick-chat-list-item-${unreadOld.requestNo}`)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('AC-08 (plan 106 AC-38): 1024 동방 「퀵 대화」 패널 — time 텍스트 짧은 시각(오늘 HH:mm) · dateTime·title 전체 시각 · aside scrollWidth <= clientWidth · 시각 말줄임 0', async ({
    browser
  }) => {
    const tag = uniqueTag('E2E97TIME');
    const { requestNo } = await withApi('user', (api) =>
      createQuickRequestApi(
        api,
        buildCreateBody(tag, {
          origin: {
            ...buildCreateBody(tag).origin,
            roadAddress: '서울특별시 강남구 테헤란로 152 강남파이낸스센터 지하 1층 물류 반입구'
          }
        })
      )
    );
    await sendMessageAs('user', requestNo, `긴 미리보기 메시지로 3행이 truncate되는지 봅니다 ${tag} ${'가'.repeat(40)}`);

    const { context, page } = await pageAs(browser, 'dongbang', { viewport: { width: 1024, height: 768 } });
    try {
      await page.goto(`/dashboard/quick/chat?q=${encodeURIComponent(tag)}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('quick-chat-messenger')).toBeVisible({ timeout: 30_000 });
      const item = page.getByTestId(`quick-chat-list-item-${requestNo}`);
      await expect(item).toBeVisible({ timeout: 30_000 });
      const aside = page.getByRole('complementary', { name: '퀵 대화 목록' });
      const asideBox = await aside.boundingBox();
      expect(asideBox).not.toBeNull();
      expect(asideBox!.width, '패널 폭 ≤ 360').toBeLessThanOrEqual(360);

      const time = item.locator('time');
      await expect(time).toHaveCount(1);
      const text = (await time.innerText()).trim();
      // plan 106 D-14 — 대화 목록은 KST 오늘 `HH:mm` (전체 시각은 title·dateTime)
      expect(text).toMatch(/^\d{2}:\d{2}$/);
      expect(await time.getAttribute('title')).toMatch(new RegExp(`^${ABSOLUTE_DATETIME_RE.source}$`));
      expect(text).not.toContain('…');
      const metrics = await time.evaluate((node) => ({
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        rects: node.getClientRects().length
      }));
      expect(metrics.scrollWidth, 'time 가로 잘림 없음').toBeLessThanOrEqual(metrics.clientWidth);
      expect(metrics.rects, 'time 한 줄').toBe(1);
      const asideMetrics = await aside.evaluate((node) => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
      expect(asideMetrics.scrollWidth).toBeLessThanOrEqual(asideMetrics.clientWidth);
      const itemMetrics = await item.evaluate((node) => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
      expect(itemMetrics.scrollWidth).toBeLessThanOrEqual(itemMetrics.clientWidth);
    } finally {
      await context.close();
    }
  });

  test('AC-09: 동방 「30일」 보기 중 user 등록 → 5초 안 행 등장 · 요청 접수 카드 +1 (94 Realtime)', async ({ browser }) => {
    const { context, page } = await pageAs(browser, 'dongbang');
    try {
      await gotoDashboard(page, '?range=30d');
      await expect(page.getByTestId('quick-dashboard-range-label')).toHaveText(RANGE_TEXT.label30d);
      const countLocator = page.getByTestId('quick-dashboard-card-requested-count');
      await expect(countLocator).toHaveText(/^\d+$/, { timeout: 30_000 });
      await expect(dashboardDataRows(page).first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
      const before = Number((await countLocator.innerText()).trim());

      const created = await createAs('user', uniqueTag('E2E97RT'));
      await expect(page.getByTestId(`quick-row-detail-${created.requestNo}`)).toBeVisible({
        timeout: REALTIME_TIMEOUT_MS
      });
      await expect(countLocator).toHaveText(String(before + 1), { timeout: REALTIME_TIMEOUT_MS });
      await expect(page).toHaveURL(/[?&]range=30d/);
    } finally {
      await context.close();
    }
  });

  test('AC-10: grep — 7일 고정 문구·DASHBOARD_DAYS 상수·메모리 window 상한 상수·window 함수 0건 (src · e2e)', async () => {
    const needles = [
      ['최근 7일', '기준'].join(' '),
      ['QUICK_REQUEST', 'DASHBOARD_DAYS'].join('_'),
      ['WINDOW', 'ROW_LIMIT'].join('_'),
      ['list', 'WindowRows'].join('')
    ];
    for (const needle of needles) {
      expect(grepDir('src', needle), `src: ${needle}`).toEqual([]);
      expect(grepDir('e2e', needle), `e2e: ${needle}`).toEqual([]);
    }
  });

  test('AC-07 보조: 대화 목록 커서 불량 400 · 대화 기간 custom from>to 400', async () => {
    const badCursor = await callAs('dongbang', (api) => api.get('/api/quick-request/conversations?cursor=not-a-cursor'));
    expect(badCursor.status).toBe(400);
    expect(badCursor.body.message).toBe(RANGE_TEXT.invalidBody);
    const badRange = await callAs('dongbang', (api) =>
      api.get('/api/quick-request/conversations?range=custom&from=2026-10-20&to=2026-10-01')
    );
    expect(badRange.status).toBe(400);
    expect(badRange.body.message).toBe(RANGE_TEXT.invalid);
  });
});
