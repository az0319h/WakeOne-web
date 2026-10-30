import { expect, test } from '@playwright/test';
import {
  clickDesktopRegister,
  confirmPreviewAndRegister,
  desktopSummary,
  expectedAbsoluteDatetimeFromLocalInput,
  fetchUserProfileFromDashboard,
  fillLocationByPrefix,
  fillQuickRequestOrder,
  gotoQuickRequest,
  ORIGIN_PHONE,
  previewCard,
  previewChips,
  previewDialog,
  previewItemDescription,
  previewStopovers,
  quickRequestMain,
  quickRequestOrderPage,
  resetNotesToSeed,
  SEED_NOTE_LABEL,
  goodsSizeGroup,
  itemDescriptionField,
  selectGoodsSize,
  vehicleCard
} from './helpers';
import { hideDevOverlays } from '../helpers/dev-overlay';

// plan 106 verifier — dev 전용 오버레이(Next 표시기·TanStack Devtools 로고)가 하단 고정 버튼을 가로채지 않게 숨긴다(운영엔 없음)
test.beforeEach(async ({ page }) => {
  await hideDevOverlays(page);
});

// plan 86 — docs/plans/86_quick-request-kakao-redesign-plan.md (1280 데스크톱 단일 화면)
test.describe('퀵 배송 요청 단일 화면 · 데스크톱 1280 (plan 86)', () => {
  test.use({
    storageState: 'e2e/.auth/user.json',
    permissions: ['clipboard-read', 'clipboard-write']
  });
  test.describe.configure({ timeout: 90_000 });

  test('AC-06: 폼 + 요약 동시 노출 · wizard testid 0건 · 출발 담당/연락 프로필 기본값', async ({
    page
  }) => {
    const profile = await fetchUserProfileFromDashboard(page);
    await gotoQuickRequest(page);

    const orderPage = quickRequestOrderPage(page);
    await expect(orderPage.getByRole('heading', { name: '주소 정보' })).toBeVisible();
    await expect(orderPage.getByTestId('quick-request-origin-road-address')).toBeVisible();
    await expect(orderPage.getByTestId('quick-request-summary')).toBeVisible();
    await expect(orderPage.getByTestId('quick-request-register-button')).toBeVisible();
    await expect(orderPage.getByTestId('quick-request-mobile-bar')).toBeHidden();

    await expect(page.getByTestId('quick-request-step-indicator')).toHaveCount(0);
    await expect(page.getByTestId('quick-request-next-button')).toHaveCount(0);

    const main = quickRequestMain(page);
    await expect(main.getByTestId('quick-request-origin-contact-name')).toHaveValue(
      profile.fullName
    );
    const phoneInput = main.getByTestId('quick-request-origin-contact-phone');
    const phoneValue = await phoneInput.inputValue();
    if (profile.phone) {
      expect(phoneValue.replace(/\D/g, '')).toBe(profile.phone);
    } else {
      expect(phoneValue).toBe('');
    }
  });

  // plan 87 r1 supersede — 물품 내용 필수는 「기타」 선택 시에만
  test('AC-07: (87 r1) 기타 + 물품 비움 → 한국어 에러 · Dialog 미오픈', async ({ page }) => {
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, { goodsSize: 'other', item: '' });
    await clickDesktopRegister(page);
    await expect(quickRequestMain(page).getByText('물품 내용을 입력해 주세요.')).toBeVisible();
    await expect(previewCard(page)).toHaveCount(0);
  });

  // plan 96 — `<pre>` 텍스트 판정 → 칩 줄(`formatVehicleTypes` 형식 `5톤, 오토바이, 기타(특수 윙바디) × 1대`)
  test('AC-08: 5톤 + 오토바이 + 기타 · 기타 비움 차단 → 입력 후 Dialog 반영', async ({ page }) => {
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, { vehicles: ['5톤', '오토바이', '기타'] });
    await clickDesktopRegister(page);
    await expect(quickRequestMain(page).getByText('기타 차량을 입력해 주세요.')).toBeVisible();
    await expect(previewCard(page)).toHaveCount(0);

    await quickRequestMain(page).getByTestId('quick-request-vehicle-other').fill('특수 윙바디');
    await clickDesktopRegister(page);
    await expect(previewCard(page)).toBeVisible();
    const chips = previewChips(page);
    await expect(chips).toContainText('5톤, 오토바이, 기타(특수 윙바디) × 1대');
  });

  test('AC-09: 차량 카드 img alt=차량명 · 2.5톤/5톤 톤수 · 기타 아이콘(이미지 없음)', async ({
    page
  }) => {
    await gotoQuickRequest(page);
    const main = quickRequestMain(page);
    const withImage = [
      '오토바이',
      '다마스',
      '라보',
      '1톤 탑차(윙바디)',
      '1톤 오픈형',
      '1톤 냉장(냉동)',
      '2.5톤',
      '5톤'
    ];
    for (const type of withImage) {
      const card = vehicleCard(page, type);
      await expect(card).toBeVisible();
      await expect(card.getByRole('img', { name: type, exact: true })).toHaveCount(1);
    }
    await expect(main.getByRole('img', { name: '5톤', exact: true })).toHaveCount(1);
    await expect(vehicleCard(page, '2.5톤')).toContainText('2.5톤');
    await expect(vehicleCard(page, '5톤')).toContainText('5톤');

    const other = vehicleCard(page, '기타');
    await expect(other).toBeVisible();
    await expect(other.getByRole('img')).toHaveCount(0);
    await expect(main.getByRole('button', { name: '기타', exact: true })).toBeVisible();
  });

  test('AC-10: 대수 3대 → 요약·Dialog 3대', async ({ page }) => {
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, { count: { preset: 3 } });
    await expect(desktopSummary(page)).toContainText('3대');
    await clickDesktopRegister(page);
    await expect(previewChips(page)).toContainText('× 3대');
  });

  test('AC-10: 대수 직접 7 → 요약·Dialog 7대', async ({ page }) => {
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, { count: { custom: 7 } });
    await expect(desktopSummary(page)).toContainText('7대');
    await clickDesktopRegister(page);
    await expect(previewChips(page)).toContainText('× 7대');
  });

  test('AC-11: 경유 3회 추가 → remove-1 → 2블록 · 상한 없음 · 요약/Dialog 순서 반영', async ({
    page
  }) => {
    await gotoQuickRequest(page);
    const main = quickRequestMain(page);
    const addStopover = main.getByTestId('quick-request-add-stopover');
    for (let i = 0; i < 3; i++) {
      await addStopover.click();
    }
    await expect(addStopover).toBeEnabled();
    await expect(main.getByTestId('quick-request-stopover-remove-2')).toBeVisible();

    const stops = ['경유 A 테스트로 1', '경유 B 테스트로 2', '경유 C 테스트로 3'];
    for (const [index, road] of stops.entries()) {
      await fillLocationByPrefix(page, `quick-request-stopover-${index}`, {
        road,
        detail: `${index + 1}층`,
        name: `E2E 경유${index + 1}`,
        phone: ORIGIN_PHONE
      });
    }

    await main.getByTestId('quick-request-stopover-remove-1').click();
    await expect(main.getByTestId('quick-request-stopover-remove-0')).toBeVisible();
    await expect(main.getByTestId('quick-request-stopover-remove-1')).toBeVisible();
    await expect(main.getByTestId('quick-request-stopover-remove-2')).toHaveCount(0);
    await expect(addStopover).toBeEnabled();
    await expect(main.getByTestId('quick-request-stopover-0-road-address')).toHaveValue(stops[0]);
    await expect(main.getByTestId('quick-request-stopover-1-road-address')).toHaveValue(stops[2]);

    const summaryText = await desktopSummary(page).innerText();
    expect(summaryText).not.toContain(stops[1]);
    expect(summaryText.indexOf(stops[0])).toBeGreaterThan(-1);
    expect(summaryText.indexOf(stops[2])).toBeGreaterThan(summaryText.indexOf(stops[0]));

    await fillQuickRequestOrder(page);
    await clickDesktopRegister(page);
    // plan 96 — 경유 순서는 `quick-request-preview-stopovers`의 「경유 N」 행으로 판정
    const stopovers = previewStopovers(page);
    await expect(stopovers).toBeVisible();
    const rows = stopovers.getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('경유 1');
    await expect(rows.nth(0)).toContainText(stops[0]);
    await expect(rows.nth(1)).toContainText('경유 2');
    await expect(rows.nth(1)).toContainText(stops[2]);
    await expect(stopovers).not.toContainText(stops[1]);
  });

  // plan 87 supersede — 칩은 사용자별 DB seed 「동승 필요」 (group + role 셀렉터)
  // mobile-ux #1 (2026-10-21) — 요약의 고정 「💳 결제: 월정산」 줄 제거 → 착불이면 요약에 월정산 없음
  test('AC-12: 픽업 예약 절대시각 · 최대한 빠르게 · 특이 칩 · 착불 요약', async ({ page }) => {
    // plan 106 D-11 — 고정 날짜는 지나면 등록 날짜 검사와 충돌 → 「지금 + 1일」 14:30 (KST 로컬 값)
    const tomorrow = new Date(Date.now() + 9 * 3_600_000 + 24 * 3_600_000).toISOString().slice(0, 10);
    const local = `${tomorrow}T14:30`;
    const note = SEED_NOTE_LABEL;
    await resetNotesToSeed(page.request);
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, {
      pickupDatetime: local,
      originNotes: [note],
      freight: 'collect'
    });
    const summary = desktopSummary(page);
    await expect(summary).toContainText(expectedAbsoluteDatetimeFromLocalInput(local));
    await expect(summary).toContainText('최대한 빠르게');
    await expect(summary).toContainText(note);
    await expect(summary).toContainText('착불');
    await expect(summary).not.toContainText('월정산');
  });

  // plan 89 AC-08이 86 AC-13(501·복사·reset)을 대체 — 등록 → DB 저장 → 상세 이동
  test('AC-13: (89 AC-08 대체) 등록 → 「등록」 → 201 · 토스트 · 상세 이동 · 신규요청', async ({ page }) => {
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page);
    await expect(quickRequestMain(page).getByTestId('quick-request-origin-contact-name')).toHaveValue(
      'E2E 출발'
    );
    await clickDesktopRegister(page);
    await expect(previewDialog(page)).toBeVisible();
    const { requestBody } = await confirmPreviewAndRegister(page);
    expect((requestBody.origin as { contactName?: string }).contactName).toBe('E2E 출발');
    await expect(page.getByTestId('quick-detail-status')).toHaveText('신규요청');
  });
});

// plan 87 — docs/plans/87_quick-request-goods-notes-address-picker-plan.md (물품 크기 · 확인 흐름 · shadcn)
test.describe('퀵 배송 요청 물품 크기 · 확인 흐름 (plan 87)', () => {
  test.use({
    storageState: 'e2e/.auth/user.json',
    permissions: ['clipboard-read', 'clipboard-write']
  });
  test.describe.configure({ timeout: 90_000 });

  test('AC-01: radiogroup 물품 크기 — radio 4개 · 초소형/소형/중형 img alt · 대형 0건', async ({
    page
  }) => {
    await gotoQuickRequest(page);
    const group = goodsSizeGroup(page);
    await expect(group).toBeVisible();
    await expect(group.getByRole('radio')).toHaveCount(4);
    for (const name of ['초소형', '소형', '중형', '기타']) {
      await expect(group.getByRole('radio', { name, exact: true })).toHaveCount(1);
    }
    for (const name of ['초소형', '소형', '중형']) {
      await expect(group.getByRole('img', { name, exact: true })).toHaveCount(1);
    }
    await expect(group.getByRole('img', { name: '기타', exact: true })).toHaveCount(0);
    await expect(quickRequestMain(page).getByText('대형', { exact: true })).toHaveCount(0);
    await expect(quickRequestMain(page).getByRole('radio', { name: '대형' })).toHaveCount(0);
    // r1 — 크기 미선택: 물품 내용 미노출 · 「물품 크기 (기타)」 입력칸 0건
    await expect(itemDescriptionField(page)).toBeHidden();
    await expect(page.getByTestId('quick-request-goods-size-other-input')).toHaveCount(0);
  });

  test('AC-02: 크기 미선택 → 「물품 크기를 선택해 주세요.」 · 미리보기 미노출', async ({ page }) => {
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, { goodsSize: null });
    await clickDesktopRegister(page);
    await expect(quickRequestMain(page).getByText('물품 크기를 선택해 주세요.')).toBeVisible();
    await expect(previewCard(page)).toHaveCount(0);
  });

  // plan 96 AC-04 대체 — 「크기: 기타」·「물품:」 줄 판정 → 칩 「기타」 + `quick-request-preview-item-description`
  test('AC-03: (r1) 기타 → 물품 내용 노출 · 비움 에러 → 「철판 2m」 미리보기 칩 「기타」 + 물품 내용 행 · 요약', async ({
    page
  }) => {
    await gotoQuickRequest(page);
    await expect(itemDescriptionField(page)).toBeHidden();
    await fillQuickRequestOrder(page, { goodsSize: 'other', item: '' });
    await expect(itemDescriptionField(page)).toBeVisible();
    await clickDesktopRegister(page);
    await expect(quickRequestMain(page).getByText('물품 내용을 입력해 주세요.')).toBeVisible();
    await expect(previewCard(page)).toHaveCount(0);

    await itemDescriptionField(page).fill('철판 2m');
    const summary = desktopSummary(page);
    await expect(summary.getByText('물품 크기', { exact: true })).toBeVisible();
    await expect(summary.getByText('기타', { exact: true })).toBeVisible();
    await expect(summary.getByText('물품', { exact: true })).toBeVisible();
    await expect(summary.getByText('철판 2m', { exact: true })).toBeVisible();

    await clickDesktopRegister(page);
    await expect(previewCard(page)).toBeVisible();
    await expect(previewChips(page).getByText('기타', { exact: true })).toHaveCount(1);
    await expect(previewItemDescription(page)).toContainText('물품 내용');
    await expect(previewItemDescription(page)).toContainText('철판 2m');
  });

  test('AC-04: (r1) 소형 → 물품 내용 미노출·검증 없음 · 미리보기 칩 「소형」 · 물품 내용 행 0건', async ({
    page
  }) => {
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, { goodsSize: 's' });
    await expect(itemDescriptionField(page)).toBeHidden();

    const summary = desktopSummary(page);
    await expect(summary.getByText('물품 크기', { exact: true })).toBeVisible();
    await expect(summary.getByText('소형', { exact: true })).toBeVisible();
    await expect(summary.getByText('물품', { exact: true })).toHaveCount(0);

    await clickDesktopRegister(page);
    await expect(quickRequestMain(page).getByText('물품 내용을 입력해 주세요.')).toHaveCount(0);
    await expect(previewCard(page)).toBeVisible();
    await expect(previewChips(page).getByText('소형', { exact: true })).toHaveCount(1);
    await expect(previewItemDescription(page)).toHaveCount(0);
    // Dialog 열림 중 main은 aria-hidden — 요약은 page 기준 testid
    await expect(page.getByTestId('quick-request-summary').getByText('물품', { exact: true })).toHaveCount(0);
  });

  test('AC-04: (r1) 기타에서 「철판 2m」 입력 → 소형 변경 후 등록 → 물품 줄 0건(값 미전송)', async ({
    page
  }) => {
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, { goodsSize: 'other', item: '철판 2m' });
    await selectGoodsSize(page, 's');
    await expect(itemDescriptionField(page)).toBeHidden();
    await expect(desktopSummary(page).getByText('철판 2m')).toHaveCount(0);

    await clickDesktopRegister(page);
    const preview = previewCard(page);
    await expect(preview).toBeVisible();
    await expect(previewChips(page).getByText('소형', { exact: true })).toHaveCount(1);
    await expect(previewItemDescription(page)).toHaveCount(0);
    await expect(preview).not.toContainText('철판 2m');

    // plan 89 — notify 대신 POST /api/quick-request (등록)
    const { requestBody } = await confirmPreviewAndRegister(page);
    expect(requestBody.goodsSize).toBe('s');
    expect(requestBody.itemDescription).toBe('');
  });

  // plan 89 AC-08·AC-15·D-12가 87 AC-22(501·복사·reset·FE 최근 주소 병렬 기록)를 대체
  test('AC-22: (89 대체) 등록 → 상세 이동 · FE recent-addresses POST 0건(서버 기록) · 기타 물품 전송', async ({
    page
  }) => {
    const recentPosts: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/quick-request/recent-addresses') && req.method() === 'POST') {
        recentPosts.push(req.url());
      }
    });
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, { goodsSize: 'other', item: 'E2E 기타 물품' });
    await clickDesktopRegister(page);
    const { requestBody } = await confirmPreviewAndRegister(page);
    expect(requestBody.goodsSize).toBe('other');
    expect(requestBody.itemDescription).toBe('E2E 기타 물품');
    expect(recentPosts).toEqual([]);
  });

  test('AC-22: (89 대체) recent-addresses POST가 500이어도 등록 흐름 무관 — FE 호출 0건', async ({ page }) => {
    let recentPostHits = 0;
    await page.route('**/api/quick-request/recent-addresses', async (route) => {
      if (route.request().method() === 'POST') {
        recentPostHits += 1;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: '처리 중 오류가 발생했습니다.' })
        });
        return;
      }
      await route.continue();
    });
    await gotoQuickRequest(page);
    await fillQuickRequestOrder(page, { goodsSize: 'other', item: 'E2E 기타 물품' });
    await clickDesktopRegister(page);
    await confirmPreviewAndRegister(page);
    await expect(
      page.getByText('최근 이용 내역을 저장하지 못했습니다.', { exact: true })
    ).toHaveCount(0);
    expect(recentPostHits).toBe(0);
  });

  test('AC-24: 차량 img alt · 일정 radio 이름 · 운임 testid 유지 (shadcn 교체 후)', async ({
    page
  }) => {
    await gotoQuickRequest(page);
    const main = quickRequestMain(page);
    for (const type of ['오토바이', '다마스', '5톤']) {
      await expect(vehicleCard(page, type).getByRole('img', { name: type, exact: true })).toHaveCount(1);
    }
    await expect(vehicleCard(page, '오토바이')).toHaveAttribute('aria-pressed', /true|false/);
    await expect(main.getByRole('radio', { name: '즉시 요청' })).toHaveCount(1);
    await expect(main.getByRole('radio', { name: '날짜/시간 선택' })).toHaveCount(2);
    await expect(main.getByRole('radio', { name: '최대한 빠르게' })).toHaveCount(1);
    await expect(main.getByTestId('quick-request-freight-monthly')).toBeVisible();
    await expect(main.getByTestId('quick-request-freight-collect')).toBeVisible();
    await selectGoodsSize(page, 'm');
  });
});
