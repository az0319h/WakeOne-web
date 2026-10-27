import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countUnreadMessages,
  findFirstUnreadMessageId,
  groupMessages
} from '../../components/chat/group-messages.ts';

/**
 * plan 93 C-13 · C-20 · AC-35 — 실행: `node --test src/features/quick-request/lib/__tests__/`
 */

const ME = 'me';
const OTHER = 'other';

function msg(id, authorUserId, createdAt) {
  return { id, authorUserId, createdAt };
}

function kinds(items) {
  return items.map((item) => (item.type === 'message' ? `m${item.message.id}` : item.type));
}

describe('groupMessages', () => {
  it('빈 목록 → 빈 배열', () => {
    assert.deepEqual(groupMessages([], { myUserId: ME, myLastReadMessageId: 0 }), []);
  });

  it('날짜가 바뀌면 date 구분선 (AC-35: 어제 2개 + 오늘 1개 → 구분선 2개)', () => {
    const items = groupMessages(
      [
        msg(1, OTHER, '2026-10-25T01:00:00.000Z'),
        msg(2, OTHER, '2026-10-25T01:02:00.000Z'),
        msg(3, OTHER, '2026-10-26T01:00:00.000Z')
      ],
      { myUserId: ME, myLastReadMessageId: 3 }
    );
    assert.deepEqual(kinds(items), ['date', 'm1', 'm2', 'date', 'm3']);
    assert.equal(items.filter((item) => item.type === 'date').length, 2);
  });

  it('같은 작성자 5분 안 연속 → 첫 메시지만 isGroupStart, 마지막만 isGroupEnd (AC-35)', () => {
    const items = groupMessages(
      [
        msg(1, OTHER, '2026-10-25T01:00:00.000Z'),
        msg(2, OTHER, '2026-10-25T01:02:00.000Z'),
        msg(3, OTHER, '2026-10-26T01:00:00.000Z')
      ],
      { myUserId: ME, myLastReadMessageId: 3 }
    );
    const messages = items.filter((item) => item.type === 'message');
    assert.deepEqual(
      messages.map((item) => [item.message.id, item.isGroupStart, item.isGroupEnd]),
      [
        [1, true, false],
        [2, false, true],
        [3, true, true]
      ]
    );
  });

  it('5분을 넘기거나 작성자가 바뀌면 새 묶음', () => {
    const items = groupMessages(
      [
        msg(1, OTHER, '2026-10-25T01:00:00.000Z'),
        msg(2, OTHER, '2026-10-25T01:06:00.000Z'),
        msg(3, ME, '2026-10-25T01:06:30.000Z')
      ],
      { myUserId: ME, myLastReadMessageId: 2 }
    );
    const messages = items.filter((item) => item.type === 'message');
    assert.deepEqual(
      messages.map((item) => [item.message.id, item.isGroupStart, item.isGroupEnd]),
      [
        [1, true, true],
        [2, true, true],
        [3, true, true]
      ]
    );
  });

  it('「여기부터 새 메시지」는 남이 쓴 id > 읽음 위치인 첫 메시지 앞에 한 번 · 묶음도 끊는다 (C-13)', () => {
    const items = groupMessages(
      [
        msg(1, OTHER, '2026-10-25T01:00:00.000Z'),
        msg(2, OTHER, '2026-10-25T01:01:00.000Z'),
        msg(3, OTHER, '2026-10-25T01:02:00.000Z')
      ],
      { myUserId: ME, myLastReadMessageId: 1 }
    );
    assert.deepEqual(kinds(items), ['date', 'm1', 'unread', 'm2', 'm3']);
    const m1 = items.find((item) => item.type === 'message' && item.message.id === 1);
    const m2 = items.find((item) => item.type === 'message' && item.message.id === 2);
    assert.equal(m1.isGroupEnd, true);
    assert.equal(m2.isGroupStart, true);
  });

  it('내 메시지·임시(optimistic) 메시지는 unread 판정에서 제외 (AC-20)', () => {
    const messages = [
      msg(1, OTHER, '2026-10-25T01:00:00.000Z'),
      msg(2, ME, '2026-10-25T01:01:00.000Z'),
      msg('temp-abc', ME, '2026-10-25T01:02:00.000Z')
    ];
    assert.equal(findFirstUnreadMessageId(messages, { myUserId: ME, myLastReadMessageId: 1 }), null);
    assert.equal(countUnreadMessages(messages, { myUserId: ME, myLastReadMessageId: 0 }), 1);
    const items = groupMessages(messages, { myUserId: ME, myLastReadMessageId: 1 });
    assert.deepEqual(kinds(items), ['date', 'm1', 'm2', 'mtemp-abc']);
  });

  it('dayKey 주입 — 호출자가 KST 날짜 라벨을 넘기면 그 라벨이 구분선에 쓰인다', () => {
    const items = groupMessages(
      [msg(1, OTHER, '2026-10-25T16:00:00.000Z'), msg(2, OTHER, '2026-10-25T14:00:00.000Z')],
      { myUserId: ME, myLastReadMessageId: 9, dayKey: (iso) => (iso.startsWith('2026-10-25T16') ? '2026-10-26' : '2026-10-25') }
    );
    assert.deepEqual(
      items.filter((item) => item.type === 'date').map((item) => item.label),
      ['2026-10-26', '2026-10-25']
    );
  });
});
