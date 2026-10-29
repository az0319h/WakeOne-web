import { expect, test } from '@playwright/test';
import {
  createEquipmentFixture,
  createSubscriptionFixture,
  expectApiError,
  expectLog,
  json,
  MSG,
  service,
  uniqueTag,
  userIdOf,
  withApi
} from '../helpers/asset-ledger';

/**
 * plan 103 (docs/plans/103_subscription-equipment-ledger-plan.md)
 * AC-05 직원 403 + 로그 · AC-06 구독 민감 칸 투영 · AC-07 비품 민감 칸 투영 · AC-21 비밀번호·로그인 메모 400 · AC-22 대상자 검증
 */

const SUBSCRIPTION_MANAGER_KEYS = [
  'amount',
  'currency',
  'amount_varies',
  'payer_entity',
  'card_last4',
  'billing_cycle',
  'billing_day',
  'billing_date',
  'started_on',
  'owner_account',
  'manager_memo'
] as const;

const EQUIPMENT_MANAGER_KEYS = [
  'ledger_entity',
  'ledger_code',
  'purchase_amount',
  'purchased_on',
  'vendor',
  'manager_memo'
] as const;

function expectKeys(item: Record<string, unknown>, keys: readonly string[], present: boolean, label: string) {
  for (const key of keys) {
    expect(Object.prototype.hasOwnProperty.call(item, key), `${label} · ${key} ${present ? '있음' : '없음'}`).toBe(present);
  }
}

test.describe('plan 103 · 대장 API 권한·투영·검증', () => {
  test('AC-05: 직원 — POST 구독 · PATCH/DELETE 비품 · 후보 · next-number 전부 403 「권한이 없습니다.」 · CUD 3건 403 로그', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 직원403` });

    await withApi(playwright, 'staff', async (api) => {
      const create = await api.post('/api/subscriptions', {
        data: { category: 'software', name: `E2E ${tag} 직원생성`, status: 'active' }
      });
      await expectApiError(create, 403, MSG.forbidden);
      const update = await api.patch(`/api/equipment/${equipment.id}`, { data: { status: 'repair' } });
      await expectApiError(update, 403, MSG.forbidden);
      const remove = await api.delete(`/api/equipment/${equipment.id}`);
      await expectApiError(remove, 403, MSG.forbidden);
      await expectApiError(await api.get('/api/asset-ledger/assignee-options'), 403, MSG.forbidden);
      await expectApiError(await api.get('/api/equipment/next-number?prefix=N'), 403, MSG.forbidden);

      await expectLog(create, { action: 'subscription.create', status: 403 });
      await expectLog(update, { action: 'equipment.update', status: 403 });
      await expectLog(remove, { action: 'equipment.delete', status: 403 });

      // GET /api/activity-logs (본인 로그) 에도 각 action 403 행
      const logsResponse = await api.get('/api/activity-logs?limit=50');
      expect(logsResponse.status()).toBe(200);
      const logs = (await json<{ data: { logs: Array<{ request_id: string; action: string; http_status: number }> } }>(
        logsResponse
      )).data.logs;
      for (const [response, action] of [
        [create, 'subscription.create'],
        [update, 'equipment.update'],
        [remove, 'equipment.delete']
      ] as const) {
        const requestId = response.headers()['x-request-id'];
        const row = logs.find((log) => log.request_id === requestId);
        expect(row, `${action} in /api/activity-logs`).toBeTruthy();
        expect(row?.action).toBe(action);
        expect(row?.http_status).toBe(403);
      }
    });
    expect((await service().from('equipment_items').select('status').eq('id', equipment.id).single()).data).toEqual({
      status: 'in_use'
    });
  });

  test('AC-06: 구독 — 직원 응답에 결제·관리 메모 키 자체가 없음 · hr 응답에는 모두 있음 (목록·단건)', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const id = await createSubscriptionFixture({
      name: `E2E ${tag} 투영 구독`,
      payer_entity: 'wake',
      card_last4: '2468',
      billing_cycle: 'monthly',
      billing_day: 24,
      billing_date: '2026-12-24',
      amount: 86000,
      currency: 'KRW',
      amount_varies: false,
      started_on: '2025-01-01',
      owner_account: 'e2e-owner@example.com',
      manager_memo: 'E2E 관리 메모'
    });

    for (const [role, present] of [
      ['staff', false],
      ['hr', true]
    ] as const) {
      await withApi(playwright, role, async (api) => {
        const list = await api.get(`/api/subscriptions?q=${tag}&perPage=50&limit=50`);
        expect(list.status()).toBe(200);
        const items = (await json<{ data: { items: Array<Record<string, unknown>> } }>(list)).data.items;
        const item = items.find((row) => row.id === id);
        expect(item, `${role} 목록에 fixture`).toBeTruthy();
        expectKeys(item!, SUBSCRIPTION_MANAGER_KEYS, present, `${role} 목록`);

        const single = await api.get(`/api/subscriptions/${id}`);
        expect(single.status()).toBe(200);
        const detail = (await json<{ data: { item: Record<string, unknown> } }>(single)).data.item;
        expectKeys(detail, SUBSCRIPTION_MANAGER_KEYS, present, `${role} 단건`);
        expect(Object.prototype.hasOwnProperty.call(detail, 'import_key')).toBe(false);
        if (present) {
          expect(detail.card_last4).toBe('2468');
          expect(detail.manager_memo).toBe('E2E 관리 메모');
        }
      });
    }
  });

  test('AC-07: 비품 — 직원 응답에 회계장부·구입·관리 메모 키 없음 · 회계팀 응답에는 있음 (목록·단건)', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const equipment = await createEquipmentFixture({
      model_serial: `E2E ${tag} 투영 모니터`,
      ledger_entity: 'wake',
      ledger_code: 'E2E-CODE',
      purchase_amount: 350000,
      purchased_on: '2025-03-04',
      vendor: 'E2E 구입처',
      manager_memo: 'E2E 관리 메모'
    });

    for (const [role, present] of [
      ['staff', false],
      ['accounting', true]
    ] as const) {
      await withApi(playwright, role, async (api) => {
        const list = await api.get(`/api/equipment?q=${tag}&perPage=50&limit=50`);
        expect(list.status()).toBe(200);
        const items = (await json<{ data: { items: Array<Record<string, unknown>> } }>(list)).data.items;
        const item = items.find((row) => row.id === equipment.id);
        expect(item, `${role} 목록에 fixture`).toBeTruthy();
        expectKeys(item!, EQUIPMENT_MANAGER_KEYS, present, `${role} 목록`);

        const single = await api.get(`/api/equipment/${equipment.id}`);
        expect(single.status()).toBe(200);
        const detail = (await json<{ data: { item: Record<string, unknown> } }>(single)).data.item;
        expectKeys(detail, EQUIPMENT_MANAGER_KEYS, present, `${role} 단건`);
        if (present) expect(detail.vendor).toBe('E2E 구입처');
      });
    }
  });

  test('AC-21: 관리 메모 「PW: abc」「비밀번호 1234」「ID: x@y」 — 구독·비품 POST/PATCH 모두 400 · DB 변경 없음 · 400 로그(메모 값 없음)', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const subscriptionId = await createSubscriptionFixture({ name: `E2E ${tag} 메모 구독`, manager_memo: 'E2E 원래 메모' });
    const equipment = await createEquipmentFixture({ model_serial: `E2E ${tag} 메모 모니터`, manager_memo: 'E2E 원래 메모' });
    const memos = ['PW: abc', '비밀번호 1234', 'ID: x@y'];

    await withApi(playwright, 'hr', async (api) => {
      for (const [index, memo] of memos.entries()) {
        const calls = [
          {
            action: 'subscription.create',
            response: await api.post('/api/subscriptions', {
              data: { category: 'software', name: `E2E ${tag} 비번${index}`, status: 'active', manager_memo: memo }
            })
          },
          {
            action: 'subscription.update',
            response: await api.patch(`/api/subscriptions/${subscriptionId}`, { data: { manager_memo: memo } })
          },
          {
            action: 'equipment.create',
            response: await api.post('/api/equipment', {
              data: {
                kind: 'monitor',
                asset_no: `M-${8000 + Math.floor(Math.random() * 1999)}`,
                model_serial: `E2E ${tag} 비번${index}`,
                manager_memo: memo
              }
            })
          },
          {
            action: 'equipment.update',
            response: await api.patch(`/api/equipment/${equipment.id}`, { data: { manager_memo: memo } })
          }
        ];
        for (const call of calls) {
          await expectApiError(call.response, 400, MSG.secret);
          const log = await expectLog(call.response, { action: call.action, status: 400 });
          const metadataText = JSON.stringify(log.metadata ?? {});
          for (const fragment of ['abc', '1234', 'x@y', memo]) {
            expect(metadataText, `${call.action} metadata에 메모 값 없음`).not.toContain(fragment);
          }
        }
      }
    });

    const { data: createdSubs } = await service().from('subscriptions').select('id').ilike('name', `E2E ${tag} 비번%`);
    expect(createdSubs ?? []).toHaveLength(0);
    const { data: createdEquipment } = await service()
      .from('equipment_items')
      .select('id')
      .ilike('model_serial', `E2E ${tag} 비번%`);
    expect(createdEquipment ?? []).toHaveLength(0);
    expect((await service().from('subscriptions').select('manager_memo').eq('id', subscriptionId).single()).data).toEqual({
      manager_memo: 'E2E 원래 메모'
    });
    expect((await service().from('equipment_items').select('manager_memo').eq('id', equipment.id).single()).data).toEqual({
      manager_memo: 'E2E 원래 메모'
    });
  });

  test('AC-22: 대상자에 동방 사람·동방 팀·같은 대상자 2번·비품 사용자 동방 → 400 · 후보 API에 동방 없음', async ({
    playwright
  }) => {
    const tag = uniqueTag();
    const dongbangId = userIdOf('dongbang');

    await withApi(playwright, 'hr', async (api) => {
      const base = { category: 'software', status: 'active' };
      await expectApiError(
        await api.post('/api/subscriptions', {
          data: { ...base, name: `E2E ${tag} 동방사람`, assignees: [{ assignee_type: 'user', user_id: dongbangId }] }
        }),
        400,
        MSG.invalidAssignee
      );
      await expectApiError(
        await api.post('/api/subscriptions', {
          data: {
            ...base,
            name: `E2E ${tag} 동방팀`,
            assignees: [{ assignee_type: 'team', affiliation: 'dongbang', rank: '퀵' }]
          }
        }),
        400,
        MSG.invalidAssignee
      );
      await expectApiError(
        await api.post('/api/subscriptions', {
          data: {
            ...base,
            name: `E2E ${tag} 중복`,
            assignees: [
              { assignee_type: 'affiliation', affiliation: 'wake' },
              { assignee_type: 'affiliation', affiliation: 'wake' }
            ]
          }
        }),
        400,
        MSG.duplicateAssignee
      );
      await expectApiError(
        await api.post('/api/equipment', {
          data: {
            kind: 'monitor',
            asset_no: `M-${8000 + Math.floor(Math.random() * 1999)}`,
            model_serial: `E2E ${tag} 동방사용자`,
            assignee: { assignee_type: 'user', user_id: dongbangId }
          }
        }),
        400,
        MSG.invalidAssignee
      );

      const options = await api.get('/api/asset-ledger/assignee-options');
      expect(options.status()).toBe(200);
      const data = (
        await json<{
          data: {
            people: Array<{ user_id: string; affiliation: string | null }>;
            teams: Array<{ affiliation: string }>;
            affiliations: Array<{ affiliation: string }>;
            managers: Array<{ user_id: string }>;
          };
        }>(options)
      ).data;
      expect(data.people.length).toBeGreaterThan(0);
      expect(data.people.map((person) => person.user_id)).not.toContain(dongbangId);
      expect(data.people.filter((person) => person.affiliation === 'dongbang')).toHaveLength(0);
      expect(data.affiliations.map((item) => item.affiliation)).not.toContain('dongbang');
      expect(data.teams.map((item) => item.affiliation)).not.toContain('dongbang');
    });

    const { data: created } = await service().from('subscriptions').select('id').ilike('name', `E2E ${tag}%`);
    expect(created ?? []).toHaveLength(0);
  });
});
