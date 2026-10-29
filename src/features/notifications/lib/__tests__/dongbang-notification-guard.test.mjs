import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  partitionNotificationRowsForDongbang,
  summarizeDroppedTypes
} from '../dongbang-notification-guard.ts';
import { isNotificationTypeAllowedForDongbang as allowed } from '../push-groups.ts';

/** plan 95 D-4 — `insertNotifications()` 동방특송 수신 가드 · 실행: `node --test src/features/notifications/lib/__tests__/` */

const D1 = 'dongbang-1';
const D2 = 'dongbang-2';
const W = 'wake-user';
const A = 'admin';
const DONGBANG = new Set([D1, D2]);

const row = (recipient_user_id, type, title = 't') => ({ recipient_user_id, type, title, body: 'b' });

describe('partitionNotificationRowsForDongbang', () => {
  it('동방이 아닌 수신자는 type과 무관하게 전부 통과', () => {
    const rows = [
      row(W, 'announcement.published'),
      row(A, 'user.approval_request_admin'),
      row(W, 'workflow.completed')
    ];
    const result = partitionNotificationRowsForDongbang(rows, DONGBANG, allowed);
    assert.deepEqual(result.kept, rows);
    assert.deepEqual(result.dropped, []);
  });

  it('동방 수신자는 quick_request·profile 그룹만 남고 나머지는 drop', () => {
    const keep1 = row(D1, 'quick_request.vendor_event');
    const keep2 = row(D1, 'user.update');
    const keep3 = row(D2, 'quick_request.chat_message');
    const drop1 = row(D1, 'announcement.published');
    const drop2 = row(D2, 'support.created');
    const drop3 = row(D2, 'benefit.import_applicant');
    const result = partitionNotificationRowsForDongbang(
      [drop1, keep1, keep2, drop2, keep3, drop3],
      DONGBANG,
      allowed
    );
    assert.deepEqual(result.kept, [keep1, keep2, keep3]);
    assert.deepEqual(result.dropped, [drop1, drop2, drop3]);
  });

  it('섞인 fan-out — 순서 유지 · 동방 행만 걸러진다', () => {
    const rows = [
      row(W, 'announcement.published'),
      row(D1, 'announcement.published'),
      row(A, 'announcement.published'),
      row(D2, 'announcement.published')
    ];
    const result = partitionNotificationRowsForDongbang(rows, DONGBANG, allowed);
    assert.deepEqual(result.kept, [rows[0], rows[2]]);
    assert.deepEqual(result.dropped, [rows[1], rows[3]]);
  });

  it('동방 수신자가 없으면(빈 집합) 원본 그대로', () => {
    const rows = [row(D1, 'announcement.published')];
    const result = partitionNotificationRowsForDongbang(rows, new Set(), allowed);
    assert.deepEqual(result.kept, rows);
    assert.deepEqual(result.dropped, []);
  });

  it('빈 입력 → 빈 결과', () => {
    assert.deepEqual(partitionNotificationRowsForDongbang([], DONGBANG, allowed), { kept: [], dropped: [] });
  });

  it('알 수 없는 type은 동방에게 생성하지 않는다(보수적)', () => {
    const result = partitionNotificationRowsForDongbang([row(D1, 'future.unknown')], DONGBANG, allowed);
    assert.equal(result.kept.length, 0);
    assert.equal(result.dropped.length, 1);
  });
});

describe('summarizeDroppedTypes', () => {
  it('type별 건수를 한 줄로', () => {
    assert.equal(
      summarizeDroppedTypes([
        row(D1, 'announcement.published'),
        row(D2, 'announcement.published'),
        row(D1, 'support.created')
      ]),
      'announcement.published=2, support.created=1'
    );
    assert.equal(summarizeDroppedTypes([]), '');
  });
});
