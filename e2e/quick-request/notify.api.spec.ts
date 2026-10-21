import { expect, test } from '@playwright/test';

const location = {
  roadAddress: '서울 중구 세종대로 110',
  detailAddress: '1층',
  contactName: 'E2E API',
  contactPhone: '01012345678'
};

function buildNotifyBody(): Record<string, unknown> {
  return {
    itemDescription: '',
    goodsSize: 's',
    vehicleTypes: ['오토바이'],
    vehicleCount: 1,
    origin: {
      ...location,
      schedule: { mode: 'immediate' as const },
      notes: [] as string[]
    },
    stopovers: [
      { ...location, roadAddress: '경유지 1번지' },
      { ...location, roadAddress: '경유지 2번지' }
    ],
    destination: {
      ...location,
      schedule: { mode: 'asap' as const },
      notes: [] as string[]
    },
    freightPayment: 'monthly' as const,
    requestedAtIso: new Date().toISOString(),
    requesterName: 'E2E Admin'
  };
}

test.describe('퀵 요청 notify API', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('AC-28: stopovers 2건 · 501 · x-request-id', async ({ request }) => {
    const body = buildNotifyBody();
    const response = await request.post('/api/quick-request/notify', { data: body });

    expect(response.status()).toBe(501);
    expect(response.headers()['x-request-id']).toBeTruthy();

    const json = (await response.json()) as { success?: boolean; message?: string };
    expect(json.success).toBe(false);
    expect(json.message).toContain('카톡 API');
  });

  // plan 87 r1 AC-05 — goodsSize 필수 · itemDescription은 other일 때만 필수 (goodsSizeOtherText 제거)
  test('AC-05: (r1) ① xs+빈 물품 501 ② 크기 누락 400 ③ other+빈 물품 400 ④ other+철판 2m 501 · 모두 x-request-id', async ({
    request
  }) => {
    const sized = await request.post('/api/quick-request/notify', {
      data: { ...buildNotifyBody(), goodsSize: 'xs', itemDescription: '' }
    });
    expect(sized.status()).toBe(501);
    expect(sized.headers()['x-request-id']).toBeTruthy();

    const { goodsSize: _omit, ...withoutSize } = buildNotifyBody();
    const missing = await request.post('/api/quick-request/notify', { data: withoutSize });
    expect(missing.status()).toBe(400);
    expect(missing.headers()['x-request-id']).toBeTruthy();

    for (const blank of ['', '   ']) {
      const otherEmpty = await request.post('/api/quick-request/notify', {
        data: { ...buildNotifyBody(), goodsSize: 'other', itemDescription: blank }
      });
      expect(otherEmpty.status(), `other + ${JSON.stringify(blank)}`).toBe(400);
      expect(otherEmpty.headers()['x-request-id']).toBeTruthy();
    }

    const otherFilled = await request.post('/api/quick-request/notify', {
      data: { ...buildNotifyBody(), goodsSize: 'other', itemDescription: '철판 2m' }
    });
    expect(otherFilled.status()).toBe(501);
    expect(otherFilled.headers()['x-request-id']).toBeTruthy();
  });

  // plan 87 AC-23 — notify는 501 placeholder 유지 (activity log 0건은 grep으로 확인)
  test('AC-23: 유효 notify POST → 501 · x-request-id', async ({ request }) => {
    const response = await request.post('/api/quick-request/notify', { data: buildNotifyBody() });
    expect(response.status()).toBe(501);
    expect(response.headers()['x-request-id']).toBeTruthy();
  });
});
