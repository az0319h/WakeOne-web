import { expect, test, type Page } from '@playwright/test';
import { createAs, fixtureUser, STATUS_LABEL, uniqueTag } from '../quick-workflow/helpers';
import { insertFixtureMessages, sendMessageAs } from '../quick-chat/helpers';
import {
  box,
  clickUntilUrl,
  collectMessagePosts,
  countFullyVisibleAbove,
  expectMinSize,
  gotoChatList,
  gotoChatRoom,
  gotoDetail,
  gotoList,
  settleAnimations,
  withPage,
  type ViewportName
} from './helpers';

/**
 * plan 106 §D 퀵 대화 (AC-31 ~ AC-42 · AC-39는 node --test 단위 · AC-40은 grep) — docs/plans/106_quick-mobile-restructure-plan.md
 * AI 답장 추천(`…/messages/suggest`)은 helpers `openAs`에서 503으로 막는다(실제 AI 호출 0 → 규칙 칩).
 */

function messages(page: Page) {
  return page.getByTestId('quick-chat-messages');
}

function input(page: Page) {
  return page.getByTestId('quick-chat-input');
}

async function messagesRatio(page: Page) {
  const rect = await box(messages(page));
  return rect.height / page.viewportSize()!.height;
}

/** 대화방 상단바 공통 판정 (AC-31) */
async function expectFullscreenHeader(page: Page, requestNo: string, backTestId: string, label: string) {
  const header = page.getByTestId('quick-chat-header');
  await expect(header).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('banner')).toBeHidden();
  const topElement = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, 10);
    return el?.closest('[data-testid="quick-chat-header"]') ? 'chat-header' : el?.closest('[data-app-header]') ? 'app-header' : el?.tagName ?? '';
  });
  expect(topElement, `${label} 상단 중앙 = 대화 상단바`).toBe('chat-header');
  await expect(page.getByTestId('quick-mobile-tabbar')).toHaveCount(0);
  expect((await box(header)).height, `${label} 상단바 높이`).toBeLessThanOrEqual(60);
  await expectMinSize(page.getByTestId(backTestId), 44, `${label} 뒤로`);
  const no = header.getByRole('heading', { name: requestNo });
  await expect(no).toBeVisible();
  expect((await box(no)).height, `${label} 요청번호 한 줄`).toBeLessThanOrEqual(28);
  await expect(header.getByText(STATUS_LABEL.requested, { exact: true })).toBeVisible();
  await expectMinSize(page.getByTestId('quick-chat-more'), 44, `${label} ⋯`);
  await expect(messages(page)).toBeVisible();
  const ratio = await messagesRatio(page);
  expect(ratio, `${label} 메시지 영역 비율 ${ratio.toFixed(3)}`).toBeGreaterThanOrEqual(0.7);
}

async function scrollGap(page: Page) {
  return page.evaluate(() => {
    const scroller = document.scrollingElement!;
    return scroller.scrollHeight - window.innerHeight;
  });
}

async function lastBubbleGap(page: Page) {
  return messages(page).evaluate((container) => {
    const bubbles = Array.from(container.querySelectorAll('[data-testid^="quick-chat-message-"]'));
    const last = bubbles[bubbles.length - 1];
    const c = container.getBoundingClientRect();
    const b = last.getBoundingClientRect();
    return { gap: c.bottom - b.bottom, scrollTop: container.scrollTop, max: container.scrollHeight - container.clientHeight };
  });
}

test.describe('plan 106 D. 퀵 대화 (휴대폰 전체 화면)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const fx = { tag: '', three: '', one: '', oneId: 0, thirty: '' };

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    fx.tag = uniqueTag('E2E106C');
    fx.three = (await createAs('user', fx.tag)).requestNo;
    for (const body of ['첫 메시지', '둘째 메시지', '셋째 메시지']) {
      await sendMessageAs('user', fx.three, body);
    }
    fx.one = (await createAs('user', fx.tag)).requestNo;
    fx.oneId = (await sendMessageAs('user', fx.one, '2시로 변경 가능할까요?')).id;
  });

  test('AC-31: M375·M360 dongbang 대화방 · user 상세 대화 — 공통 상단바 0 · 탭 바 0 · 상단바 ≤ 60 · 뒤로·⋯ ≥ 44 · 번호 한 줄 · 배지 · 메시지 ≥ 70%', async ({
    browser
  }) => {
    for (const vp of ['M375', 'M360'] as ViewportName[]) {
      await withPage(browser, 'dongbang', vp, async (page) => {
        await gotoChatList(page, `?q=${fx.tag}`);
        const item = page.getByTestId(`quick-chat-list-item-${fx.three}`);
        await expect(item).toBeVisible({ timeout: 30_000 });
        await clickUntilUrl(page, item, new RegExp(`request=${fx.three}`));
        await expectFullscreenHeader(page, fx.three, 'quick-chat-back', `${vp} 대화방`);
      });
      await withPage(browser, 'user', vp, async (page) => {
        await gotoDetail(page, fx.three);
        await clickUntilUrl(page, page.getByTestId('quick-detail-chat-button'), /chat=1/);
        await expectFullscreenHeader(page, fx.three, 'quick-detail-chat-back', `${vp} 상세 대화`);
      });
    }
  });

  test('AC-32: M375 「⋯」 — 항목 ≥ 44 · 「참여자 N」 → Drawer · 「상세 보기」 → 상세 · 상세 대화 메뉴엔 「상세 보기」 0', async ({ browser }) => {
    await withPage(browser, 'dongbang', 'M375', async (page) => {
      await gotoChatRoom(page, fx.three);
      await page.getByTestId('quick-chat-more').click();
      const menu = page.getByTestId('quick-chat-more-menu');
      await expect(menu).toBeVisible();
      await settleAnimations(page);
      const participants = page.getByTestId('quick-chat-more-participants');
      await expect(participants).toHaveText(/참여자 \d+/);
      await expectMinSize(participants, 44, '참여자');
      await expectMinSize(page.getByTestId('quick-chat-detail-link'), 44, '상세 보기');
      await participants.click();
      await expect(page.getByTestId('quick-chat-participants-drawer')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('quick-chat-participants-drawer')).toBeHidden();

      await page.getByTestId('quick-chat-more').click();
      await expect(menu).toBeVisible();
      await clickUntilUrl(page, page.getByTestId('quick-chat-detail-link'), new RegExp(`/dashboard/quick/${fx.three}$`));
      await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
    });
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoDetail(page, fx.three, '?chat=1');
      await expect(page.getByTestId('quick-chat-header')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('quick-chat-more').click();
      await expect(page.getByTestId('quick-chat-more-menu')).toBeVisible();
      await expect(page.getByTestId('quick-chat-more-participants')).toBeVisible();
      await expect(page.getByTestId('quick-chat-detail-link')).toHaveCount(0);
    });
  });

  test('AC-33: M375 터치 Enter = 줄바꿈(POST 0 · enterkeyhint=enter) · 「전송」 201 · 말풍선 줄바꿈 / D1280 Enter 전송 · Shift+Enter 줄바꿈', async ({
    browser
  }) => {
    const no = (await createAs('user', uniqueTag('E2E106C33'))).requestNo;
    await withPage(browser, 'user', 'M375', async (page) => {
      const posts = collectMessagePosts(page);
      await gotoChatRoom(page, no);
      const field = input(page);
      await expect(field).toHaveAttribute('enterkeyhint', 'enter');
      await field.click();
      await field.pressSequentially('첫 줄');
      await page.keyboard.press('Enter');
      await field.pressSequentially('둘째 줄');
      await page.waitForTimeout(800);
      expect(posts, 'Enter 뒤 POST 0').toHaveLength(0);
      expect(await field.inputValue()).toBe('첫 줄\n둘째 줄');
      const response = page.waitForResponse(
        (res) => new URL(res.url()).pathname.endsWith('/messages') && res.request().method() === 'POST'
      );
      await page.getByTestId('quick-chat-send').click();
      const res = await response;
      expect(res.status()).toBe(201);
      const id = ((await res.json()) as { data: { message: { id: number } } }).data.message.id;
      const bubble = page.getByTestId(`quick-chat-message-${id}`);
      await expect(bubble).toBeVisible({ timeout: 10_000 });
      expect(await bubble.innerText()).toMatch(/첫 줄\n둘째 줄/);
    });
    await withPage(browser, 'user', 'D1280', async (page) => {
      await gotoChatRoom(page, no);
      const field = input(page);
      await expect(field).toHaveAttribute('enterkeyhint', 'send');
      await field.click();
      await field.pressSequentially('위');
      await page.keyboard.press('Shift+Enter');
      await field.pressSequentially('아래');
      expect(await field.inputValue()).toBe('위\n아래');
      const response = page.waitForResponse(
        (res) => new URL(res.url()).pathname.endsWith('/messages') && res.request().method() === 'POST'
      );
      await page.keyboard.press('Enter');
      expect((await response).status()).toBe(201);
    });
  });

  test('AC-34: M375 입력 중 칩 줄 숨김 → 지우면 보임 → 칩 탭 = 채우기만(전송 0) · D1280 입력 중에도 칩 보임', async ({ browser }) => {
    const no = (await createAs('user', uniqueTag('E2E106C34'))).requestNo;
    await withPage(browser, 'user', 'M375', async (page) => {
      const posts = collectMessagePosts(page);
      await gotoChatRoom(page, no);
      const row = page.getByTestId('quick-chat-quick-replies-row');
      await expect(row).toBeVisible({ timeout: 20_000 });
      const field = input(page);
      await field.click();
      await field.pressSequentially('가');
      await expect(row).toBeHidden();
      await field.press('Backspace');
      await expect(field).toHaveValue('');
      await expect(row).toBeVisible();
      const chip = page.getByTestId('quick-chat-quick-reply-0');
      const chipText = (await chip.innerText()).trim();
      await chip.click();
      await expect(field).toHaveValue(chipText);
      await expect(row).toBeHidden();
      await page.waitForTimeout(800);
      expect(posts, '칩 탭은 전송 0').toHaveLength(0);
    });
    await withPage(browser, 'user', 'D1280', async (page) => {
      await gotoChatRoom(page, no);
      const row = page.getByTestId('quick-chat-quick-replies-row');
      await expect(row).toBeVisible({ timeout: 20_000 });
      await input(page).click();
      await input(page).pressSequentially('가나');
      await page.waitForTimeout(300);
      await expect(row).toBeVisible();
    });
  });

  test('AC-35: M375 뒤로 기록 — ① 탭→항목→뒤로→goBack = 내역 ② 항목→goBack = 목록 ③ 바로 진입→뒤로(replace)→goBack ≠ 대화방 ④ 상세→대화→상세로→goBack chat=1 없음', async ({
    browser
  }) => {
    await withPage(browser, 'dongbang', 'M375', async (page) => {
      // ①
      await gotoList(page);
      await clickUntilUrl(page, page.getByTestId('quick-mobile-tab-chat'), /\/dashboard\/quick\/chat$/);
      const item = page.getByTestId(`quick-chat-list-item-${fx.three}`);
      await page.getByTestId('quick-chat-search').fill(fx.tag);
      await expect(item).toBeVisible({ timeout: 30_000 });
      await clickUntilUrl(page, item, new RegExp(`request=${fx.three}`));
      await expect(page.getByTestId('quick-chat-header')).toBeVisible({ timeout: 30_000 });
      await clickUntilUrl(page, page.getByTestId('quick-chat-back'), /\/dashboard\/quick\/chat(\?(?!.*request=)[^#]*)?$/);
      await expect(page.getByTestId('quick-chat-list')).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard\/quick(\?.*)?$/, { timeout: 15_000 });
      expect(page.url()).not.toContain('request=');

      // ②
      await gotoChatList(page, `?q=${fx.tag}`);
      await expect(item).toBeVisible({ timeout: 30_000 });
      await clickUntilUrl(page, item, new RegExp(`request=${fx.three}`));
      await expect(page.getByTestId('quick-chat-header')).toBeVisible({ timeout: 30_000 });
      await page.goBack();
      await expect(page).not.toHaveURL(/request=/, { timeout: 15_000 });
      await expect(page.getByTestId('quick-chat-list')).toBeVisible();

      // ③
      await gotoChatRoom(page, fx.three);
      await clickUntilUrl(page, page.getByTestId('quick-chat-back'), /\/dashboard\/quick\/chat(\?(?!.*request=)[^#]*)?$/);
      await expect(page.getByTestId('quick-chat-list')).toBeVisible();
      await page.goBack();
      await page.waitForTimeout(1_000);
      expect(page.url(), 'goBack 결과가 그 대화방이 아님').not.toContain(`request=${fx.three}`);
    });
    await withPage(browser, 'user', 'M375', async (page) => {
      // ④
      await gotoDetail(page, fx.three);
      await clickUntilUrl(page, page.getByTestId('quick-detail-chat-button'), /chat=1/);
      await expect(page.getByTestId('quick-chat-header')).toBeVisible({ timeout: 30_000 });
      await clickUntilUrl(page, page.getByTestId('quick-detail-chat-back'), new RegExp(`/dashboard/quick/${fx.three}$`));
      await page.goBack();
      await page.waitForTimeout(1_000);
      expect(page.url(), 'goBack 뒤 chat=1 없음').not.toContain('chat=1');
    });
  });

  test('AC-36: M375 메시지 30개 맨 아래 — 키보드(476) 맨 아래 유지 · 입력창 보임 · 이중 스크롤 0 · 812 복귀 유지 · 위로 스크롤 상태는 강제로 내리지 않음', async ({
    browser
  }) => {
    const created = await createAs('user', uniqueTag('E2E106C36'));
    const user = await fixtureUser('user');
    const base = Date.now() - 60 * 60_000;
    await insertFixtureMessages(
      created.id,
      Array.from({ length: 30 }, (_, i) => ({
        authorUserId: user.userId,
        authorName: user.fullName,
        authorRole: 'requester' as const,
        body: `키보드 확인 메시지 ${i + 1}`,
        createdAt: new Date(base + i * 60_000).toISOString()
      }))
    );
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoChatRoom(page, created.requestNo);
      await expect(messages(page).getByText('키보드 확인 메시지 30', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => (await lastBubbleGap(page)).gap, { timeout: 10_000 }).toBeLessThanOrEqual(16);
      await input(page).focus();
      await page.setViewportSize({ width: 375, height: 476 });
      await expect.poll(async () => (await lastBubbleGap(page)).gap, { timeout: 10_000, message: '476 맨 아래 유지' }).toBeLessThanOrEqual(16);
      expect((await lastBubbleGap(page)).gap).toBeGreaterThanOrEqual(-1);
      await expect(input(page)).toBeInViewport();
      expect(await scrollGap(page), '476 이중 스크롤 0').toBeLessThanOrEqual(1);
      await page.setViewportSize({ width: 375, height: 812 });
      await expect.poll(async () => (await lastBubbleGap(page)).gap, { timeout: 10_000, message: '812 복귀 맨 아래' }).toBeLessThanOrEqual(16);
      expect(await scrollGap(page), '812 이중 스크롤 0').toBeLessThanOrEqual(1);

      // 위로 스크롤해 둔 상태 → 키보드 → 강제로 내리지 않음
      await messages(page).evaluate((node) => {
        node.scrollTop = 0;
      });
      await page.waitForTimeout(300);
      await page.setViewportSize({ width: 375, height: 476 });
      await page.waitForTimeout(800);
      const after = await lastBubbleGap(page);
      expect(after.scrollTop, '위로 본 상태 유지').toBeLessThan(after.max - 50);
      await page.setViewportSize({ width: 375, height: 812 });
    });
  });

  test('AC-37: M375 dongbang 대화 목록 — 첫 항목 top ≤ 300 · 탭 바 위 완전히 보이는 항목 ≥ 4 · 검색·탭 ≥ 44 · 「필터」 버튼', async ({ browser }) => {
    const tag = uniqueTag('E2E106C37');
    for (let i = 0; i < 8; i += 1) {
      const no = (await createAs('user', tag)).requestNo;
      await sendMessageAs('user', no, `목록 확인 ${i + 1}`);
    }
    await withPage(browser, 'dongbang', 'M375', async (page) => {
      await gotoChatList(page, `?q=${tag}`);
      const list = page.getByTestId('quick-chat-list');
      const items = list.getByRole('listitem');
      await expect(items).toHaveCount(8, { timeout: 30_000 });
      const first = await box(items.first());
      expect(first.y, '첫 항목 top').toBeLessThanOrEqual(300);
      const tabbarTop = (await box(page.getByTestId('quick-mobile-tabbar'))).y;
      const visible = await countFullyVisibleAbove(items, tabbarTop);
      expect(visible, '탭 바 위 완전히 보이는 항목').toBeGreaterThanOrEqual(4);
      expect((await box(page.getByTestId('quick-chat-search'))).height).toBeGreaterThanOrEqual(44);
      await expectMinSize(page.getByTestId('quick-chat-tab-all'), 44, '전체 탭');
      await expectMinSize(page.getByTestId('quick-chat-tab-unread'), 44, '안 읽음 탭');
      const filter = page.getByTestId('quick-chat-filter-button');
      await expect(filter).toBeVisible();
      await expectMinSize(filter, 44, '필터');
      await expect(page.getByTestId('quick-chat-range-7d')).toBeHidden();
      await filter.click();
      await expect(page.getByTestId('quick-chat-filter-sheet')).toBeVisible();
      await expect(page.getByTestId('quick-chat-filter-range-30d')).toBeVisible();
      await page.getByTestId('quick-chat-filter-close').click();
      await expect(page.getByTestId('quick-chat-filter-sheet')).toBeHidden();
    });
  });

  test('AC-38: M375·D1280 dongbang 짧은 시각 — 목록 「16:03」·「MM-dd」·「yyyy-MM-dd」 · time dateTime ISO · 말풍선 HH:mm · 날짜 구분선 · 상대 표현 0 · 미리보기 폭 ≥ 180', async ({
    browser
  }) => {
    const tag = uniqueTag('E2E106C38');
    const user = await fixtureUser('user');
    const kstToday = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
    const year = Number(kstToday.slice(0, 4));
    const otherDay = new Date(Date.now() + 9 * 3_600_000 - 40 * 86_400_000).toISOString().slice(0, 10);
    const sameYearOther = otherDay.startsWith(String(year)) ? otherDay : `${year}-01-02`;
    const fixtures = [
      { iso: `${kstToday}T16:03:04+09:00`, list: '16:03', bubble: '16:03' },
      { iso: `${sameYearOther}T09:15:00+09:00`, list: sameYearOther.slice(5), bubble: '09:15' },
      { iso: `${year - 1}-06-01T12:00:00+09:00`, list: `${year - 1}-06-01`, bubble: '12:00' }
    ];
    const nos: string[] = [];
    for (const item of fixtures) {
      const created = await createAs('user', tag);
      nos.push(created.requestNo);
      await insertFixtureMessages(created.id, [
        {
          authorUserId: user.userId,
          authorName: user.fullName,
          authorRole: 'requester',
          body: `짧은 시각 확인 ${created.requestNo}`,
          createdAt: new Date(item.iso).toISOString()
        }
      ]);
    }
    for (const vp of ['M375', 'D1280'] as ViewportName[]) {
      await withPage(browser, 'dongbang', vp, async (page) => {
        await gotoChatList(page, `?q=${tag}&range=all`);
        for (let i = 0; i < nos.length; i += 1) {
          const item = page.getByTestId(`quick-chat-list-item-${nos[i]}`);
          await expect(item).toBeVisible({ timeout: 30_000 });
          const time = await item.evaluate((el) => {
            const t = el.querySelector('time')!;
            return { text: t.textContent?.trim(), dateTime: t.getAttribute('dateTime') ?? '' };
          });
          expect(time.text, `${vp} 목록 시각 ${nos[i]}`).toBe(fixtures[i].list);
          expect(new Date(time.dateTime).toISOString(), `${vp} dateTime ISO`).toBe(new Date(fixtures[i].iso).toISOString());
          if (vp === 'M375') {
            const width = await item.evaluate((el) => {
              const preview = Array.from(el.querySelectorAll('p')).find((p) => p.textContent?.includes('짧은 시각 확인'));
              return preview?.getBoundingClientRect().width ?? 0;
            });
            expect(width, 'M375 미리보기 폭').toBeGreaterThanOrEqual(180);
          }
        }
        // 대화 — 말풍선 HH:mm · 날짜 구분선 yyyy-MM-dd · 상대 표현 0
        await gotoChatRoom(page, nos[0]);
        const bubble = messages(page).getByText(`짧은 시각 확인 ${nos[0]}`, { exact: true });
        await expect(bubble).toBeVisible({ timeout: 30_000 });
        const bubbleTimes = await messages(page).evaluate((root) =>
          Array.from(root.querySelectorAll('[data-testid^="quick-chat-message-"] time')).map((t) => t.textContent?.trim())
        );
        expect(bubbleTimes).toContain('16:03');
        expect(bubbleTimes.every((t) => /^\d{2}:\d{2}$/.test(t ?? '')), bubbleTimes.join(',')).toBe(true);
        await expect(page.getByTestId('quick-chat-date-divider').first()).toContainText(kstToday);
        const text = await messages(page).innerText();
        expect(text, `${vp} 대화 영역 상대 표현 0`).not.toMatch(/\d+\s*(분|시간|일)\s*전|방금|어제/);
      });
    }
  });

  test('AC-41: M375·T768 입력 글자 ≥ 16px · D1280 14px', async ({ browser }) => {
    for (const [vp, check] of [
      ['M375', (size: number) => expect(size).toBeGreaterThanOrEqual(16)],
      ['T768', (size: number) => expect(size).toBeGreaterThanOrEqual(16)],
      ['D1280', (size: number) => expect(size).toBe(14)]
    ] as const) {
      await withPage(browser, 'user', vp as ViewportName, async (page) => {
        await gotoChatRoom(page, fx.one);
        await expect(input(page)).toBeVisible({ timeout: 30_000 });
        const size = await input(page).evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
        check(size);
      });
    }
  });

  test('AC-42 보조 (말풍선 폭 · root 추가 확인): M375 상대의 짧은 메시지 말풍선 폭 ≈ 글자 폭 · < 이름 줄 폭 · 내 말풍선 오른쪽 정렬', async ({
    browser
  }) => {
    const no = (await createAs('user', uniqueTag('E2E106CB'))).requestNo;
    const mine = await sendMessageAs('user', no, '확인 부탁드립니다');
    const theirs = await sendMessageAs('dongbang', no, '네');
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoChatRoom(page, no);
      await expect(page.getByTestId(`quick-chat-message-${theirs.id}`)).toBeVisible({ timeout: 30_000 });
      const measure = (id: number) =>
        page.getByTestId(`quick-chat-message-${id}`).evaluate((row) => {
          const body = Array.from(row.querySelectorAll('div')).find(
            (div) => div.children.length === 0 && (div.textContent ?? '').trim().length > 0
          )!;
          const range = document.createRange();
          range.selectNodeContents(body);
          const text = range.getBoundingClientRect();
          const bubble = body.getBoundingClientRect();
          const nameRow = body.parentElement?.firstElementChild !== body ? body.parentElement?.firstElementChild : null;
          const list = row.closest('[data-testid="quick-chat-messages"]')!.getBoundingClientRect();
          return {
            bubbleWidth: bubble.width,
            textWidth: text.width,
            nameRowWidth: nameRow ? nameRow.getBoundingClientRect().width : null,
            left: bubble.left - list.left,
            right: list.right - bubble.right,
            listWidth: list.width
          };
        });
      const partner = await measure(theirs.id);
      // px-3(12px × 2) 안쪽 여유 + 반올림 2px
      expect(partner.bubbleWidth, `상대 말풍선 폭 ${JSON.stringify(partner)}`).toBeLessThanOrEqual(partner.textWidth + 24 + 2);
      expect(partner.nameRowWidth, '상대 그룹 이름 줄').not.toBeNull();
      expect(partner.bubbleWidth, `상대 말풍선 폭 < 이름 줄 폭 ${JSON.stringify(partner)}`).toBeLessThan(partner.nameRowWidth!);
      expect(partner.left, '상대 말풍선 왼쪽').toBeLessThan(partner.listWidth / 2);
      const me = await measure(mine.id);
      expect(me.bubbleWidth, `내 말풍선 폭 ${JSON.stringify(me)}`).toBeLessThanOrEqual(me.textWidth + 24 + 2);
      expect(me.right, `내 말풍선 오른쪽 정렬 ${JSON.stringify(me)}`).toBeLessThanOrEqual(24);
    });
  });

  test('AC-42: M375 메시지 1개 — 상세 ?chat=1 · 대화방: 말풍선 bottom ↔ 컨테이너 bottom ≤ 16 · 말풍선 < 입력창 top · 상단 빈 공간', async ({
    browser
  }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      for (const open of [() => gotoDetail(page, fx.one, '?chat=1'), () => gotoChatRoom(page, fx.one)]) {
        await open();
        const bubble = page.getByTestId(`quick-chat-message-${fx.oneId}`);
        await expect(bubble).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(300);
        const b = await box(bubble);
        const c = await box(messages(page));
        const i = await box(input(page));
        const stack = await box(page.getByTestId('quick-chat-messages-stack'));
        const gap = c.y + c.height - (b.y + b.height);
        expect(gap, `말풍선 bottom ↔ 컨테이너 bottom ${gap}`).toBeLessThanOrEqual(16);
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height, '말풍선 bottom < 입력창 top').toBeLessThan(i.y);
        expect(Math.abs(stack.y + stack.height - (b.y + b.height)), 'stack bottom = 말풍선 bottom').toBeLessThanOrEqual(2);
        expect(b.y - c.y, '상단 빈 공간').toBeGreaterThan(c.height / 2);
      }
    });
  });
});
