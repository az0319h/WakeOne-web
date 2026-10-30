import { expect, test, type Locator, type Page } from '@playwright/test';
import { seedQuickRequest } from '../quick-workflow/helpers';
import {
  clickDesktopRegister,
  clickMobileRegister,
  confirmPreviewAndRegister,
  fillQuickRequestOrder,
  previewDialog
} from '../quick-request/helpers';
import {
  box,
  expectMinSize,
  gotoDetail,
  gotoRequestForm,
  localDatetimeValue,
  settleAnimations,
  TEXT,
  withPage,
  type ViewportName
} from './helpers';

/**
 * plan 106 §C 퀵 요청 폼 (AC-22 ~ AC-30 · AC-27은 106-be-log.spec.ts) — docs/plans/106_quick-mobile-restructure-plan.md
 * 등록 성공 건은 담당자 `E2E 출발`(quick-request helpers) 표식 → cleanup 대상.
 */

function orderPage(page: Page) {
  return page.getByTestId('quick-request-order-page');
}

async function mobileBarBottomGap(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector('[data-testid="quick-request-mobile-bar"]')!.getBoundingClientRect();
    return Math.abs(bar.bottom - window.innerHeight);
  });
}

/** 라디오 카드(label) 세로 중심 ↔ 글자 묶음(field-content) 세로 중심 차이 */
async function radioCenterGap(radio: Locator) {
  return radio.evaluate((element) => {
    const card = element.closest('label')!;
    const content = card.querySelector('[data-slot="field-content"]') ?? card.querySelector('[data-slot="field-title"]');
    const a = card.getBoundingClientRect();
    const b = content!.getBoundingClientRect();
    return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2));
  });
}

async function expectRadioCardsCentered(scope: Locator, label: string) {
  for (const name of ['즉시 요청', '날짜/시간 선택', '최대한 빠르게']) {
    const radio = scope.getByRole('radio', { name }).first();
    await expect(radio).toBeAttached();
    const gap = await radioCenterGap(radio);
    expect(gap, `${label} 「${name}」 세로 중심 차이`).toBeLessThanOrEqual(4);
  }
}

test.describe('plan 106 C. 퀵 요청 폼 (휴대폰)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('AC-22: M375(812·667) — 페이지 스크롤 · 안쪽 스크롤 상자 0 · 위/가운데/맨 아래 요약바 bottom = innerHeight · 맨 아래 「운임 결제」 보임', async ({
    browser
  }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      for (const height of [812, 667]) {
        await page.setViewportSize({ width: 375, height });
        await gotoRequestForm(page);
        const metrics = await page.evaluate(() => ({
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight
        }));
        expect(metrics.scrollHeight, `${height} 문서 scrollHeight > innerHeight`).toBeGreaterThan(metrics.innerHeight);
        const scrollers = await orderPage(page).evaluate((root) =>
          [root, ...Array.from(root.querySelectorAll('*'))]
            .filter((node) => {
              const el = node as HTMLElement;
              const style = window.getComputedStyle(el);
              const scrollable = ['auto', 'scroll'].includes(style.overflowY);
              return scrollable && el.scrollHeight - el.clientHeight > 1 && el.tagName !== 'TEXTAREA';
            })
            .map((node) => `${node.tagName}[${(node as HTMLElement).dataset.testid ?? ''}] ${(node as HTMLElement).scrollHeight}/${(node as HTMLElement).clientHeight}`)
        );
        expect(scrollers, `${height} 안쪽 스크롤 상자: ${scrollers.join(', ')}`).toEqual([]);
        for (const position of ['top', 'middle', 'bottom'] as const) {
          await page.evaluate((pos) => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            window.scrollTo(0, pos === 'top' ? 0 : pos === 'middle' ? max / 2 : max);
          }, position);
          await page.waitForTimeout(200);
          expect(await mobileBarBottomGap(page), `${height} ${position} 요약바 bottom`).toBeLessThanOrEqual(1);
        }
        await expect(page.getByRole('heading', { name: '운임 결제' })).toBeInViewport();
      }
    });
  });

  test('AC-23: M375 빈 폼 높이 ≤ 2,400 · 출발·도착·경유 1 주소 칸 폭 ≥ 300 · M360·M375 담당자·연락처 같은 y', async ({ browser }) => {
    for (const vp of ['M375', 'M360'] as ViewportName[]) {
      await withPage(browser, 'user', vp, async (page) => {
        await gotoRequestForm(page);
        for (const prefix of ['quick-request-origin', 'quick-request-destination']) {
          const name = await box(page.getByTestId(`${prefix}-contact-name`));
          const phone = await box(page.getByTestId(`${prefix}-contact-phone`));
          expect(Math.abs(name.y - phone.y), `${vp} ${prefix} 담당자·연락처 y`).toBeLessThanOrEqual(4);
        }
        if (vp !== 'M375') return;
        const formHeight = (await box(orderPage(page))).height;
        expect(formHeight, 'M375 빈 폼 높이').toBeLessThanOrEqual(2400);
        await page.getByTestId('quick-request-add-stopover').click();
        await expect(page.getByTestId('quick-request-stopover-0-road-address')).toBeVisible();
        for (const prefix of ['quick-request-origin', 'quick-request-destination', 'quick-request-stopover-0']) {
          const width = await page
            .getByTestId(`${prefix}-road-address`)
            .evaluate((input) => (input.closest('[data-slot="input-group"]') ?? input.parentElement!).getBoundingClientRect().width);
          expect(width, `${prefix} 주소 칸 폭`).toBeGreaterThanOrEqual(300);
        }
      });
    }
  });

  test('AC-24: M375 주소 칸 readonly · 탭 → 「주소 검색」 dialog(≥ 90% 높이) · 아이콘 ≥ 44 · 「주소 직접 입력」 → readonly 해제·포커스 · 입력 유지', async ({
    browser
  }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoRequestForm(page);
      const road = page.getByTestId('quick-request-origin-road-address');
      await expect(road).toHaveAttribute('readonly', '');
      await road.click();
      const dialog = page.getByRole('dialog', { name: '주소 검색' });
      await expect(dialog).toBeVisible();
      await settleAnimations(page);
      const dialogHeight = (await box(page.getByTestId('quick-request-address-picker'))).height;
      expect(dialogHeight, `검색창 높이 ${dialogHeight} ≥ 0.9 × 812`).toBeGreaterThanOrEqual(812 * 0.9);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();

      const searchButton = page.getByTestId('quick-request-origin-address-search');
      await expect(searchButton).toHaveAccessibleName('주소 검색');
      await expectMinSize(searchButton, 44, '돋보기');
      await searchButton.click();
      await expect(dialog).toBeVisible();
      const manual = page.getByTestId('quick-request-address-picker-manual');
      await expect(manual).toHaveText(new RegExp(TEXT.manualAddress));
      await manual.click();
      await expect(dialog).toBeHidden();
      await expect(road).not.toHaveAttribute('readonly');
      await expect(road).toBeFocused();
      await road.pressSequentially('서울 중구 세종대로 110');
      await expect(road).toHaveValue('서울 중구 세종대로 110');
      await page.getByTestId('quick-request-origin-detail-address').click();
      await expect(road).toHaveValue('서울 중구 세종대로 110');
    });
  });

  test('AC-25: M375 Enter → 다음 칸 (상세주소 → 담당자 → 연락처 → 다음 글자 칸) · 미리보기 안 열림 · enterkeyhint next / 마지막 done', async ({
    browser
  }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoRequestForm(page);
      const detail = page.getByTestId('quick-request-origin-detail-address');
      const name = page.getByTestId('quick-request-origin-contact-name');
      const phone = page.getByTestId('quick-request-origin-contact-phone');
      for (const field of [detail, name, phone]) {
        await expect(field).toHaveAttribute('enterkeyhint', 'next');
      }
      await detail.click();
      await detail.pressSequentially('3층');
      await page.keyboard.press('Enter');
      await expect(name).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(phone).toBeFocused();
      await page.keyboard.press('Enter');
      const nextHint = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return { tag: el?.tagName ?? '', testid: el?.getAttribute('data-testid') ?? '', hint: el?.getAttribute('enterkeyhint') ?? '' };
      });
      expect(['INPUT', 'TEXTAREA'], `연락처 다음 포커스 ${JSON.stringify(nextHint)}`).toContain(nextHint.tag);
      expect(nextHint.testid).not.toBe('quick-request-origin-contact-phone');
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press('Enter');
      }
      await expect(previewDialog(page)).toBeHidden();
      const hints = await orderPage(page).evaluate((root) =>
        Array.from(root.querySelectorAll('input[enterkeyhint], textarea[enterkeyhint]')).map((el) => el.getAttribute('enterkeyhint'))
      );
      expect(hints.length).toBeGreaterThan(3);
      expect(hints.every((hint) => hint === 'next' || hint === 'done'), hints.join(',')).toBe(true);
      expect(hints[hints.length - 1], '마지막 글자 칸 done').toBe('done');
    });
  });

  for (const vp of ['M375', 'D1280'] as ViewportName[]) {
    test(`AC-26: ${vp} 등록 날짜 검사 — ① 픽업 과거 ② 도착 < 픽업 ③ 도착 과거 → 문구·미리보기 안 열림·에러 칸 보임 · ④ 정상 → 201 · min 속성`, async ({
      browser
    }) => {
      await withPage(browser, 'user', vp, async (page) => {
        const register = () => (vp === 'D1280' ? clickDesktopRegister(page) : clickMobileRegister(page));
        const pickup = page.getByTestId('quick-request-origin-scheduled-datetime');
        const destination = page.getByTestId('quick-request-destination-scheduled-datetime');

        const cases = [
          { name: '①', pickup: localDatetimeValue(-60), dest: undefined, message: TEXT.originPast, field: 'origin' },
          {
            name: '②',
            pickup: localDatetimeValue(120),
            dest: localDatetimeValue(60),
            message: TEXT.destinationBeforeOrigin,
            field: 'destination'
          },
          { name: '③', pickup: undefined, dest: localDatetimeValue(-60), message: TEXT.destinationPast, field: 'destination' }
        ] as const;
        for (const item of cases) {
          await gotoRequestForm(page);
          await fillQuickRequestOrder(page, { pickupDatetime: item.pickup, destDatetime: item.dest });
          await register();
          const error = page.getByText(item.message, { exact: true });
          await expect(error, `${vp} ${item.name}`).toBeVisible({ timeout: 10_000 });
          await expect(previewDialog(page)).toBeHidden();
          await expect(item.field === 'origin' ? pickup : destination).toBeInViewport();
        }

        // ④ 정상 + min 속성
        await gotoRequestForm(page);
        const okPickup = localDatetimeValue(60);
        await fillQuickRequestOrder(page, { pickupDatetime: okPickup, destDatetime: localDatetimeValue(180) });
        await pickup.focus();
        const min = await pickup.getAttribute('min');
        expect(min, 'pickup min').not.toBeNull();
        const nowValue = localDatetimeValue(0);
        const diffMinutes = Math.abs(new Date(`${min}:00`).getTime() - new Date(`${nowValue}:00`).getTime()) / 60_000;
        expect(diffMinutes, `pickup min ${min} ≈ now ${nowValue}`).toBeLessThanOrEqual(1);
        const destMin = await destination.getAttribute('min');
        expect(destMin! >= okPickup, `destination min ${destMin} ≥ pickup ${okPickup}`).toBe(true);
        await register();
        await confirmPreviewAndRegister(page);
      });
    });
  }

  test('AC-28 (r1): M375·D1280 요청 폼 · dongbang 수정 Sheet(dispatching) — 라디오 카드 글자 세로 중심 차이 ≤ 4px', async ({
    browser
  }) => {
    const dispatching = (await seedQuickRequest('dispatching', 'user')).requestNo;
    for (const vp of ['M375', 'D1280'] as ViewportName[]) {
      await withPage(browser, 'user', vp, async (page) => {
        await gotoRequestForm(page);
        await expectRadioCardsCentered(page.getByTestId('quick-request-order-page'), `${vp} 요청 폼`);
      });
      await withPage(browser, 'dongbang', vp, async (page) => {
        await gotoDetail(page, dispatching);
        if (vp === 'D1280') {
          await page.getByTestId('quick-detail-edit').click();
        } else {
          await page.getByTestId('quick-detail-more').click();
          await page.getByTestId('quick-detail-edit').click();
        }
        const sheet = page.getByRole('dialog');
        await expect(sheet.getByRole('radio', { name: '즉시 요청' })).toBeVisible({ timeout: 20_000 });
        await settleAnimations(page);
        await expectRadioCardsCentered(sheet, `${vp} 수정 Sheet`);
      });
    }
  });

  test('AC-29: M360·M375 하단 요약바 ≤ 76 · 요약 한 줄 · 「차량 미선택」 한 단어 · 「등록」 ≥ 44 · Drawer 요약에 입력값', async ({
    browser
  }) => {
    for (const vp of ['M360', 'M375'] as ViewportName[]) {
      await withPage(browser, 'user', vp, async (page) => {
        await gotoRequestForm(page);
        const bar = page.getByTestId('quick-request-mobile-bar');
        const text = page.getByTestId('quick-request-mobile-summary-text');
        const measure = () =>
          text.evaluate((el) => {
            const parts = Array.from(el.children).map((child) => ({
              text: (child as HTMLElement).innerText,
              rects: child.getClientRects().length
            }));
            // 줄 수 = 글자 조각(rect)의 세로 중심을 4px 단위로 묶은 수 (inline 상자마다 top이 0.5px씩 달라도 같은 줄)
            const range = document.createRange();
            range.selectNodeContents(el);
            const centers = Array.from(range.getClientRects())
              .filter((rect) => rect.width > 0)
              .map((rect) => rect.top + rect.height / 2)
              .sort((a, b) => a - b);
            let lines = 0;
            let last = -Infinity;
            for (const center of centers) {
              if (center - last > 4) lines += 1;
              last = center;
            }
            return { parts, lines, height: el.getBoundingClientRect().height };
          });
        expect((await box(bar)).height, `${vp} 바 높이`).toBeLessThanOrEqual(76);
        const empty = await measure();
        expect(empty.lines, `${vp} 빈 폼 요약 한 줄 ${JSON.stringify(empty)}`).toBe(1);
        expect(empty.parts.every((part) => part.rects === 1), JSON.stringify(empty)).toBe(true);
        expect(empty.parts.map((part) => part.text).join(''), '빈 폼 「차량 미선택」').toContain('차량 미선택');
        await expectMinSize(page.getByTestId('quick-request-mobile-register-button'), 44, '등록하기');

        await fillQuickRequestOrder(page, {});
        const filled = await measure();
        expect(filled.lines, `${vp} 입력 후 요약 한 줄 ${JSON.stringify(filled)}`).toBe(1);
        expect((await box(bar)).height, `${vp} 입력 후 바 높이`).toBeLessThanOrEqual(76);

        await page.getByTestId('quick-request-mobile-summary-trigger').click();
        const drawer = page.getByTestId('quick-request-summary-drawer');
        await expect(drawer).toBeVisible();
        await expect(drawer).toContainText('서울 중구 세종대로 110');
        await expect(drawer).toContainText('판교역로 166');
        await expect(drawer).toContainText('오토바이');
      });
    }
  });

  test('AC-30: M375 user 유효 폼 — 하단 「등록」 → 미리보기 「등록」 → 201 → 상세 이동 · 에러 시 첫 에러 칸으로 페이지 스크롤', async ({
    browser
  }) => {
    await withPage(browser, 'user', 'M375', async (page) => {
      await gotoRequestForm(page);
      // 에러: 빈 폼 등록 → 첫 에러 칸(출발 주소)이 화면 안 (페이지 스크롤)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await clickMobileRegister(page);
      await expect(previewDialog(page)).toBeHidden();
      await expect(page.getByTestId('quick-request-origin-road-address')).toBeInViewport({ timeout: 10_000 });
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY, '페이지가 첫 에러 칸으로 스크롤').toBeLessThan(400);

      await gotoRequestForm(page);
      await fillQuickRequestOrder(page, {});
      await clickMobileRegister(page);
      const result = await confirmPreviewAndRegister(page);
      expect(result.requestNo).toMatch(/^\d{4}-\d{2,}$/);
    });
  });
});
