import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EQUIPMENT_PUBLIC_KEYS, projectEquipment } from '../projection.ts';

/** plan 103 AC-07 — 일반 직원 응답에 구입 정보·관리 메모 키 자체가 없다 */

const ROW = {
  id: 9,
  asset_no: 'N-012',
  kind: 'notebook',
  model_serial: 'E2E-SN-7788',
  status: 'in_use',
  assignee_type: null,
  assignee_user_id: null,
  assignee_affiliation: null,
  assignee_rank: null,
  ledger_entity: 'wake',
  ledger_code: '000123',
  purchase_amount: '1500000',
  purchased_on: '2025-03-01',
  vendor: '쿠팡',
  manager_memo: '메모',
  source: 'e2e',
  created_at: '2026-10-29T00:00:00Z',
  updated_at: '2026-10-29T00:00:00Z'
};
const SENSITIVE = ['ledger_entity', 'ledger_code', 'purchase_amount', 'purchased_on', 'vendor', 'manager_memo'];

describe('projectEquipment', () => {
  it('직원 = 허용 목록 키만', () => {
    const item = projectEquipment(ROW, { assignee: null, open_requests: null, request_count: 0 }, false);
    assert.deepEqual(Object.keys(item).sort(), [...EQUIPMENT_PUBLIC_KEYS].sort());
    for (const key of [...SENSITIVE, 'assignee_user_id', 'source']) {
      assert.equal(key in item, false, key);
    }
  });

  it('권한자 = 민감 키 있음 · has_requests false', () => {
    const item = projectEquipment(ROW, { assignee: null, open_requests: null, request_count: 0 }, true);
    for (const key of SENSITIVE) assert.equal(key in item, true, key);
    assert.equal(item.purchase_amount, 1500000);
    assert.equal(item.has_requests, false);
  });
});
