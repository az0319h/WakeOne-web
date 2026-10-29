import { expect, test, type APIRequestContext } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  createActiveTestUser,
  createGuestRequestWithPassword,
  signInWithSupabasePassword
} from '../helpers/supabase-direct-auth';
import { expectActivityLogRow, requestIdOf } from '../quick-request/activity-log';
import {
  addressPickerDialog,
  gotoQuickRequest,
  openAddressPicker,
  quickRequestMain,
  VIEWPORT_DESKTOP,
  type RecentAddressDto
} from '../quick-request/helpers';
import { buildCreateBody, createQuickRequestApi, serviceClient, uniqueTag, withApi } from '../quick-workflow/helpers';
import { RANGE_TEXT } from './helpers';

/**
 * plan 97 §B 최근 주소 출발/도착 분리 · 상한 없음 · 커서 10개 (AC-12 ~ AC-16) + §D AC-24
 * docs/plans/97_quick-period-filter-recent-address-split-phone-plan.md
 * - user.json(요청자) 기본 · AC-14는 최근 주소 0건인 일회용 계정(example.com · `E2E ` 이름 → teardown 삭제)
 * - 담당자 이름 `E2E…` 표식 → scripts/cleanup-e2e-mock-data.mjs가 fixture 계정 최근 주소를 지운다
 */
const RECENT_PATH = '/api/quick-request/recent-addresses';

type Direction = 'origin' | 'destination';

type RecentPage = { addresses: (RecentAddressDto & { id: number; direction: Direction })[]; nextCursor: string | null };

async function recentPage(api: APIRequestContext, direction: string, cursor?: string | null, limit?: number) {
  const params = new URLSearchParams({ direction });
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const response = await api.get(`${RECENT_PATH}?${params.toString()}`);
  return { status: response.status(), body: (await response.json()) as { success?: boolean; message?: string; data?: RecentPage } };
}

/** 모든 페이지를 모아 돌려준다 (상한 없음 확인용) */
async function recentAll(api: APIRequestContext, direction: Direction) {
  const rows: RecentPage['addresses'] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 20; guard += 1) {
    const page = await recentPage(api, direction, cursor, 50);
    expect(page.status).toBe(200);
    rows.push(...page.body.data!.addresses);
    cursor = page.body.data!.nextCursor;
    if (!cursor) break;
  }
  return rows;
}

function location(direction: Direction, road: string, index: number) {
  return {
    direction,
    roadAddress: road,
    detailAddress: `${index}층`,
    contactName: `E2E 최근97 ${index}`,
    contactPhone: '01011112222'
  };
}

test.describe('plan 97 B. 최근 주소 출발/도착 분리 · 무한스크롤', () => {
  test.describe.configure({ timeout: 150_000 });
  test.use({ storageState: 'e2e/.auth/user.json' });

  /** AC-12·13 공용 — 출발 A · 경유 B · 도착 C */
  const trip = { tag: '', A: '', B: '', C: '', phoneA: '0212345678', phoneC: '0311234567' };

  test('AC-12: 출발 A·경유 B·도착 C 등록 → GET direction=origin = [A …] · destination = [C, B …] · A는 destination에 없음', async ({
    request
  }) => {
    trip.tag = uniqueTag('E2E97RA');
    trip.A = `서울 강남구 E2E97출발로 ${trip.tag}`;
    trip.B = `서울 마포구 E2E97경유로 ${trip.tag}`;
    trip.C = `경기 성남시 E2E97도착로 ${trip.tag}`;
    const base = buildCreateBody(trip.tag);
    await withApi('user', (api) =>
      createQuickRequestApi(api, {
        ...base,
        origin: { ...base.origin, roadAddress: trip.A, detailAddress: 'A동 1층', contactName: 'E2E 출발담당', contactPhone: trip.phoneA },
        stopovers: [
          { ...base.destination, roadAddress: trip.B, detailAddress: 'B동 2층', contactName: 'E2E 경유담당', contactPhone: '01055550002' }
        ],
        destination: { ...base.destination, roadAddress: trip.C, detailAddress: 'C동 3층', contactName: 'E2E 도착담당', contactPhone: trip.phoneC }
      })
    );

    const origin = await recentPage(request, 'origin');
    expect(origin.status).toBe(200);
    expect(origin.body.data!.addresses[0].roadAddress).toBe(trip.A);
    expect(origin.body.data!.addresses[0].direction).toBe('origin');
    expect(origin.body.data!.addresses[0].id).toEqual(expect.any(Number));
    const originAll = await recentAll(request, 'origin');
    expect(originAll.map((row) => row.roadAddress)).not.toContain(trip.B);
    expect(originAll.map((row) => row.roadAddress)).not.toContain(trip.C);

    const destination = await recentPage(request, 'destination');
    expect(destination.status).toBe(200);
    expect(destination.body.data!.addresses.slice(0, 2).map((row) => row.roadAddress)).toEqual([trip.C, trip.B]);
    expect(destination.body.data!.addresses[0].contactPhone).toBe(trip.phoneC);
    const destinationAll = await recentAll(request, 'destination');
    expect(destinationAll.map((row) => row.roadAddress)).not.toContain(trip.A);
    const times = destinationAll.map((row) => new Date(row.lastUsedAt).getTime());
    for (let i = 1; i < times.length; i += 1) expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
  });

  test('AC-13: 요청 화면 picker — 출발 칸 「출발지에서 쓴 주소」 A만 · 경유 칸·도착 칸 「도착지·경유지에서 쓴 주소」 C·B · 행 클릭 → 4칸 채움 (87 AC-17 회귀)', async ({
    page
  }) => {
    expect(trip.A, 'AC-12 fixture').toBeTruthy();
    await gotoQuickRequest(page, VIEWPORT_DESKTOP);
    const main = quickRequestMain(page);

    // 출발 칸 → origin
    const originDialog = await openAddressPicker(page, 'quick-request-origin');
    await expect(page.getByTestId('quick-request-address-picker')).toHaveAttribute('data-recent-direction', 'origin');
    await originDialog.getByRole('tab', { name: '최근 이용 내역' }).click();
    await expect(originDialog.getByTestId('quick-request-recent-address-hint')).toHaveText(RANGE_TEXT.recentHintOrigin);
    const originRows = originDialog.getByRole('list', { name: '최근 이용 주소' }).getByRole('listitem');
    await expect(originRows.first()).toBeVisible({ timeout: 15_000 });
    await expect(originDialog.getByTestId('quick-request-recent-address-0')).toContainText(trip.A);
    await expect(originDialog.getByTestId('quick-request-recent-address-0')).toContainText('02-1234-5678');
    expect(await originRows.allInnerTexts()).not.toEqual(expect.arrayContaining([expect.stringContaining(trip.B)]));
    expect(await originRows.allInnerTexts()).not.toEqual(expect.arrayContaining([expect.stringContaining(trip.C)]));
    await originDialog.getByRole('button', { name: '닫기' }).click();
    await expect(originDialog).toBeHidden();

    // 경유 칸 → destination
    await main.getByTestId('quick-request-add-stopover').click();
    const stopoverDialog = await openAddressPicker(page, 'quick-request-stopover-0');
    await expect(page.getByTestId('quick-request-address-picker')).toHaveAttribute('data-recent-direction', 'destination');
    await stopoverDialog.getByRole('tab', { name: '최근 이용 내역' }).click();
    await expect(stopoverDialog.getByTestId('quick-request-recent-address-hint')).toHaveText(RANGE_TEXT.recentHintDestination);
    await expect(stopoverDialog.getByTestId('quick-request-recent-address-0')).toContainText(trip.C);
    await expect(stopoverDialog.getByTestId('quick-request-recent-address-1')).toContainText(trip.B);
    const stopoverRows = stopoverDialog.getByRole('list', { name: '최근 이용 주소' }).getByRole('listitem');
    expect(await stopoverRows.allInnerTexts()).not.toEqual(expect.arrayContaining([expect.stringContaining(trip.A)]));
    await stopoverDialog.getByRole('button', { name: '닫기' }).click();
    await expect(stopoverDialog).toBeHidden();

    // 도착 칸 → destination · 행 클릭 → 4칸
    const destDialog = await openAddressPicker(page, 'quick-request-destination');
    await expect(page.getByTestId('quick-request-address-picker')).toHaveAttribute('data-recent-direction', 'destination');
    await destDialog.getByRole('tab', { name: '최근 이용 내역' }).click();
    await expect(destDialog.getByTestId('quick-request-recent-address-hint')).toHaveText(RANGE_TEXT.recentHintDestination);
    const row0 = destDialog.getByTestId('quick-request-recent-address-0');
    await expect(row0).toContainText(trip.C);
    await expect(row0).toContainText('C동 3층');
    await expect(row0).toContainText('E2E 도착담당');
    await expect(row0).toContainText('031-123-4567');
    await expect(destDialog.getByTestId('quick-request-recent-address-1')).toContainText(trip.B);
    await row0.click();
    await expect(destDialog).toBeHidden();
    await expect(main.getByTestId('quick-request-destination-road-address')).toHaveValue(trip.C);
    await expect(main.getByTestId('quick-request-destination-detail-address')).toHaveValue('C동 3층');
    await expect(main.getByTestId('quick-request-destination-contact-name')).toHaveValue('E2E 도착담당');
    const phone = await main.getByTestId('quick-request-destination-contact-phone').inputValue();
    expect(phone.replace(/\D/g, '')).toBe(trip.phoneC);
  });

  test('AC-14: 일회용 계정 · 서로 다른 도착 주소 25개 → limit=10 커서 3회 10·10·5 · nextCursor null · picker 스크롤로 25행 · prune 없음(DB 25행)', async ({
    browser,
    playwright
  }) => {
    const fresh = await createActiveTestUser('quick-p97-ac14', { fullName: `E2E 최근주소25 ${Date.now()}` });
    const api = await createGuestRequestWithPassword(playwright, fresh.email, fresh.password);
    const runId = Date.now().toString(36);
    try {
      const locations = Array.from({ length: 25 }, (_, i) => location('destination', `E2E97 도착로 ${runId}-${i + 1}`, i + 1));
      const post = await api.post(RECENT_PATH, { data: { locations } });
      expect(post.status(), await post.text()).toBe(200);
      expect(((await post.json()) as { data: { count: number } }).data.count).toBe(25);

      const page1 = await recentPage(api, 'destination', null, 10);
      expect(page1.status).toBe(200);
      expect(page1.body.data!.addresses).toHaveLength(10);
      expect(page1.body.data!.nextCursor).toBeTruthy();
      const page2 = await recentPage(api, 'destination', page1.body.data!.nextCursor, 10);
      expect(page2.body.data!.addresses).toHaveLength(10);
      expect(page2.body.data!.nextCursor).toBeTruthy();
      const page3 = await recentPage(api, 'destination', page2.body.data!.nextCursor, 10);
      expect(page3.body.data!.addresses).toHaveLength(5);
      expect(page3.body.data!.nextCursor).toBeNull();
      const all = [...page1.body.data!.addresses, ...page2.body.data!.addresses, ...page3.body.data!.addresses];
      expect(new Set(all.map((row) => row.id)).size).toBe(25);
      expect(new Set(all.map((row) => row.roadAddress)).size).toBe(25);
      const times = all.map((row) => new Date(row.lastUsedAt).getTime());
      for (let i = 1; i < times.length; i += 1) expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
      // 기본 limit 10
      const defaultPage = await recentPage(api, 'destination');
      expect(defaultPage.body.data!.addresses).toHaveLength(10);
      // origin 목록은 비어 있다
      const origin = await recentPage(api, 'origin');
      expect(origin.body.data!.addresses).toHaveLength(0);
      expect(origin.body.data!.nextCursor).toBeNull();

      const { count, error } = await serviceClient()
        .from('quick_request_recent_addresses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', fresh.userId);
      if (error) throw new Error(error.message);
      expect(count, 'DB 25행 (prune 없음)').toBe(25);
    } finally {
      await api.dispose();
    }

    const { storageState } = await signInWithSupabasePassword(fresh.email, fresh.password);
    const context = await browser.newContext({ storageState, viewport: VIEWPORT_DESKTOP });
    const page = await context.newPage();
    try {
      await gotoQuickRequest(page, VIEWPORT_DESKTOP);
      // 출발 칸 → origin 빈 상태 보조문장
      const originDialog = await openAddressPicker(page, 'quick-request-origin');
      await originDialog.getByRole('tab', { name: '최근 이용 내역' }).click();
      await expect(originDialog.getByText('최근 이용 내역이 없습니다.', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(originDialog.getByText(RANGE_TEXT.recentEmptyOrigin, { exact: true })).toBeVisible();
      await originDialog.getByRole('button', { name: '닫기' }).click();
      await expect(originDialog).toBeHidden();

      const dialog = await openAddressPicker(page, 'quick-request-destination');
      await dialog.getByRole('tab', { name: '최근 이용 내역' }).click();
      const rows = dialog.getByRole('list', { name: '최근 이용 주소' }).getByRole('listitem');
      await expect(rows).toHaveCount(10, { timeout: 15_000 });
      const sentinel = dialog.getByTestId('quick-request-recent-address-sentinel');
      await expect(sentinel).toHaveAttribute('data-state', 'more');
      await expect(dialog.getByText(RANGE_TEXT.recentEnd)).toHaveCount(0);

      await dialog.getByTestId('quick-request-recent-address-load-more').scrollIntoViewIfNeeded();
      await expect(rows).toHaveCount(20, { timeout: 15_000 });
      await dialog.getByTestId('quick-request-recent-address-load-more').scrollIntoViewIfNeeded();
      await expect(rows).toHaveCount(25, { timeout: 15_000 });
      await expect(sentinel).toHaveAttribute('data-state', 'end', { timeout: 15_000 });
      await expect(sentinel).toHaveText(RANGE_TEXT.recentEnd);
      await expect(dialog.getByTestId('quick-request-recent-address-24')).toContainText(`E2E97 도착로 ${runId}-25`);
      await expect(dialog.getByTestId('quick-request-recent-address-0')).toContainText(`E2E97 도착로 ${runId}-1`);
      await expect(addressPickerDialog(page)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('AC-15: 같은 (direction, 도로명, 상세) 2회 → 1행 · last_used_at·담당자·연락처 최신값 · 다른 direction은 별도 행', async ({ request }) => {
    const runId = Date.now().toString(36);
    const road = `E2E97 중복로 ${runId}`;
    const first = location('destination', road, 1);
    expect((await request.post(RECENT_PATH, { data: { locations: [first] } })).status()).toBe(200);
    const firstRow = (await recentAll(request, 'destination')).find((row) => row.roadAddress === road)!;
    expect(firstRow).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = { ...first, contactName: 'E2E 최근97 갱신', contactPhone: '021234567' };
    expect((await request.post(RECENT_PATH, { data: { locations: [second] } })).status()).toBe(200);
    const destination = await recentAll(request, 'destination');
    const matched = destination.filter((row) => row.roadAddress === road && row.detailAddress === first.detailAddress);
    expect(matched).toHaveLength(1);
    expect(matched[0].id).toBe(firstRow.id);
    expect(matched[0].contactName).toBe('E2E 최근97 갱신');
    expect(matched[0].contactPhone).toBe('021234567');
    expect(new Date(matched[0].lastUsedAt).getTime()).toBeGreaterThan(new Date(firstRow.lastUsedAt).getTime());
    expect(destination[0].id, '갱신된 행이 맨 앞').toBe(firstRow.id);

    // 같은 주소를 origin으로 기록하면 별도 행 (direction unique)
    expect((await request.post(RECENT_PATH, { data: { locations: [{ ...first, direction: 'origin' }] } })).status()).toBe(200);
    const origin = await recentAll(request, 'origin');
    expect(origin.filter((row) => row.roadAddress === road)).toHaveLength(1);
    expect(origin.find((row) => row.roadAddress === road)!.id).not.toBe(firstRow.id);
  });

  test('AC-16: direction=zzz · 누락 · 잘못된 cursor → 400 「요청 형식이 올바르지 않습니다.」 · POST item direction 누락 400', async ({ request }) => {
    const zzz = await recentPage(request, 'zzz');
    expect(zzz.status).toBe(400);
    expect(zzz.body.message).toBe(RANGE_TEXT.invalidBody);

    const missing = await request.get(RECENT_PATH);
    expect(missing.status()).toBe(400);
    expect(((await missing.json()) as { message: string }).message).toBe(RANGE_TEXT.invalidBody);

    const badCursor = await recentPage(request, 'origin', 'not-a-cursor');
    expect(badCursor.status).toBe(400);
    expect(badCursor.body.message).toBe(RANGE_TEXT.invalidBody);

    const { direction: _omit, ...noDirection } = location('origin', `E2E97 무방향로 ${Date.now()}`, 1);
    void _omit;
    const post = await request.post(RECENT_PATH, { data: { locations: [noDirection] } });
    expect(post.status()).toBe(400);
    expect(((await post.json()) as { message: string }).message).toBe('필수 항목을 확인해 주세요.');
  });

  test('AC-24: POST 200/400 → x-request-id · quick_request.recent_address_record 로그 metadata는 count·error_code만 (주소·이름·전화 0)', async ({
    request,
    playwright
  }) => {
    const runId = Date.now().toString(36);
    const valid = location('destination', `E2E97 로그로 ${runId}`, 1);
    const ok = await request.post(RECENT_PATH, { data: { locations: [valid] } });
    expect(ok.status()).toBe(200);
    const okId = requestIdOf(ok);

    const bad = await request.post(RECENT_PATH, { data: { locations: [{ ...valid, contactPhone: '0101234' }] } });
    expect(bad.status()).toBe(400);
    const badId = requestIdOf(bad);

    const admin = await createAdminRequest(playwright);
    try {
      const okRow = await expectActivityLogRow(admin, 'quick_request.recent_address_record', okId, 200);
      const badRow = await expectActivityLogRow(admin, 'quick_request.recent_address_record', badId, 400);
      for (const row of [okRow, badRow]) {
        expect(row.target_type).toBe('quick_request_address');
        for (const key of Object.keys(row.metadata ?? {})) {
          expect(['count', 'error_code']).toContain(key);
        }
        const json = JSON.stringify(row);
        expect(json).not.toContain(valid.roadAddress);
        expect(json).not.toContain(valid.contactName);
        expect(json).not.toContain(valid.contactPhone);
        expect(json).not.toContain('destination');
      }
      expect(okRow.metadata?.count).toBe(1);
      expect(badRow.metadata?.error_code).toBeTruthy();
    } finally {
      await admin.dispose();
    }
  });

});
