import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUBSCRIPTION_MANAGER_ONLY_KEYS,
  SUBSCRIPTION_PUBLIC_KEYS,
  projectSubscription
} from '../projection.ts';

/** plan 103 AC-06 — 일반 직원 응답에 민감 칸 키 자체가 없다(허용 목록 투영) */

const ROW = {
  id: 1,
  category: 'creative',
  name: 'E2E Figma',
  plan_name: 'Pro',
  purpose: '디자인',
  status: 'active',
  expires_on: '2026-12-31',
  payer_entity: 'wake',
  card_last4: '1234',
  billing_cycle: 'monthly',
  billing_day: 15,
  billing_date: null,
  amount: '86000.00',
  currency: 'KRW',
  amount_varies: false,
  started_on: '2026-01-01',
  owner_account: 'owner@example.com',
  manager_memo: '메모',
  source: 'e2e',
  import_key: 'sheet:3',
  created_by: 'x',
  created_at: '2026-10-29T00:00:00Z',
  updated_at: '2026-10-29T00:00:00Z'
};
const EXTRAS = { assignees: [], open_requests: null, request_count: 2 };
const SENSITIVE = [
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
];

describe('projectSubscription', () => {
  it('직원 = 허용 목록 키만 · 민감 키 없음 · import_key 없음', () => {
    const item = projectSubscription(ROW, EXTRAS, false);
    assert.deepEqual(Object.keys(item).sort(), [...SUBSCRIPTION_PUBLIC_KEYS].sort());
    for (const key of [...SENSITIVE, 'import_key', 'source', 'request_count', 'has_requests', 'created_by']) {
      assert.equal(key in item, false, key);
    }
  });

  it('권한자 = 민감 키 모두 있음 · amount 숫자 · has_requests', () => {
    const item = projectSubscription(ROW, EXTRAS, true);
    for (const key of [...SENSITIVE, ...SUBSCRIPTION_MANAGER_ONLY_KEYS]) {
      assert.equal(key in item, true, key);
    }
    assert.equal(item.amount, 86000);
    assert.equal(item.has_requests, true);
    assert.equal('import_key' in item, false);
  });
});
