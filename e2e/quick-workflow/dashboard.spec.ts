import { expect, test, type Page } from '@playwright/test';
import {
  ABSOLUTE_DATETIME_RE,
  buildCreateBody,
  callAs,
  createQuickRequestApi,
  expectNoHorizontalScroll,
  fixtureUser,
  gotoDashboard,
  gotoDetail,
  MSG,
  pageAs,
  readJson,
  seedQuickRequest,
  STATUS_LABEL,
  uniqueTag,
  VIEWPORT_MOBILE,
  withApi
} from './helpers';

// plan 89 §E 대시보드·조회 범위 — docs/plans/89 · plan 92가 옛 AC-35(발송 배지)를 제거했다(92 AC-06은 removal.spec)

function pageTitle(page: Page, name: string) {
  return page.getByRole('heading', { name, exact: true }).first();
}

function tableRowLink(page: Page, requestNo: string) {
  return page.getByTestId('quick-dashboard-table').getByTestId(`quick-row-detail-${requestNo}`);
}

test.describe('plan 89 E. 퀵 대시보드 · 조회 범위', () => {
  test.describe.configure({ timeout: 120_000 });

  test('AC-29: user 「나의 퀵 내역」 본인 건만 · user2 건 0건 · user2 상세 URL → 「퀵 요청을 찾을 수 없습니다.」(API 404)', async ({
    browser
  }) => {
    const tag = uniqueTag('E2E89S');
    const mine = await seedQuickRequest('requested', 'user', tag);
    const other = await seedQuickRequest('requested', 'user2', tag);

    const { context, page } = await pageAs(browser, 'user');
    try {
      await gotoDashboard(page, `?search=${tag}`);
      await expect(pageTitle(page, '나의 퀵 내역')).toBeVisible();
      await expect(tableRowLink(page, mine.requestNo)).toBeVisible({ timeout: 30_000 });
      await expect(tableRowLink(page, other.requestNo)).toHaveCount(0);

      await page.goto(`/dashboard/quick/${other.requestNo}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('quick-detail-not-found')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(MSG.notFound, { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: '퀵 대시보드로' })).toBeVisible();
    } finally {
      await context.close();
    }

    const response = await callAs('user', (api) => api.get(`/api/quick-request/${other.requestNo}`));
    expect(response.status).toBe(404);
    expect(response.body.message).toBe(MSG.notFound);
  });

  test('AC-30: 동방·admin·구매물류팀 「퀵 내역」 두 사용자 건 모두 · 구매물류팀 접수/수정/배차완료 0건', async ({
    browser
  }) => {
    const tag = uniqueTag('E2E89V');
    const first = await seedQuickRequest('requested', 'user', tag);
    const second = await seedQuickRequest('dispatching', 'user2', tag);

    for (const account of ['dongbang', 'admin', 'logistics'] as const) {
      const { context, page } = await pageAs(browser, account);
      try {
        await gotoDashboard(page, `?search=${tag}`);
        await expect(pageTitle(page, '퀵 내역'), account).toBeVisible();
        await expect(tableRowLink(page, first.requestNo), account).toBeVisible({ timeout: 30_000 });
        await expect(tableRowLink(page, second.requestNo), account).toBeVisible();
        const table = page.getByTestId('quick-dashboard-table');
        if (account === 'logistics') {
          await expect(table.getByRole('button', { name: /접수$/ })).toHaveCount(0);
          await expect(table.getByRole('button', { name: /배차완료$/ })).toHaveCount(0);
          await expect(table.getByTestId(`quick-row-action-${first.requestNo}`)).toHaveText('—');
          await expect(table.getByTestId(`quick-row-action-${second.requestNo}`)).toHaveText('—');

          for (const no of [first.requestNo, second.requestNo]) {
            await gotoDetail(page, no);
            await expect(page.getByTestId('quick-detail-accept')).toHaveCount(0);
            await expect(page.getByTestId('quick-detail-dispatch')).toHaveCount(0);
            await expect(page.getByTestId('quick-detail-edit')).toHaveCount(0);
            await expect(page.getByTestId('quick-detail-cancel')).toHaveCount(0);
          }
        } else {
          await expect(table.getByTestId(`quick-row-action-${first.requestNo}`)).toHaveText(/접수/);
          await expect(table.getByTestId(`quick-row-action-${second.requestNo}`)).toHaveText(/배차완료/);
        }
      } finally {
        await context.close();
      }
    }
  });

  test('AC-31: 카드 4개 라벨·숫자 · 「취소 N」 · 「접수 및 배차중」 클릭 → ?status=dispatching · 해당 상태만', async ({
    browser
  }) => {
    await seedQuickRequest('dispatching');
    await seedQuickRequest('cancelled');
    const summary = await withApi('admin', async (api) => {
      const response = await api.get('/api/quick-request/summary');
      expect(response.status()).toBe(200);
      return (await readJson<{ data: { counts: Record<string, number> } }>(response)).data.counts;
    });

    const { context, page } = await pageAs(browser, 'admin');
    try {
      await gotoDashboard(page);
      for (const status of ['requested', 'dispatching', 'dispatched', 'approved'] as const) {
        const card = page.getByTestId(`quick-dashboard-card-${status}`);
        await expect(card).toContainText(STATUS_LABEL[status]);
        await expect(page.getByTestId(`quick-dashboard-card-${status}-count`)).toHaveText(
          /^\d+$/,
          { timeout: 30_000 }
        );
        const shown = Number(await page.getByTestId(`quick-dashboard-card-${status}-count`).innerText());
        expect(shown, status).toBeGreaterThanOrEqual(summary[status]);
      }
      const cancelled = page.getByTestId('quick-dashboard-card-cancelled');
      await expect(cancelled).toHaveText(/취소\s*\d+/);

      const card = page.getByTestId('quick-dashboard-card-dispatching');
      await card.click();
      await expect(page).toHaveURL(/[?&]status=dispatching/);
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      const table = page.getByTestId('quick-dashboard-table');
      await expect(table).toBeVisible({ timeout: 30_000 });
      const badges = table.getByRole('row').getByText(/^(신규요청|접수 및 배차중|배차완료 및 결과|승인|취소)$/);
      await expect(badges.first()).toBeVisible();
      const texts = await badges.allInnerTexts();
      expect(texts.length).toBeGreaterThan(0);
      expect(new Set(texts)).toEqual(new Set([STATUS_LABEL.dispatching]));
    } finally {
      await context.close();
    }
  });

  test('AC-32: 검색 — 요청번호 일부 · 요청자 이름 · 도착 주소 일부 · 결과 없음 문구', async ({ browser }) => {
    const tag = uniqueTag('E2E89Q');
    const created = await withApi('user', (api) => createQuickRequestApi(api, buildCreateBody(tag)));
    const user = await fixtureUser('user');
    const { context, page } = await pageAs(browser, 'admin');
    try {
      await gotoDashboard(page);
      const search = page.getByTestId('quick-dashboard-search');

      // 도착 주소 일부 (상세주소 표식)
      await search.fill(`${tag} 도착`);
      await expect(page).toHaveURL(new RegExp(`search=`), { timeout: 5_000 });
      await expect(tableRowLink(page, created.requestNo)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('quick-dashboard-table').getByRole('row')).toHaveCount(2);

      // 요청번호 일부 (연도 제외)
      const seqPart = created.requestNo.split('-')[1];
      await search.fill(`-${seqPart}`);
      await expect(tableRowLink(page, created.requestNo)).toBeVisible({ timeout: 30_000 });

      // 요청자 이름
      await search.fill(user.fullName);
      await expect(tableRowLink(page, created.requestNo)).toBeVisible({ timeout: 30_000 });
      const dataRows = page.getByTestId('quick-dashboard-table').getByRole('row').filter({
        has: page.getByRole('link')
      });
      const rowTexts = await dataRows.allInnerTexts();
      expect(rowTexts.length).toBeGreaterThan(0);
      for (const text of rowTexts) expect(text).toContain(user.fullName);

      // 결과 없음
      await search.fill(`없는검색어-${tag}`);
      await expect(page.getByTestId('quick-dashboard-empty')).toContainText(
        '조건에 맞는 퀵 요청이 없습니다.',
        { timeout: 30_000 }
      );
    } finally {
      await context.close();
    }
  });

  // AC-33(requested_at 8일 전 미노출 · 7일 고정 문구)은 plan 97 AC-01·02(기간 선택 · e2e/quick-round2/97-period.spec.ts)로 교체됐다

  test('AC-34: 표 열 헤더 9개 · 하단 문구 · 요청 시각 절대 형식', async ({ browser }) => {
    const tag = uniqueTag('E2E89H');
    const created = await seedQuickRequest('requested', 'user', tag);
    const { context, page } = await pageAs(browser, 'admin');
    try {
      await gotoDashboard(page, `?search=${tag}`);
      const table = page.getByTestId('quick-dashboard-table');
      await expect(table).toBeVisible({ timeout: 30_000 });
      const headers = (await table.getByRole('columnheader').allInnerTexts()).map((text) => text.trim());
      expect(headers).toEqual([
        '진행 상태',
        '요청 정보',
        '요청자',
        '이동 경로',
        '물품·차량',
        '예상금액',
        '최종금액',
        '상세 보기',
        '업무 처리'
      ]);
      await expect(page.getByTestId('quick-dashboard-footnote')).toHaveText(
        '운송 완료 후 실제 금액을 확인하고 승인해주세요.'
      );
      const row = table.getByRole('row').filter({ has: page.getByTestId(`quick-row-detail-${created.requestNo}`) });
      await expect(row).toContainText(ABSOLUTE_DATETIME_RE);
      await expect(row).not.toContainText(/전$|방금/);
    } finally {
      await context.close();
    }
  });

  test('AC-36: 375 동방 대시보드·상세 — 가로 스크롤 0 · 카드 리스트 · 버튼 ≥ 44px', async ({ browser }) => {
    const tag = uniqueTag('E2E89M');
    const created = await seedQuickRequest('dispatching', 'user', tag);
    const { context, page } = await pageAs(browser, 'dongbang', { viewport: VIEWPORT_MOBILE });
    try {
      await gotoDashboard(page, `?search=${tag}`);
      const card = page.getByTestId(`quick-card-${created.requestNo}`);
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('quick-dashboard-table')).toBeHidden();
      await expect(page.getByTestId('quick-dashboard-cards')).toBeVisible();
      await expectNoHorizontalScroll(page);
      for (const testId of [
        `quick-card-detail-${created.requestNo}`,
        `quick-card-action-${created.requestNo}`,
        'quick-dashboard-card-requested',
        'quick-dashboard-card-cancelled',
        'quick-dashboard-reset'
      ]) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box, testId).not.toBeNull();
        expect(box!.height, testId).toBeGreaterThanOrEqual(44);
      }

      await page.getByTestId(`quick-card-detail-${created.requestNo}`).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/quick/${created.requestNo}$`));
      await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('quick-detail-dispatch')).toBeVisible();
      await expectNoHorizontalScroll(page);
      for (const testId of ['quick-detail-dispatch', 'quick-detail-edit', 'quick-detail-cancel']) {
        const box = await page.getByTestId(testId).boundingBox();
        expect(box, testId).not.toBeNull();
        expect(box!.height, testId).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await context.close();
    }
  });
});
