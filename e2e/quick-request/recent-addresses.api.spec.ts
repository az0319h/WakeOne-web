import { expect, test, type APIRequestContext } from '@playwright/test';
import { createAdminRequest } from '../helpers/auth-request';
import {
  createActiveTestUser,
  createGuestRequestWithPassword
} from '../helpers/supabase-direct-auth';
import { expectActivityLogRow, requestIdOf } from './activity-log';
import { listAllRecentAddressesApi, listRecentAddressesApi } from './helpers';

// plan 87 — docs/plans/87_quick-request-goods-notes-address-picker-plan.md (최근 주소 API · AC-18~20)
// plan 97 — 출발/도착 분리(`direction` 필수) · 10개 상한 제거 · 커서 10개. 87 AC-18(10행 상한)은 97 AC-14·15(e2e/quick-round2/97-recent-address.spec.ts)로 교체
const RECENT_PATH = '/api/quick-request/recent-addresses';

type LocationBody = {
  direction: 'origin' | 'destination';
  roadAddress: string;
  detailAddress: string;
  contactName: string;
  contactPhone: string;
};

function location(index: number, runId: string): LocationBody {
  return {
    direction: 'destination',
    roadAddress: `E2E 테스트로 ${runId}-${index}`,
    detailAddress: `${index}층`,
    contactName: `E2E 최근 ${index}`,
    contactPhone: '01011112222'
  };
}

async function record(request: APIRequestContext, locations: LocationBody[]) {
  return request.post(RECENT_PATH, { data: { locations } });
}

test.describe('퀵 요청 최근 주소 API (plan 87)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test('AC-18 (97 교체): 같은 주소 2회 → 1행(맨 앞) · 서로 다른 11개 → 전부 남음(상한 없음 · 97 AC-14·15) · last_used_at desc', async ({
    request
  }) => {
    const runId = Date.now().toString(36);
    const same = { ...location(0, runId), contactName: 'E2E 최근 첫번째' };
    expect((await record(request, [same])).status()).toBe(200);
    const second = await record(request, [{ ...same, contactName: 'E2E 최근 갱신' }]);
    expect(second.status()).toBe(200);

    const afterDup = await listRecentAddressesApi(request, 'destination');
    const dupRows = afterDup.addresses.filter(
      (row) => row.roadAddress === same.roadAddress && row.detailAddress === same.detailAddress
    );
    expect(dupRows).toHaveLength(1);
    expect(afterDup.addresses[0].roadAddress).toBe(same.roadAddress);
    expect(afterDup.addresses[0].contactName).toBe('E2E 최근 갱신');

    for (let i = 1; i <= 11; i++) {
      const response = await record(request, [location(i, runId)]);
      expect(response.status()).toBe(200);
    }

    const all = await listAllRecentAddressesApi(request, 'destination');
    const mine = all.filter((row) => row.roadAddress.startsWith(`E2E 테스트로 ${runId}-`));
    expect(mine, '12행 전부 남음(10개 prune 없음)').toHaveLength(12);
    expect(all[0].roadAddress).toBe(location(11, runId).roadAddress);
    expect(mine.slice(0, 11).map((row) => row.roadAddress)).toEqual(
      Array.from({ length: 11 }, (_, i) => location(11 - i, runId).roadAddress)
    );
    const times = all.map((row) => new Date(row.lastUsedAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
    }
    const firstPage = await listRecentAddressesApi(request, 'destination');
    expect(firstPage.addresses, '기본 10건 페이지').toHaveLength(10);
    expect(firstPage.nextCursor).toBeTruthy();
  });

  test('AC-19: 유효 POST 200 · 잘못된 body 400 → x-request-id · activity log 2행 · metadata에 주소/이름/전화 없음', async ({
    request,
    playwright
  }) => {
    const runId = Date.now().toString(36);
    const valid = location(1, runId);
    const ok = await record(request, [valid]);
    expect(ok.status()).toBe(200);
    expect(((await ok.json()) as { data: { count: number } }).data.count).toBe(1);
    const okId = requestIdOf(ok);

    const bad = await request.post(RECENT_PATH, {
      data: { locations: [{ ...valid, contactPhone: 'abc' }] }
    });
    expect(bad.status()).toBe(400);
    const badId = requestIdOf(bad);

    const admin = await createAdminRequest(playwright);
    try {
      const okRow = await expectActivityLogRow(
        admin,
        'quick_request.recent_address_record',
        okId,
        200
      );
      const badRow = await expectActivityLogRow(
        admin,
        'quick_request.recent_address_record',
        badId,
        400
      );
      for (const row of [okRow, badRow]) {
        expect(row.target_type).toBe('quick_request_address');
        const keys = Object.keys(row.metadata ?? {});
        for (const key of keys) {
          expect(['count', 'error_code']).toContain(key);
        }
        const json = JSON.stringify(row);
        expect(json).not.toContain(valid.roadAddress);
        expect(json).not.toContain(valid.contactName);
        expect(json).not.toContain(valid.contactPhone);
      }
      expect(okRow.metadata?.count).toBe(1);
      expect(badRow.metadata?.error_code).toBeTruthy();
    } finally {
      await admin.dispose();
    }
  });

  test('AC-20: 사용자 A 기록 → 사용자 B GET에 A 주소 0건', async ({ request, playwright }) => {
    const runId = Date.now().toString(36);
    const mine = location(1, runId);
    expect((await record(request, [mine])).status()).toBe(200);
    expect((await listRecentAddressesApi(request, 'destination')).addresses.map((row) => row.roadAddress)).toContain(
      mine.roadAddress
    );

    const userB = await createActiveTestUser('e2e-qr-recentb', { fullName: 'E2E 퀵 최근B' });
    const userBRequest = await createGuestRequestWithPassword(playwright, userB.email, userB.password);
    try {
      const others = await listRecentAddressesApi(userBRequest, 'destination');
      expect(others.addresses.filter((row) => row.roadAddress === mine.roadAddress)).toHaveLength(0);
      expect(others.addresses).toHaveLength(0);
      expect(others.nextCursor).toBeNull();
      expect((await listRecentAddressesApi(userBRequest, 'origin')).addresses).toHaveLength(0);
    } finally {
      await userBRequest.dispose();
    }
  });
});
