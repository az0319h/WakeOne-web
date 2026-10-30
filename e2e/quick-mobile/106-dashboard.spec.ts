import { expect, test, type Page } from '@playwright/test';
import {
  acceptAs,
  callAs,
  createAs,
  dispatchAs,
  seedQuickRequest,
  STATUS_LABEL,
  uniqueTag
} from '../quick-workflow/helpers';
import { markAllConversationsReadAs, sendMessageAs, SUBSCRIBE_SETTLE_MS } from '../quick-chat/helpers';
import {
  createManyAs,
  daysAgoDateString,
  daysAgoIso,
  pickCalendarDate,
  setRequestedAtMany
} from '../quick-round2/helpers';
import {
  box,
  clickUntilUrl,
  countFullyVisibleAbove,
  expectMinSize,
  expectNoHorizontalScroll,
  gotoList,
  settleAnimations,
  TEXT,
  withPage
} from './helpers';

/**
 * plan 106 §B 퀵 내역 (AC-13 ~ AC-21) — docs/plans/106_quick-mobile-restructure-plan.md
 * 공유 dev DB라 카드 수는 `?search={tag}`(fixture 상세주소 표식)로 격리한다(plan 97 방식).
 */
const STATUSES = ['requested', 'dispatching', 'dispatched', 'approved', 'cancelled'] as const;

function cards(page: Page) {
  return page.getByTestId('quick-dashboard-cards').getByRole('listitem');
}

async function tabbarTop(page: Page) {
  return (await box(page.getByTestId('quick-mobile-tabbar'))).y;
}

async function cardTestIds(page: Page) {
  return cards(page).evaluateAll((items) => items.map((item) => item.getAttribute('data-testid') ?? ''));
}

async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
}

test.describe('plan 106 B. 퀵 내역 (휴대폰)', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  const fx = {
    tag5: '',
    statusTag: '',
    statusNos: {} as Record<(typeof STATUSES)[number], string>,
    tag45: '',
    nos45: [] as string[]
  };

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    fx.tag5 = uniqueTag('E2E106D5');
    await createManyAs('user', fx.tag5, 5);

    fx.statusTag = uniqueTag('E2E106DS');
    for (const status of STATUSES) {
      fx.statusNos[status] = (await seedQuickRequest(status, 'user', fx.statusTag)).requestNo;
    }

    fx.tag45 = uniqueTag('E2E106D45');
    fx.nos45 = await createManyAs('user', fx.tag45, 45);
  });

  test('AC-13: M375·M360 user 오늘 requested 5건 — 첫 카드 top ≤ 320 · 탭 바 위 완전히 보이는 카드 M375 ≥ 3 / M360 ≥ 2 · 카드 높이 ≤ 128', async ({
    browser
  }) => {
    for (const [vp, minCards] of [
      ['M375', 3],
      ['M360', 2]
    ] as const) {
      await withPage(browser, 'user', vp, async (page) => {
        await gotoList(page, `?search=${fx.tag5}`);
        await expect(cards(page)).toHaveCount(5, { timeout: 30_000 });
        await page.evaluate(() => window.scrollTo(0, 0));
        const first = await box(cards(page).first());
        expect(first.y, `${vp} 첫 카드 top`).toBeLessThanOrEqual(320);
        const limit = await tabbarTop(page);
        const visible = await countFullyVisibleAbove(cards(page), limit);
        expect(visible, `${vp} 탭 바 위로 완전히 보이는 카드`).toBeGreaterThanOrEqual(minCards);
        if (vp === 'M375') {
          for (let i = 0; i < 5; i += 1) {
            const rect = await box(cards(page).nth(i));
            expect(rect.height, `카드 ${i} 높이`).toBeLessThanOrEqual(128);
          }
        }
      });
    }
  });

  test('AC-14: M375 dongbang 칩 줄 — 5개 같은 y · ≥ 44 · 「라벨 숫자」 = summary · 설명문 숨김 · 칩 탭 → status=dispatching · 재탭 해제 · 가로 스크롤 0', async ({
    browser
  }) => {
    await withPage(browser, 'dongbang', 'M375', async (page) => {
      await gotoList(page, `?search=${fx.statusTag}`);
      await expect(cards(page)).toHaveCount(5, { timeout: 30_000 });
      const ys: number[] = [];
      for (const status of STATUSES) {
        const chip = page.getByTestId(`quick-dashboard-card-${status}`);
        const rect = await box(chip);
        ys.push(rect.y);
        expect(rect.height, `${status} 높이`).toBeGreaterThanOrEqual(44);
      }
      expect(Math.max(...ys) - Math.min(...ys), `칩 y ${ys.join(',')}`).toBeLessThanOrEqual(4);

      await expect
        .poll(
          async () => {
            const summary = await callAs('dongbang', (api) => api.get('/api/quick-request/summary'));
            const counts = (summary.body.data as { counts: Record<string, number> }).counts;
            const texts: string[] = [];
            for (const status of STATUSES) {
              texts.push((await page.getByTestId(`quick-dashboard-card-${status}`).innerText()).replace(/\s+/g, ' ').trim());
            }
            return texts.join('|') === STATUSES.map((s) => `${STATUS_LABEL[s]} ${counts[s]}`).join('|')
              ? 'ok'
              : `${texts.join('|')} vs ${JSON.stringify(counts)}`;
          },
          { timeout: 20_000, message: '칩 글자 「라벨 숫자」 = summary' }
        )
        .toBe('ok');
      await expect(page.getByText('동방특송이 확인 전인 새 요청').first()).toBeHidden().catch(() => undefined);
      for (const status of STATUSES.slice(0, 4)) {
        const chip = page.getByTestId(`quick-dashboard-card-${status}`);
        const descVisible = await chip.evaluate((el) =>
          Array.from(el.querySelectorAll('span')).some(
            (span) => span.className.includes('line-clamp-2') && window.getComputedStyle(span).display !== 'none'
          )
        );
        expect(descVisible, `${status} 설명문 숨김`).toBe(false);
      }

      const dispatching = page.getByTestId('quick-dashboard-card-dispatching');
      await dispatching.click();
      await expect(dispatching).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(/[?&]status=dispatching/);
      await expect(cards(page)).toHaveCount(1, { timeout: 30_000 });
      await expect(page.getByTestId(`quick-card-${fx.statusNos.dispatching}`)).toBeVisible();
      await dispatching.click();
      await expect(dispatching).toHaveAttribute('aria-pressed', 'false');
      await expect(page).not.toHaveURL(/status=/);
      await expect(cards(page)).toHaveCount(5, { timeout: 30_000 });
      await expectNoHorizontalScroll(page, '칩 줄');
    });
  });

  test('AC-15: M375 dongbang 「필터」 판 — 툴바 숨김 · 검색 ≥ 44 · dialog 「필터」 · 선택지 ≥ 44 · 30일·승인 → URL·메타바·배지 2 → 초기화 → status 제거·range 유지·배지 1', async ({
    browser
  }) => {
    await withPage(browser, 'dongbang', 'M375', async (page) => {
      await gotoList(page);
      await expect(page.getByTestId('quick-dashboard-cards').or(page.getByTestId('quick-dashboard-empty'))).toBeVisible({
        timeout: 30_000
      });
      await expect(page.getByTestId('quick-dashboard-range-7d')).toBeHidden();
      await expect(page.getByTestId('quick-dashboard-status-filter')).toBeHidden();
      const searchRect = await box(page.getByTestId('quick-dashboard-search'));
      expect(searchRect.height).toBeGreaterThanOrEqual(44);

      const button = page.getByTestId('quick-dashboard-filter-button');
      await button.click();
      const sheet = page.getByRole('dialog', { name: '필터' });
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute('data-testid', 'quick-dashboard-filter-sheet');
      await settleAnimations(page);
      for (const id of ['7d', '30d', '90d', 'all', 'custom']) {
        await expectMinSize(page.getByTestId(`quick-dashboard-filter-range-${id}`), 44, `range ${id}`);
      }
      for (const id of ['all', ...STATUSES]) {
        const rect = await box(page.getByTestId(`quick-dashboard-filter-status-${id}`));
        expect(rect.height, `status ${id}`).toBeGreaterThanOrEqual(44);
      }
      await page.getByTestId('quick-dashboard-filter-range-30d').click();
      await expect(page).toHaveURL(/[?&]range=30d/);
      await page.getByTestId('quick-dashboard-filter-status-approved').click();
      await expect(page).toHaveURL(/[?&]status=approved/);
      await page.getByTestId('quick-dashboard-filter-close').click();
      await expect(sheet).toBeHidden();
      await expect(page.getByTestId('quick-dashboard-range-label')).toHaveText('기간: 최근 30일');
      await expect(page.getByTestId('quick-dashboard-filter-count')).toHaveText('2');

      await button.click();
      await expect(sheet).toBeVisible();
      await settleAnimations(page);
      await page.getByTestId('quick-dashboard-filter-reset').click();
      await expect(page).not.toHaveURL(/status=/);
      await expect(page).toHaveURL(/[?&]range=30d/);
      await page.getByTestId('quick-dashboard-filter-close').click();
      await expect(page.getByTestId('quick-dashboard-filter-count')).toHaveText('1');
    });
  });

  test('AC-16: M375 dongbang 「기간 직접 선택」 25일 전 ~ 15일 전 — 달력 칸·이전/다음·적용/지우기 ≥ 44 · URL custom · 카드 2장 · 메타바', async ({
    browser
  }) => {
    const tag = uniqueTag('E2E106D16');
    const nos = await createManyAs('user', tag, 2);
    await setRequestedAtMany(nos, daysAgoIso(20));
    const from = daysAgoDateString(25);
    const to = daysAgoDateString(15);

    await withPage(browser, 'dongbang', 'M375', async (page) => {
      await gotoList(page, `?search=${tag}`);
      await page.getByTestId('quick-dashboard-filter-button').click();
      const sheet = page.getByTestId('quick-dashboard-filter-sheet');
      await expect(sheet).toBeVisible();
      await settleAnimations(page);
      await page.getByTestId('quick-dashboard-filter-range-custom').click();
      const calendar = page.getByTestId('quick-dashboard-filter-range-calendar');
      await expect(calendar).toBeVisible();
      await settleAnimations(page);
      const small = await calendar.evaluate((root) =>
        Array.from(root.querySelectorAll('button'))
          .filter((button) => {
            const rect = button.getBoundingClientRect();
            return rect.width > 1 && (rect.width < 43.5 || rect.height < 43.5);
          })
          .map((button) => `${button.getAttribute('aria-label') ?? button.textContent} ${button.getBoundingClientRect().width}×${button.getBoundingClientRect().height}`)
      );
      expect(small, `달력 44px 미달: ${small.join(', ')}`).toEqual([]);
      await expectMinSize(calendar.getByRole('button', { name: /previous month/i }), 44, '이전 달');
      await expectMinSize(calendar.getByRole('button', { name: /next month/i }), 44, '다음 달');
      await expectMinSize(page.getByTestId('quick-dashboard-filter-range-apply'), 44, '적용');
      await expectMinSize(page.getByTestId('quick-dashboard-filter-range-clear'), 44, '지우기');

      await pickCalendarDate(calendar, from);
      await pickCalendarDate(calendar, to);
      await page.getByTestId('quick-dashboard-filter-range-apply').click();
      await expect(page).toHaveURL(new RegExp(`range=custom`));
      await expect(page).toHaveURL(new RegExp(`from=${from}`));
      await expect(page).toHaveURL(new RegExp(`to=${to}`));
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(cards(page)).toHaveCount(2, { timeout: 30_000 });
      await expect(page.getByTestId('quick-dashboard-range-label')).toHaveText(`기간: ${from} ~ ${to}`);
    });
  });

  test('AC-17: M375 dongbang 카드 — 「상세 보기」 0 · quick-card-link · 금액 조건부 · 본문 탭 → 상세 · 「접수」 이동 없음 · 새 대화 ≥ 44 → 대화', async ({
    browser
  }) => {
    const tag = uniqueTag('E2E106D17');
    const requested = (await createAs('user', tag)).requestNo;
    const dispatched = (await createAs('user', tag)).requestNo;
    await acceptAs('dongbang', dispatched);
    await dispatchAs('dongbang', dispatched);
    await markAllConversationsReadAs('dongbang');
    await sendMessageAs('user', requested, '새 대화 1');
    await sendMessageAs('user', requested, '새 대화 2');

    await withPage(browser, 'dongbang', 'M375', async (page) => {
      await gotoList(page, `?search=${tag}`);
      await expect(cards(page)).toHaveCount(2, { timeout: 30_000 });
      for (const no of [requested, dispatched]) {
        const card = page.getByTestId(`quick-card-${no}`);
        await expect(card.getByTestId(`quick-card-detail-${no}`)).toHaveCount(0);
        const link = page.getByTestId(`quick-card-link-${no}`);
        await expect(link).toHaveAccessibleName(`${no} 상세 보기`);
        await expect(link).toHaveAttribute('href', `/dashboard/quick/${no}`);
      }
      await expect(page.getByTestId(`quick-card-amount-${requested}`)).toHaveCount(0);
      const requestedText = await page.getByTestId(`quick-card-${requested}`).innerText();
      expect(requestedText).not.toMatch(/예상|최종/);
      await expect(page.getByTestId(`quick-card-amount-${dispatched}`)).toContainText('20,000원');

      const unread = page.getByTestId(`quick-unread-${requested}`);
      await expect(unread).toBeVisible({ timeout: 20_000 });
      await expectMinSize(unread, 44, '새 대화');

      // 카드 본문 탭 → 상세
      const dispatchedCard = page.getByTestId(`quick-card-${dispatched}`);
      // 카드 본문(요청번호 줄 근처)을 탭 — 덮는 링크가 받는다
      const before = page.url();
      await expect(async () => {
        if (page.url() === before) await dispatchedCard.click({ position: { x: 40, y: 18 }, timeout: 5_000 });
        await expect(page).toHaveURL(new RegExp(`/dashboard/quick/${dispatched}$`), { timeout: 4_000 });
      }).toPass({ timeout: 30_000 });
      await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
      await page.goBack();
      await expect(cards(page)).toHaveCount(2, { timeout: 30_000 });

      // 「접수」 → 접수만 (이동 없음)
      const url = page.url();
      const accept = page.getByTestId(`quick-card-action-${requested}`);
      await expect(accept).toHaveText(/접수/);
      const response = page.waitForResponse(
        (res) => res.url().includes(`/api/quick-request/${requested}/accept`) && res.request().method() === 'POST'
      );
      await accept.click();
      expect((await response).status()).toBe(200);
      await expect(page.getByTestId(`quick-card-${requested}`)).toContainText(STATUS_LABEL.dispatching, { timeout: 20_000 });
      expect(page.url()).toBe(url);

      // 새 대화 → 그 대화
      await clickUntilUrl(page, page.getByTestId(`quick-unread-${requested}`), new RegExp(`/dashboard/quick/chat\\?request=${requested}`));
    });
  });

  test('AC-18: M375 dongbang 45건 — 처음 20장 · 페이지 버튼·「페이지당」 0 · 스크롤 → 40 → 45 · 끝 문구 · testid 중복 0 · URL page 없음 · 칩 탭 → 다시 20장', async ({
    browser
  }) => {
    await withPage(browser, 'dongbang', 'M375', async (page) => {
      await gotoList(page, `?search=${fx.tag45}`);
      await expect(cards(page)).toHaveCount(20, { timeout: 30_000 });
      await expect(page.getByTestId('quick-dashboard-pagination')).toBeHidden();
      await expect(page.getByRole('button', { name: '다음 페이지' })).toBeHidden();
      await expect(page.getByText('페이지당')).toBeHidden();

      await scrollToBottom(page);
      await expect(cards(page)).toHaveCount(40, { timeout: 30_000 });
      await scrollToBottom(page);
      await expect(cards(page)).toHaveCount(45, { timeout: 30_000 });
      const end = page.getByText(TEXT.listEnd, { exact: true });
      await expect(end).toBeVisible({ timeout: 30_000 });
      const ids = await cardTestIds(page);
      expect(new Set(ids).size, 'testid 고유 45').toBe(45);
      expect(new Set(ids)).toEqual(new Set(fx.nos45.map((no) => `quick-card-${no}`)));
      expect(new URL(page.url()).searchParams.get('page')).toBeNull();

      // AC-21 보조 — 끝 문구가 탭 바에 가리지 않음
      await scrollToBottom(page);
      await page.waitForTimeout(300);
      const endRect = await box(end);
      expect(endRect.y + endRect.height, '끝 문구 bottom ≤ 탭 바 top').toBeLessThanOrEqual((await tabbarTop(page)) + 0.5);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByTestId('quick-dashboard-card-requested').click();
      await expect(page).toHaveURL(/[?&]status=requested/);
      await expect(cards(page)).toHaveCount(20, { timeout: 30_000 });
    });
  });

  test('AC-19: M375 admin 40장 불러 둔 상태 — user 등록 → 5초 안 새 카드 맨 위 · 중복 0 · 「신규요청」 +1', async ({ browser }) => {
    await withPage(browser, 'admin', 'M375', async (page) => {
      await gotoList(page, `?search=${fx.tag45}`);
      await expect(cards(page)).toHaveCount(20, { timeout: 30_000 });
      await scrollToBottom(page);
      await expect(cards(page)).toHaveCount(40, { timeout: 30_000 });
      const countEl = page.getByTestId('quick-dashboard-card-requested-count');
      await expect(countEl).not.toHaveText('—', { timeout: 20_000 });
      const before = Number((await countEl.innerText()).trim());
      await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);

      const created = await createAs('user', fx.tag45);
      fx.nos45.push(created.requestNo);
      await expect(cards(page).first()).toHaveAttribute('data-testid', `quick-card-${created.requestNo}`, { timeout: 5_000 });
      await expect(countEl).toHaveText(String(before + 1), { timeout: 5_000 });
      const ids = await cardTestIds(page);
      expect(ids.length - new Set(ids).size, '카드 중복 0').toBe(0);
    });
  });

  test('AC-20: D1280 dongbang 45건 — 「총 45건」·「1 / 3 페이지」·페이지당 10/20/50·버튼 이름 · 영어 0 · 다음 → page=2 · 행 21~40', async ({
    browser
  }) => {
    const tag = uniqueTag('E2E106D20');
    await createManyAs('user', tag, 45);
    await withPage(browser, 'dongbang', 'D1280', async (page) => {
      await gotoList(page, `?search=${tag}`);
      const pagination = page.getByTestId('quick-dashboard-pagination');
      await expect(page.getByTestId('quick-dashboard-pagination-total')).toHaveText('총 45건', { timeout: 30_000 });
      await expect(page.getByTestId('quick-dashboard-pagination-page')).toHaveText('1 / 3 페이지');
      await expect(pagination.getByText('페이지당')).toBeVisible();
      for (const name of ['첫 페이지', '이전 페이지', '다음 페이지', '마지막 페이지']) {
        await expect(pagination.getByRole('button', { name })).toBeAttached();
      }
      const dashText = await page.getByTestId('quick-dashboard').innerText();
      for (const word of ['row(s)', 'Page ', 'Rows per page', 'Go to']) {
        expect(dashText, `영어 「${word}」 0`).not.toContain(word);
      }
      const rows = page.getByTestId('quick-dashboard-table').getByRole('row').filter({ has: page.getByRole('link') });
      await expect(rows).toHaveCount(20);
      await pagination.getByRole('combobox').click();
      await expect(page.getByRole('option')).toHaveText(['10', '20', '50']);
      await page.keyboard.press('Escape');

      await pagination.getByRole('button', { name: '다음 페이지' }).click();
      await expect(page).toHaveURL(/[?&]page=2/);
      await expect(page.getByTestId('quick-dashboard-pagination-page')).toHaveText('2 / 3 페이지', { timeout: 30_000 });
      await expect(rows).toHaveCount(20);
      const page2 = await callAs('dongbang', (api) =>
        api.get(`/api/quick-request?search=${encodeURIComponent(tag)}&page=2&limit=20`)
      );
      const expected = (page2.body.data as { rows: { requestNo: string }[] }).rows.map((row) => row.requestNo);
      for (const no of expected) {
        await expect(page.getByTestId(`quick-row-detail-${no}`)).toBeVisible();
      }
    });
  });

  test('AC-21: M375 user 5건 — 맨 아래 스크롤 · 하단 안내(·끝 문구) bottom ≤ 탭 바 top', async ({ browser }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoList(page, `?search=${fx.tag5}`);
      await expect(cards(page)).toHaveCount(5, { timeout: 30_000 });
      await scrollToBottom(page);
      await page.waitForTimeout(300);
      const footnote = page.getByTestId('quick-dashboard-footnote');
      await expect(footnote).toHaveText(TEXT.footnote);
      const rect = await box(footnote);
      const limit = await tabbarTop(page);
      expect(rect.y + rect.height, `하단 안내 bottom ${rect.y + rect.height} ≤ 탭 바 top ${limit}`).toBeLessThanOrEqual(limit + 0.5);
      const end = page.getByText(TEXT.listEnd, { exact: true });
      if (await end.isVisible()) {
        const endRect = await box(end);
        expect(endRect.y + endRect.height).toBeLessThanOrEqual(limit + 0.5);
      }
    });
  });
});
