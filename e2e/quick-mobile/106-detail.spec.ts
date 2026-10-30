import { expect, test, type Page } from '@playwright/test';
import {
  ABSOLUTE_DATETIME_RE,
  callAs,
  fixtureUser,
  seedQuickRequest,
  STATUS_LABEL,
  type AccountKey
} from '../quick-workflow/helpers';
import { inviteAs } from '../quick-round2/101-helpers';
import { formatAbsoluteDateTimeKo } from '../../src/lib/format-datetime';
import {
  box,
  clickUntilUrl,
  expectMinSize,
  gotoDetail,
  settleAnimations,
  TEXT,
  withPage,
  type ViewportName
} from './helpers';

/**
 * plan 106 §E 퀵 상세 (AC-43 ~ AC-51) — docs/plans/106_quick-mobile-restructure-plan.md
 * 문구표(D-15)는 plan 본문을 그대로 옮겼다(앱 상수 import 안 함).
 */
type SeedState = 'requested' | 'dispatching' | 'dispatched' | 'dispatchedWithFinal' | 'approved' | 'cancelled';

const SUMMARY: Record<SeedState, { requester: string; vendor: string }> = {
  requested: { requester: '동방특송이 요청을 확인하고 있습니다.', vendor: '새 요청입니다. 확인 후 접수해 주세요.' },
  dispatching: { requester: '동방특송이 배차하고 있습니다.', vendor: '배차가 끝나면 배차완료를 입력해 주세요.' },
  dispatched: {
    requester: '배차가 완료되었습니다. 최종금액이 입력되면 승인할 수 있습니다.',
    vendor: '운송이 끝나면 최종금액을 입력해 주세요.'
  },
  dispatchedWithFinal: { requester: '최종금액을 확인하고 승인해 주세요.', vendor: '요청자의 승인을 기다리고 있습니다.' },
  approved: { requester: '승인이 끝난 요청입니다.', vendor: '승인이 끝난 요청입니다.' },
  cancelled: { requester: '취소된 요청입니다.', vendor: '취소된 요청입니다.' }
};

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
}

async function bottomLimit(page: Page) {
  const actions = page.getByTestId('quick-detail-actions');
  if (await actions.isVisible()) return (await box(actions)).y;
  return page.viewportSize()!.height;
}

/** text-destructive 토큰 색과 같은가 */
async function isDestructiveColor(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--destructive)';
    document.body.appendChild(probe);
    const expected = window.getComputedStyle(probe).color;
    probe.remove();
    return { actual: window.getComputedStyle(el).color, expected };
  });
}

test.describe('plan 106 E. 퀵 상세 (휴대폰)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const nos = {} as Record<SeedState, string>;

  test.beforeAll(async () => {
    test.setTimeout(300_000);
    for (const state of Object.keys(SUMMARY) as SeedState[]) {
      nos[state] = (await seedQuickRequest(state, 'user')).requestNo;
    }
  });

  test('AC-43: M375 문구표 6상태 × 요청자·동방 — quick-detail-status-summary 글자 그대로 · top ≤ 200', async ({ browser }) => {
    for (const [account, key] of [
      ['user', 'requester'],
      ['dongbang', 'vendor']
    ] as const) {
      await withPage(browser, account, 'M375', async (page) => {
        for (const state of Object.keys(SUMMARY) as SeedState[]) {
          await gotoDetail(page, nos[state]);
          const summary = page.getByTestId('quick-detail-status-summary');
          await expect(summary, `${account} ${state}`).toHaveText(SUMMARY[state][key]);
          const rect = await box(summary);
          expect(rect.y, `${account} ${state} 상태 문장 top`).toBeLessThanOrEqual(200);
        }
      });
    }
  });

  test('AC-44: M375 dispatched 스테퍼 — 신규요청·접수·배차완료 time 보임 · 전체 시각 형식 · time 높이 ≤ 34 · 스테퍼 가로 넘침 0', async ({
    browser
  }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoDetail(page, nos.dispatched);
      const stepper = page.getByTestId('quick-detail-stepper');
      await expect(stepper).toBeVisible();
      for (const step of ['requested', 'dispatching', 'dispatched']) {
        const info = await page.getByTestId(`quick-detail-step-${step}`).evaluate((li) => {
          const time = li.querySelector('time');
          if (!time) return null;
          const rect = time.getBoundingClientRect();
          const style = window.getComputedStyle(time);
          return { text: (time.textContent ?? '').replace(/\s+/g, ' ').trim(), height: rect.height, visible: style.display !== 'none' && rect.width > 0 };
        });
        expect(info, `${step} time`).not.toBeNull();
        expect(info!.visible, `${step} time 보임`).toBe(true);
        expect(info!.text, `${step} 전체 시각`).toMatch(new RegExp(`^${ABSOLUTE_DATETIME_RE.source}$`));
        expect(info!.height, `${step} time 높이`).toBeLessThanOrEqual(34);
      }
      const overflow = await stepper.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, '스테퍼 scrollWidth ≤ clientWidth').toBeLessThanOrEqual(0);
    });
  });

  test('AC-45: M375·M360 user dispatched — 기사 카드·금액 첫 화면 · tel 링크 · 010-1234-5678 · ≥ 44 · 폭 ≥ 120 · 21마 6543', async ({
    browser
  }) => {
    for (const vp of ['M375', 'M360'] as ViewportName[]) {
      await withPage(browser, 'user', vp, async (page) => {
        await gotoDetail(page, nos.dispatched);
        await page.evaluate(() => window.scrollTo(0, 0));
        const limit = await bottomLimit(page);
        for (const testId of ['quick-detail-driver-card', 'quick-detail-section-amount']) {
          const rect = await box(page.getByTestId(testId));
          expect(rect.y, `${vp} ${testId} top`).toBeGreaterThanOrEqual(0);
          expect(rect.y + rect.height, `${vp} ${testId} bottom ≤ 하단 바 top ${limit}`).toBeLessThanOrEqual(limit + 0.5);
        }
        const phone = page.getByTestId('quick-detail-driver-phone');
        await expect(phone).toHaveAttribute('href', 'tel:01012345678');
        await expect(phone).toContainText('010-1234-5678');
        const rect = await box(phone);
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(rect.width).toBeGreaterThanOrEqual(120);
        await expect(page.getByTestId('quick-detail-driver-vehicle')).toContainText('21마 6543');
        await expect(page.getByTestId('quick-detail-driver-vehicle')).toBeVisible();
      });
    }
  });

  test('AC-46: M375 user — 본문에서 요청 시각 전체 문자열 1곳(스테퍼) · 요청번호 1곳(상태 카드 · 상단바 제외)', async ({ browser }) => {
    const detail = await callAs('user', (api) => api.get(`/api/quick-request/${nos.requested}`));
    const requestedAt = (detail.body.data as { requestedAt: string }).requestedAt;
    const label = formatAbsoluteDateTimeKo(requestedAt);
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoDetail(page, nos.requested);
      const text = await page.getByTestId('quick-detail-mobile').evaluate((el) => (el.textContent ?? '').replace(/\s+/g, ' '));
      const count = (needle: string) => text.split(needle).length - 1;
      expect(count(label), `요청 시각 「${label}」 등장 수`).toBe(1);
      expect(count(nos.requested), `요청번호 「${nos.requested}」 등장 수`).toBe(1);
      const stepperText = await page.getByTestId('quick-detail-stepper').evaluate((el) => (el.textContent ?? '').replace(/\s+/g, ' '));
      expect(stepperText).toContain(label);
    });
  });

  test('AC-47: M375 / D1280 approved 처리 이력 — 휴대폰 최신 1줄 · 「전체 보기」 ≥ 44 · aria-expanded false → true · 최신 위 · PC 처음부터 전체', async ({
    browser
  }) => {
    let fullKeys: string[] = [];
    await withPage(browser, 'user', 'D1280', async (page) => {
      await gotoDetail(page, nos.approved);
      const history = page.getByRole('list', { name: '처리 이력' });
      await expect(history).toBeVisible({ timeout: 30_000 });
      fullKeys = await history.getByRole('listitem').evaluateAll((items) => items.map((item) => item.getAttribute('data-testid') ?? ''));
      expect(fullKeys.length, 'PC 이력 전체 ≥ 4').toBeGreaterThanOrEqual(4);
      await expect(page.getByTestId('quick-detail-history-toggle')).toHaveCount(0);
    });
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoDetail(page, nos.approved);
      const section = page.getByTestId('quick-detail-section-history');
      await expect(section).toBeVisible();
      const items = section.getByRole('listitem');
      await expect(items).toHaveCount(1);
      await expect(items.first()).toHaveAttribute('data-testid', fullKeys[0]);
      const toggle = page.getByTestId('quick-detail-history-toggle');
      await expect(toggle).toHaveText(/전체 보기/);
      await expectMinSize(toggle, 44, '전체 보기');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(items).toHaveCount(fullKeys.length);
      const keys = await items.evaluateAll((list) => list.map((item) => item.getAttribute('data-testid') ?? ''));
      expect(keys, '펼친 순서 = PC(최신 위)').toEqual(fullKeys);
      const times = await items.evaluateAll((list) => list.map((item) => item.querySelector('time')?.getAttribute('dateTime') ?? ''));
      const sorted = [...times].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      expect(times, '최신 위').toEqual(sorted);
    });
  });

  test('AC-48: M360·M375 하단 바 — ① admin dispatched 「최종금액 입력」 ② admin requested 「접수」 ③ dongbang dispatching 「배차완료」 + 대화 + ⋯ · 겹침 0 · ≥ 44 · 뷰포트 안 · 메뉴 전 수정·취소 0 · 항목 ≥ 44 · 취소 빨강', async ({
    browser
  }) => {
    const cases: { account: AccountKey; state: SeedState; primary: RegExp }[] = [
      { account: 'admin', state: 'dispatched', primary: /최종금액 입력/ },
      { account: 'admin', state: 'requested', primary: /접수/ },
      { account: 'dongbang', state: 'dispatching', primary: /배차완료/ }
    ];
    for (const vp of ['M360', 'M375'] as ViewportName[]) {
      for (const item of cases) {
        await withPage(browser, item.account, vp, async (page) => {
          await gotoDetail(page, nos[item.state]);
          const bar = page.getByTestId('quick-detail-actions');
          await expect(bar).toBeVisible();
          const buttons = bar.getByRole('button');
          await expect(buttons, `${vp} ${item.account} ${item.state} 버튼 3개`).toHaveCount(3);
          await expect(buttons.nth(0)).toHaveText(item.primary);
          await expect(buttons.nth(1)).toHaveAttribute('data-testid', 'quick-detail-chat-button');
          await expect(buttons.nth(2)).toHaveAttribute('data-testid', 'quick-detail-more');
          const rects = [];
          for (let i = 0; i < 3; i += 1) {
            const rect = await expectMinSize(buttons.nth(i), 44, `${vp} ${item.state} 버튼 ${i}`);
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(page.viewportSize()!.width + 0.5);
            expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize()!.height + 0.5);
            rects.push(rect);
          }
          for (let i = 0; i < 3; i += 1) {
            for (let j = i + 1; j < 3; j += 1) {
              expect(rectsOverlap(rects[i], rects[j]), `${vp} 버튼 ${i}·${j} 겹침`).toBe(false);
            }
          }
          await expect(page.getByTestId('quick-detail-edit')).toHaveCount(0);
          await expect(page.getByTestId('quick-detail-cancel')).toHaveCount(0);
          await page.getByTestId('quick-detail-more').click();
          await expect(page.getByRole('menu')).toBeVisible();
          await settleAnimations(page);
          await expectMinSize(page.getByTestId('quick-detail-edit'), 44, '수정');
          await expectMinSize(page.getByTestId('quick-detail-cancel'), 44, '요청 취소');
          const color = await isDestructiveColor(page, 'quick-detail-cancel');
          expect(color.actual, '「요청 취소」 destructive 색').toBe(color.expected);
          await page.keyboard.press('Escape');
        });
      }
    }
  });

  test('AC-49: M375 user 본인 requested — 바 = 대화 + ⋯ · ⋯ → 「요청 취소」 → AlertModal 「퀵 요청을 취소할까요?」 → 확인 → 「취소」 · 「취소된 요청입니다.」', async ({
    browser
  }) => {
    const fresh = (await seedQuickRequest('requested', 'user')).requestNo;
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoDetail(page, fresh);
      const bar = page.getByTestId('quick-detail-actions');
      const buttons = bar.getByRole('button');
      await expect(buttons).toHaveCount(2);
      await expect(buttons.nth(0)).toHaveAttribute('data-testid', 'quick-detail-chat-button');
      await expect(buttons.nth(1)).toHaveAttribute('data-testid', 'quick-detail-more');
      await page.getByTestId('quick-detail-more').click();
      await page.getByTestId('quick-detail-cancel').click();
      // AlertModal(ui Modal = role dialog) 제목 「퀵 요청을 취소할까요?」
      const alert = page.getByRole('dialog', { name: TEXT.cancelTitle });
      await expect(alert).toBeVisible();
      const response = page.waitForResponse(
        (res) => res.url().includes(`/api/quick-request/${fresh}/cancel`) && res.request().method() === 'POST'
      );
      await alert.getByRole('button', { name: '요청 취소' }).click();
      expect((await response).status()).toBe(200);
      await expect(page.getByTestId('quick-detail-status')).toHaveText(STATUS_LABEL.cancelled, { timeout: 20_000 });
      await expect(page.getByTestId('quick-detail-status-summary')).toHaveText('취소된 요청입니다.');
    });
  });

  test('AC-50: M375 user approved — 하단 바 0 · 떠 있는 「대화」 ≥ 44 · 오른쪽 아래 · 탭 → ?chat=1', async ({ browser }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoDetail(page, nos.approved);
      await expect(page.getByTestId('quick-detail-actions')).toHaveCount(0);
      const chat = page.getByTestId('quick-detail-chat-button');
      await expect(chat).toBeVisible();
      const rect = await expectMinSize(chat, 44, '떠 있는 대화');
      expect(rect.x + rect.width, '오른쪽 끝').toBeGreaterThanOrEqual(375 - 24);
      expect(rect.y + rect.height, '아래쪽').toBeGreaterThan(812 / 2);
      await clickUntilUrl(page, chat, /chat=1/);
    });
  });

  test('AC-51: M375 logistics 타인 건 · user2 초대 참여자 — 주 버튼 0 · ⋯ 0 · 떠 있는 「대화」만', async ({ browser }) => {
    const target = (await seedQuickRequest('requested', 'user')).requestNo;
    const user2 = await fixtureUser('user2');
    const invited = await inviteAs('user', target, user2.userId);
    expect([200, 201], `초대 ${JSON.stringify(invited.body)}`).toContain(invited.status);
    for (const account of ['logistics', 'user2'] as AccountKey[]) {
      await withPage(browser, account, 'M375', async (page) => {
        await gotoDetail(page, target);
        await expect(page.getByTestId('quick-detail-actions')).toHaveCount(0);
        await expect(page.getByTestId('quick-detail-more')).toHaveCount(0);
        for (const testId of ['quick-detail-accept', 'quick-detail-dispatch', 'quick-detail-set-final', 'quick-detail-approve']) {
          await expect(page.getByTestId(testId)).toHaveCount(0);
        }
        await expect(page.getByTestId('quick-detail-chat-button')).toBeVisible();
      });
    }
  });
});
