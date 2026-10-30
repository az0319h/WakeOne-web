import { expect, test, type Locator, type Page } from '@playwright/test';
import { THEMES } from '../../src/components/themes/theme.config';
import {
  gotoChat,
  gotoDetailChat,
  insertFixtureMessages,
  messageBubble,
  messagesLog,
  REALTIME_TIMEOUT_MS,
  sendMessageAs,
  SUBSCRIBE_SETTLE_MS,
  waitForSubscribed
} from '../quick-chat/helpers';
import {
  applyThemeBeforeNavigation,
  clickDesktopRegister,
  clickMobileRegister,
  type ColorMode,
  confirmPreviewAndRegister,
  expectNoHorizontalScroll,
  expectThemeApplied,
  fillLocationByPrefix,
  fillQuickRequestOrder,
  gotoQuickRequest,
  previewCard,
  previewChips,
  previewDialog,
  previewItemDescription,
  previewStopovers,
  quickRequestMain,
  VIEWPORT_DESKTOP,
  VIEWPORT_MOBILE
} from '../quick-request/helpers';
import {
  createAs,
  dbQuickRequest,
  fixtureUser,
  pageAs,
  readAccountMeta,
  uniqueTag
} from '../quick-workflow/helpers';
import { grepDir, readSource } from './helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

/**
 * plan 96 — 퀵 요청 미리보기 구조화 카드 · 채팅 말풍선 하단 정렬
 * docs/plans/96_quick-preview-card-chat-bottom-align-plan.md (AC-01 ~ AC-10 · AC-11은 verifier CLI)
 *
 * - user.json(요청자) 기본 · 레이아웃 판정은 boundingBox()·page.evaluate만
 * - Dialog는 `zoom-in-95 duration-200` 애니메이션 → visible 후 400ms 뒤 측정 (frontend 핸드오프 §5)
 */

const MODES: ColorMode[] = ['light', 'dark'];
/** Dialog 열림 애니메이션(200ms) 종료 대기 — `getAnimations().finished`는 무한 애니메이션 때문에 hang → 사용 금지 */
const DIALOG_SETTLE_MS = 400;
/** AC-01 전제 — 출발 연락처 `01011112222` → 표시 `010-1111-2222` */
const AC01_ORIGIN_PHONE = '01011112222';
const STOPOVER_ROAD = '서울 마포구 양화로 45';

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result, `boundingBox ${String(locator)}`).not.toBeNull();
  return result!;
}

/** plan 96 AC-01 전제 폼 — 출발(세종대로 110 / 1층 / E2E 출발 / 01011112222) · 경유 1 · 도착 · 소형 · 다마스 1대 · 월정산 · 즉시 */
async function fillAc01Form(page: Page) {
  const main = quickRequestMain(page);
  await main.getByTestId('quick-request-add-stopover').click();
  await fillLocationByPrefix(page, 'quick-request-stopover-0', {
    road: STOPOVER_ROAD,
    detail: '2층',
    name: '김경유',
    phone: '01055556666'
  });
  await fillQuickRequestOrder(page, { vehicles: ['다마스'], count: { preset: 1 }, goodsSize: 's', freight: 'monthly' });
  await main.getByTestId('quick-request-origin-contact-phone').fill(AC01_ORIGIN_PHONE);
}

async function openPreview(page: Page, device: 'desktop' | 'mobile') {
  if (device === 'desktop') {
    await clickDesktopRegister(page);
  } else {
    await clickMobileRegister(page);
  }
  const dialog = previewDialog(page);
  await expect(dialog).toBeVisible();
  await expect(previewCard(page)).toBeVisible();
  await page.waitForTimeout(DIALOG_SETTLE_MS);
  return dialog;
}

function hideNextDevOverlay(page: Page) {
  // Next dev-tools 플로팅 버튼(좌하단)이 375에서 액션바 「대화」와 겹친다 → dev 전용 오버레이만 숨긴다 (08-mobile 동일)
  return page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal { display: none !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  });
}

// ---------------------------------------------------------------------------
// A. 미리보기 구조화 카드 (AC-01 ~ AC-04)
// ---------------------------------------------------------------------------
test.describe('plan 96 A. 미리보기 구조화 카드', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-01: 1280 · 등록 → Dialog 「퀵 요청 미리보기」 · 출발/도착 같은 y(±4) · 도로명·상세·담당자·010-1111-2222 · 「경유 1」 · 칩 소형/다마스 × 1/월정산/즉시 요청 · <pre> 0건', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    await fillAc01Form(page);
    const dialog = await openPreview(page, 'desktop');
    await expect(dialog.getByRole('heading', { name: '퀵 요청 미리보기' })).toBeVisible();

    const origin = page.getByTestId('quick-request-preview-origin');
    const destination = page.getByTestId('quick-request-preview-destination');
    await expect(origin).toBeVisible();
    await expect(destination).toBeVisible();
    const originBox = await box(origin);
    const destBox = await box(destination);
    expect(Math.abs(originBox.y - destBox.y), `origin y ${originBox.y} vs destination y ${destBox.y}`).toBeLessThanOrEqual(4);
    expect(destBox.x, '도착 칸이 오른쪽').toBeGreaterThan(originBox.x + originBox.width - 1);

    await expect(origin).toContainText('서울 중구 세종대로 110');
    await expect(origin).toContainText('1층');
    await expect(origin).toContainText('E2E 출발');
    await expect(origin).toContainText('010-1111-2222');
    await expect(destination).toContainText('경기 성남시 분당구 판교역로 166');
    await expect(destination).toContainText('2층');
    await expect(destination).toContainText('E2E 도착');
    await expect(destination).toContainText('010-8765-4321');

    const stopovers = previewStopovers(page);
    await expect(stopovers).toContainText('경유 1');
    await expect(stopovers).toContainText(STOPOVER_ROAD);

    const chips = previewChips(page);
    await expect(chips.getByText('소형', { exact: true })).toHaveCount(1);
    await expect(chips).toContainText('다마스 × 1');
    await expect(chips.getByText('월정산', { exact: true })).toHaveCount(1);
    await expect(chips.getByText('즉시 요청', { exact: true })).toHaveCount(1);

    await expect(page.getByTestId('quick-request-preview-message')).toHaveCount(0);
    await expect(dialog.locator('pre')).toHaveCount(0);
  });

  test('AC-02: 375 · 출발 칸 위·도착 칸 아래 · 가로 스크롤 없음 · 취소/등록 세로 배치 · 간격 ≥ 8px · 높이 ≥ 44px', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_MOBILE);
    await fillAc01Form(page);
    await openPreview(page, 'mobile');

    const originBox = await box(page.getByTestId('quick-request-preview-origin'));
    const destBox = await box(page.getByTestId('quick-request-preview-destination'));
    expect(destBox.y, `도착 y ${destBox.y} > 출발 y ${originBox.y}`).toBeGreaterThan(originBox.y + originBox.height - 1);
    await expectNoHorizontalScroll(page);
    const dialogOverflow = await previewDialog(page).evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(dialogOverflow, 'Dialog 가로 넘침').toBeLessThanOrEqual(0);

    const cancel = page.getByTestId('quick-request-preview-cancel');
    const confirm = page.getByTestId('quick-request-confirm-button');
    const cancelBox = await box(cancel);
    const confirmBox = await box(confirm);
    // flex-col-reverse → 「등록」 위 · 「취소」 아래
    expect(confirmBox.y + confirmBox.height, '등록이 취소 위').toBeLessThanOrEqual(cancelBox.y);
    const gap = cancelBox.y - (confirmBox.y + confirmBox.height);
    expect(gap, `세로 간격 ${gap}px`).toBeGreaterThanOrEqual(8);
    expect(cancelBox.height, `취소 높이 ${cancelBox.height}`).toBeGreaterThanOrEqual(44);
    expect(confirmBox.height, `등록 높이 ${confirmBox.height}`).toBeGreaterThanOrEqual(44);
    expect(Math.abs(cancelBox.width - confirmBox.width), '두 버튼 같은 폭(full-width)').toBeLessThanOrEqual(1);
  });

  test('AC-03: 1280 · 취소/등록 가로 배치 · x 간격 ≥ 8px · 「취소」 → Dialog 닫힘 + 폼 유지 · 「등록」 → 201 · 상세 이동', async ({
    page
  }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    await fillAc01Form(page);
    const dialog = await openPreview(page, 'desktop');

    const cancel = page.getByTestId('quick-request-preview-cancel');
    const confirm = page.getByTestId('quick-request-confirm-button');
    const cancelBox = await box(cancel);
    const confirmBox = await box(confirm);
    expect(Math.abs(cancelBox.y - confirmBox.y), '같은 행').toBeLessThanOrEqual(2);
    const gap = confirmBox.x - (cancelBox.x + cancelBox.width);
    expect(gap, `가로 간격 ${gap}px`).toBeGreaterThanOrEqual(8);

    await cancel.click();
    await expect(dialog).toBeHidden();
    await expect(previewCard(page)).toHaveCount(0);
    const main = quickRequestMain(page);
    await expect(main.getByTestId('quick-request-origin-road-address')).toHaveValue('서울 중구 세종대로 110');
    await expect(main.getByTestId('quick-request-origin-contact-phone')).toHaveValue(/1111/);
    await expect(main.getByTestId('quick-request-stopover-0-road-address')).toHaveValue(STOPOVER_ROAD);

    await clickDesktopRegister(page);
    const { requestBody } = await confirmPreviewAndRegister(page);
    expect((requestBody.origin as { contactName?: string }).contactName).toBe('E2E 출발');
    expect((requestBody.stopovers as unknown[]).length).toBe(1);
    await expect(page.getByTestId('quick-detail-status')).toHaveText('신규요청');
  });

  test('AC-04: 크기 「기타」 + 물품 「철판 2m」 → 칩 「기타」 · item-description 행 = 철판 2m', async ({ page }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    await fillQuickRequestOrder(page, { goodsSize: 'other', item: '철판 2m' });
    await openPreview(page, 'desktop');
    await expect(previewChips(page).getByText('기타', { exact: true })).toHaveCount(1);
    const row = previewItemDescription(page);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('물품 내용');
    await expect(row).toContainText('철판 2m');
  });

  test('AC-04: 크기 「소형」 → 칩 「소형」 · item-description 행 0건', async ({ page }) => {
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    await fillQuickRequestOrder(page, { goodsSize: 's' });
    await openPreview(page, 'desktop');
    await expect(previewChips(page).getByText('소형', { exact: true })).toHaveCount(1);
    await expect(previewItemDescription(page)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// B. grep (AC-05) — Node fs로 소스 판정 (verifier CLI grep과 같은 기준)
// ---------------------------------------------------------------------------
test.describe('plan 96 B. grep (AC-05)', () => {
  const PREVIEW_DIALOG = 'src/features/quick-request/components/quick-request-preview-dialog.tsx';
  const NEW_OR_CHANGED = [
    PREVIEW_DIALOG,
    'src/features/quick-request/components/quick-request-preview-card.tsx',
    'src/features/quick-request/components/chat/quick-chat-message-list.tsx'
  ];
  // 이 spec 자신이 grep에 걸리지 않도록 문자열을 나눠 조립한다
  const TEXT_FN = ['formatQuickRequest', 'PreviewText'].join('');
  const TEXT_MODULE = ['format-quick-request', '-message'].join('');

  test('AC-05: 옛 미리보기 텍스트 포맷터(92 D-9)·lib 모듈 src/e2e 0건', () => {
    for (const needle of [TEXT_FN, TEXT_MODULE]) {
      const hits = [...grepDir('src', needle), ...grepDir('e2e', needle)];
      expect(hits, `${needle} 사용처`).toEqual([]);
    }
  });

  test('AC-05: preview-dialog `<pre` 0건 · 신규/수정 파일 #hex·rounded-[·shadow-[·bg-white 0건', () => {
    expect(readSource(PREVIEW_DIALOG).includes('<pre'), 'preview-dialog <pre').toBe(false);
    for (const file of NEW_OR_CHANGED) {
      const source = readSource(file);
      const lines = source.split(/\r?\n/);
      const offenders = lines
        .map((line, index) => ({ line, no: index + 1 }))
        .filter(
          ({ line }) =>
            /#[0-9a-fA-F]{3,8}\b/.test(line) || line.includes('rounded-[') || line.includes('shadow-[') || /\bbg-white\b/.test(line)
        )
        .map(({ line, no }) => `${file}:${no}: ${line.trim()}`);
      expect(offenders, `${file} 86 AC-20 금지 토큰`).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// C. 테마 20조합 스모크 (AC-06)
// ---------------------------------------------------------------------------
test.describe('plan 96 C. 테마 스모크 (AC-06)', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-06: THEMES import (중복 없음)', () => {
    expect(THEMES.length).toBeGreaterThan(0);
    expect(new Set(THEMES.map((t) => t.value)).size).toBe(THEMES.length);
  });

  for (const { value: theme } of THEMES) {
    for (const mode of MODES) {
      test(`AC-06: ${theme} × ${mode} · 1280 미리보기 Dialog 표시 · scrollWidth <= clientWidth`, async ({ page, baseURL }) => {
        await applyThemeBeforeNavigation(page, baseURL!, theme, mode);
        await gotoQuickRequest(page, VIEWPORT_DESKTOP);
        await expectThemeApplied(page, theme, mode);
        await fillQuickRequestOrder(page);
        const dialog = await openPreview(page, 'desktop');
        await expect(page.getByTestId('quick-request-preview-origin')).toBeVisible();
        await expect(page.getByTestId('quick-request-preview-destination')).toBeVisible();
        await expect(previewChips(page)).toBeVisible();
        await expectNoHorizontalScroll(page);
        const overflow = await dialog.evaluate((node) => node.scrollWidth - node.clientWidth);
        expect(overflow, 'Dialog 가로 넘침').toBeLessThanOrEqual(0);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// D. 채팅 말풍선 하단 정렬 (AC-07 ~ AC-10)
// ---------------------------------------------------------------------------
test.describe('plan 96 D. 채팅 말풍선 하단 정렬', () => {
  // serial 아님 — AC-07(plan 원문 72px) 실패가 AC-08~10 판정을 막지 않도록 (project 자체가 workers 1 직렬)
  test.describe.configure({ timeout: 150_000 });
  test.use({ storageState: 'e2e/.auth/user.json' });

  /** plan AC-07 (r1) — 마지막 말풍선 bottom vs 스크롤 컨테이너(`quick-chat-messages`) bottom ≤ 16px (`py-3` 12px). 입력창 기준 픽셀 임계는 r1에서 폐기 */
  const BOTTOM_ALIGN_MAX_GAP_PX = 16;

  type Align = {
    bubbleBottom: number;
    stackBottom: number;
    containerTop: number;
    containerBottom: number;
    containerHeight: number;
    inputTop: number;
    gapToInput: number;
    gapToContainer: number;
  };

  /** AC-07 보고용 — 말풍선 bottom ↔ 입력창 top 사이 구성(컨테이너 py-3 · 「입력 중…」 h-5 · composer 패딩 · 빠른 답장 칩 줄) */
  async function describeGap(page: Page, label: string, align: Align) {
    const heightOf = async (testId: string) => {
      const locator = page.getByTestId(testId);
      if ((await locator.count()) === 0) return null;
      const b = await locator.boundingBox();
      return b ? { y: Math.round(b.y), h: Math.round(b.height) } : null;
    };
    const parts = {
      bubbleBottom: Math.round(align.bubbleBottom),
      containerBottom: Math.round(align.containerBottom),
      typing: await heightOf('quick-chat-typing'),
      composer: await heightOf('quick-chat-composer'),
      quickReplies: await heightOf('quick-chat-quick-replies'),
      inputTop: Math.round(align.inputTop),
      gapToInput: Math.round(align.gapToInput)
    };
    const line = `[plan96 AC-07 ${label}] ${JSON.stringify(parts)}`;
    console.log(line);
    test.info().annotations.push({ type: 'measure', description: line });
  }

  async function measureAlign(page: Page, lastMessageId: number): Promise<Align> {
    const bubble = messageBubble(page, lastMessageId);
    await expect(bubble).toBeVisible({ timeout: 20_000 });
    const bubbleBox = await box(bubble);
    const stackBox = await box(page.getByTestId('quick-chat-messages-stack'));
    const containerBox = await box(messagesLog(page));
    const inputBox = await box(page.getByTestId('quick-chat-input'));
    const bubbleBottom = bubbleBox.y + bubbleBox.height;
    return {
      bubbleBottom,
      stackBottom: stackBox.y + stackBox.height,
      containerTop: containerBox.y,
      containerBottom: containerBox.y + containerBox.height,
      containerHeight: containerBox.height,
      inputTop: inputBox.y,
      gapToInput: inputBox.y - bubbleBottom,
      gapToContainer: containerBox.y + containerBox.height - bubbleBottom
    };
  }

  function expectBottomAligned(align: Align, label: string) {
    expect(align.bubbleBottom, `${label}: 말풍선 bottom < 입력창 top`).toBeLessThan(align.inputTop);
    expect(Math.abs(align.stackBottom - align.bubbleBottom), `${label}: 말풍선 bottom = stack bottom`).toBeLessThanOrEqual(2);
    expect(align.gapToContainer, `${label}: 말풍선 bottom ↔ 컨테이너 bottom ${align.gapToContainer}px`).toBeLessThanOrEqual(
      BOTTOM_ALIGN_MAX_GAP_PX
    );
    expect(align.gapToContainer, `${label}: 컨테이너 안쪽`).toBeGreaterThanOrEqual(0);
  }

  let oneNo = '';
  let oneId = 0;

  test.beforeAll(async () => {
    oneNo = (await createAs('user', uniqueTag('E2E96ONE'))).requestNo;
    oneId = (await sendMessageAs('user', oneNo, '2시로 변경 가능할까요?')).id;
  });

  test('AC-07 (r1): 메시지 1개 · 상세 「요청 대화」(1280) — 말풍선 bottom ↔ 컨테이너 bottom ≤ 16px · 입력창 top 미만 · 상단 빈 공간 · stack bottom = 말풍선 bottom', async ({
    page
  }) => {
    await page.setViewportSize(VIEWPORT_DESKTOP);
    await gotoDetailChat(page, oneNo);
    const align = await measureAlign(page, oneId);
    await describeGap(page, '상세 1280', align);
    expectBottomAligned(align, '상세');
    // 상단 빈 공간: 말풍선이 컨테이너 아래 절반에 있다
    const bubbleBox = await box(messageBubble(page, oneId));
    expect(bubbleBox.y - align.containerTop, '목록 상단 빈 공간').toBeGreaterThan(align.containerHeight / 2);
  });

  test('AC-07 (r1): 메시지 1개 · 「퀵 대화」(1280) — 말풍선 bottom ↔ 컨테이너 bottom ≤ 16px · 입력창 top 미만 · 상단 빈 공간 · stack bottom = 말풍선 bottom', async ({
    page
  }) => {
    await page.setViewportSize(VIEWPORT_DESKTOP);
    await gotoChat(page, oneNo);
    const align = await measureAlign(page, oneId);
    await describeGap(page, '퀵 대화 1280', align);
    expectBottomAligned(align, '퀵 대화');
    const bubbleBox = await box(messageBubble(page, oneId));
    expect(bubbleBox.y - align.containerTop, '목록 상단 빈 공간').toBeGreaterThan(align.containerHeight / 2);
  });

  test('AC-08: 메시지 40개 — 열면 스크롤 맨 아래 · 마지막 말풍선이 입력창 바로 위 · 위로 스크롤 후 수신 → 「새 메시지 1 ↓」 · 「여기부터 새 메시지」 위치 유지', async ({
    page
  }) => {
    const manyNo = (await createAs('user', uniqueTag('E2E96MANY'))).requestNo;
    const row = await dbQuickRequest(manyNo);
    const me = await fixtureUser('user');
    const dongbang = readAccountMeta('dongbang');
    const base = Date.now() - 60 * 60 * 1000;
    const rows = Array.from({ length: 40 }, (_, index) => {
      const mine = index < 38;
      return {
        authorUserId: mine ? me.userId : dongbang.userId,
        authorName: mine ? me.fullName : dongbang.fullName,
        authorRole: (mine ? 'requester' : 'dongbang') as 'requester' | 'dongbang',
        body: `E2E96 메시지 ${index + 1}`,
        createdAt: new Date(base + index * 60 * 1000).toISOString()
      };
    });
    const ids = await insertFixtureMessages(row.id, rows);
    expect(ids).toHaveLength(40);
    const lastId = ids[39];
    const firstUnreadId = ids[38];
    const lastReadId = ids[37];

    await page.setViewportSize(VIEWPORT_DESKTOP);
    await gotoChat(page, manyNo);
    await waitForSubscribed(page);
    const log = messagesLog(page);
    await expect(messageBubble(page, lastId)).toBeVisible({ timeout: 20_000 });

    // 열면 맨 아래 (unread divider가 끝 근처 → 스크롤 하한 clamp = 맨 아래)
    await expect
      .poll(() => log.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight), { message: '스크롤 맨 아래' })
      .toBeLessThanOrEqual(2);
    const stackOverflow = await log.evaluate((node) => node.scrollHeight - node.clientHeight);
    expect(stackOverflow, '40개는 컨테이너보다 길어 스크롤된다').toBeGreaterThan(0);
    const align = await measureAlign(page, lastId);
    await describeGap(page, '40개 퀵 대화 1280', align);
    expectBottomAligned(align, '40개');

    // 「여기부터 새 메시지」 — 마지막으로 읽은(38) 아래 · 첫 안 읽은(39) 위
    const divider = page.getByTestId('quick-chat-unread-divider');
    await expect(divider).toHaveCount(1);
    const dividerBox = await box(divider);
    const lastReadBox = await box(messageBubble(page, lastReadId));
    const firstUnreadBox = await box(messageBubble(page, firstUnreadId));
    expect(dividerBox.y, '구분선이 38번 아래').toBeGreaterThanOrEqual(lastReadBox.y + lastReadBox.height - 1);
    expect(dividerBox.y + dividerBox.height, '구분선이 39번 위').toBeLessThanOrEqual(firstUnreadBox.y + 1);

    // 위로 스크롤 → 새 메시지 수신 → 「새 메시지 1 ↓」 (자동 스크롤 안 함)
    await log.evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.waitForTimeout(SUBSCRIBE_SETTLE_MS);
    const incoming = await sendMessageAs('dongbang', manyNo, 'E2E96 새 메시지 수신');
    const newButton = page.getByTestId('quick-chat-new-messages');
    await expect(newButton).toHaveText('새 메시지 1 ↓', { timeout: REALTIME_TIMEOUT_MS + SUBSCRIBE_SETTLE_MS });
    const scrollTopAfter = await log.evaluate((node) => node.scrollTop);
    expect(scrollTopAfter, '수신 후에도 위쪽에 머문다').toBeLessThan(200);

    await newButton.click();
    await expect(newButton).toHaveCount(0, { timeout: 5_000 });
    await expect(messageBubble(page, incoming.id)).toBeVisible();
    await expect
      .poll(() => log.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight), { message: '버튼 클릭 → 맨 아래' })
      .toBeLessThanOrEqual(2);
    // 구분선 위치 유지 (읽음 갱신돼도 열어 둔 동안 그대로 · 93 C-13)
    const dividerAfter = await box(divider);
    const lastReadAfter = await box(messageBubble(page, lastReadId));
    const firstUnreadAfter = await box(messageBubble(page, firstUnreadId));
    expect(dividerAfter.y).toBeGreaterThanOrEqual(lastReadAfter.y + lastReadAfter.height - 1);
    expect(dividerAfter.y + dividerAfter.height).toBeLessThanOrEqual(firstUnreadAfter.y + 1);
  });

  test('AC-09: 메시지 0개 — 빈 상태 문구가 목록 영역 세로 가운데(중심 ±40px)', async ({ page }) => {
    const emptyNo = (await createAs('user', uniqueTag('E2E96EMPTY'))).requestNo;
    await page.setViewportSize(VIEWPORT_DESKTOP);
    await gotoChat(page, emptyNo);
    const empty = page.getByTestId('quick-chat-empty');
    await expect(empty).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('quick-chat-messages-stack')).toHaveCount(0);
    const emptyBox = await box(empty);
    const containerBox = await box(messagesLog(page));
    const emptyCenter = emptyBox.y + emptyBox.height / 2;
    const containerCenter = containerBox.y + containerBox.height / 2;
    expect(Math.abs(emptyCenter - containerCenter), `빈 상태 중심 ${emptyCenter} vs 컨테이너 중심 ${containerCenter}`).toBeLessThanOrEqual(40);
  });

  test('AC-10 (+AC-07 r1 375): 375 · 메시지 3개 — 상세 하단 「대화」 → 전체 뷰 · 말풍선 bottom ↔ 컨테이너 bottom ≤ 16px · 입력창 보임 · 가로 스크롤 없음', async ({
    browser
  }) => {
    const threeNo = (await createAs('user', uniqueTag('E2E96THREE'))).requestNo;
    const ids: number[] = [];
    for (const body of ['첫 번째 메시지', '두 번째 메시지', '세 번째 메시지']) {
      ids.push((await sendMessageAs('user', threeNo, body)).id);
    }
    const { context, page } = await pageAs(browser, 'user', { viewport: VIEWPORT_MOBILE });
    try {
      await hideNextDevOverlay(page);
      await page.goto(`/dashboard/quick/${threeNo}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('quick-detail')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('quick-detail-chat-button').click();
      await expect(page).toHaveURL(/chat=1/);
      const full = page.getByTestId('quick-detail-chat');
      await expect(full).toHaveAttribute('data-mode', 'full');

      const align = await measureAlign(page, ids[2]);
      await describeGap(page, '375 상세 전체 뷰', align);
      expectBottomAligned(align, '375 전체 뷰');
      const input = page.getByTestId('quick-chat-input');
      await expect(input).toBeInViewport();
      const inputBox = await box(input);
      const viewportHeight = page.viewportSize()!.height;
      expect(inputBox.y + inputBox.height, '키보드 없이 입력창이 화면 안').toBeLessThanOrEqual(viewportHeight + 1);
      await expectNoHorizontalScroll(page);
      const overflow = await full.evaluate((node) => node.scrollWidth - node.clientWidth);
      expect(overflow, '전체 뷰 가로 넘침').toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });
});
