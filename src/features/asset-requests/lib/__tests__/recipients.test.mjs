import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAssetRequestRecipients } from '../recipients.ts';

/**
 * plan 103 §알림 수신자 — 실행: `node --test src/features/asset-requests/lib/__tests__/*.mjs`
 * (Node 24 내장 러너 + 타입 스트리핑 · `.mjs`인 이유는 quick-request 테스트와 같다)
 */

const STAFF = 'staff-a';
const ADMIN = 'admin-1';
const HR = 'hr-1';
const ACC = 'accounting-1';
const MANAGERS = [ADMIN, HR, ACC];

describe('resolveAssetRequestRecipients', () => {
  it('AC-39 created → active 권한자 전원 · 요청자 본인 제외', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'created',
        actorId: STAFF,
        requesterId: STAFF,
        assigneeId: null,
        managerIds: MANAGERS
      }),
      MANAGERS
    );
  });

  it('권한자가 직접 요청하면 본인은 빠진다', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'created',
        actorId: HR,
        requesterId: HR,
        assigneeId: null,
        managerIds: MANAGERS
      }),
      [ADMIN, ACC]
    );
  });

  it('updated · canceled → 권한자 전원(행위자 제외)', () => {
    for (const event of ['updated', 'canceled']) {
      assert.deepEqual(
        resolveAssetRequestRecipients({
          event,
          actorId: STAFF,
          requesterId: STAFF,
          assigneeId: null,
          managerIds: MANAGERS
        }),
        MANAGERS
      );
    }
  });

  it('AC-40 ① 처리 시작 전 요청자 댓글 → 권한자 전원', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'comment_created',
        actorId: STAFF,
        requesterId: STAFF,
        assigneeId: null,
        managerIds: MANAGERS
      }),
      MANAGERS
    );
  });

  it('AC-40 ② 처리 시작(status_changed) → 요청자만', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'status_changed',
        actorId: HR,
        requesterId: STAFF,
        assigneeId: HR,
        managerIds: MANAGERS
      }),
      [STAFF]
    );
  });

  it('AC-40 ③ 담당자 있을 때 요청자 댓글 → 담당자만(다른 권한자 0)', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'comment_created',
        actorId: STAFF,
        requesterId: STAFF,
        assigneeId: HR,
        managerIds: MANAGERS
      }),
      [HR]
    );
  });

  it('AC-40 ④ 담당자 댓글 → 요청자만', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'comment_created',
        actorId: HR,
        requesterId: STAFF,
        assigneeId: HR,
        managerIds: MANAGERS
      }),
      [STAFF]
    );
  });

  it('담당자가 아닌 권한자 댓글 → 요청자 + 담당자', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'comment_created',
        actorId: ACC,
        requesterId: STAFF,
        assigneeId: HR,
        managerIds: MANAGERS
      }),
      [STAFF, HR]
    );
  });

  it('AC-41 assigned → 새 담당자 · 자기 자신을 고르면 0', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'assigned',
        actorId: ACC,
        requesterId: STAFF,
        assigneeId: ACC,
        managerIds: MANAGERS
      }),
      []
    );
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'assigned',
        actorId: ACC,
        requesterId: STAFF,
        assigneeId: HR,
        managerIds: MANAGERS
      }),
      [HR]
    );
  });

  it('요청자 본인이 상태를 바꾸는 경우(권한자 겸 요청자) 알림 0', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'status_changed',
        actorId: HR,
        requesterId: HR,
        assigneeId: HR,
        managerIds: MANAGERS
      }),
      []
    );
  });

  it('중복 id는 한 번만', () => {
    assert.deepEqual(
      resolveAssetRequestRecipients({
        event: 'created',
        actorId: STAFF,
        requesterId: STAFF,
        assigneeId: null,
        managerIds: [HR, HR, ACC]
      }),
      [HR, ACC]
    );
  });
});
