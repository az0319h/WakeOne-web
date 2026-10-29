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

/** plan 101 D-7 — 참여자 이벤트 시스템 줄 (designer §3) */
describe('groupMessages · events (plan 101)', () => {
  const base = [
    msg(1, OTHER, '2026-10-25T01:00:00.000Z'),
    msg(2, OTHER, '2026-10-25T01:02:00.000Z'),
    msg(3, OTHER, '2026-10-26T01:00:00.000Z')
  ];
  const opts = { myUserId: ME, myLastReadMessageId: 3 };
  const ev = (type, at, userId = 'p1') => ({ type, userId, name: '최동료', at });

  function kindsWithSystem(items) {
    return items.map((item) =>
      item.type === 'message' ? `m${item.message.id}` : item.type === 'system' ? `s:${item.event.type}` : item.type
    );
  }

  it('events 없음(생략·빈 배열) → 기존 출력과 동일', () => {
    assert.deepEqual(groupMessages(base, opts), groupMessages(base, { ...opts, events: [] }));
    assert.deepEqual(kinds(groupMessages(base, { ...opts, events: [] })), ['date', 'm1', 'm2', 'date', 'm3']);
  });

  it('이벤트가 첫 메시지 앞 · 중간 · 끝에 시각 순으로 끼워진다', () => {
    const items = groupMessages(base, {
      ...opts,
      events: [
        ev('joined', '2026-10-25T00:30:00.000Z'),
        ev('removed', '2026-10-25T01:01:00.000Z'),
        ev('joined', '2026-10-26T02:00:00.000Z')
      ]
    });
    assert.deepEqual(kindsWithSystem(items), [
      'date', 's:joined', 'm1', 's:removed', 'm2', 'date', 'm3', 's:joined'
    ]);
  });

  it('이벤트는 같은 작성자 5분 묶음을 끊는다', () => {
    const items = groupMessages(base, { ...opts, events: [ev('joined', '2026-10-25T01:01:00.000Z')] });
    const m1 = items.find((item) => item.type === 'message' && item.message.id === 1);
    const m2 = items.find((item) => item.type === 'message' && item.message.id === 2);
    assert.equal(m1.isGroupEnd, true);
    assert.equal(m2.isGroupStart, true);
  });

  it('메시지가 없는 날의 이벤트도 date 구분선 1개를 만든다', () => {
    const items = groupMessages(base, { ...opts, events: [ev('left', '2026-10-27T03:00:00.000Z')] });
    assert.deepEqual(kindsWithSystem(items), ['date', 'm1', 'm2', 'date', 'm3', 'date', 's:left']);
    assert.equal(items.filter((item) => item.type === 'date').length, 3);
  });

  it('동률(at === createdAt)이면 이벤트가 메시지 앞 · 입력 순서가 뒤섞여도 시각 순', () => {
    const items = groupMessages(base, {
      ...opts,
      events: [ev('removed', '2026-10-25T01:02:00.000Z'), ev('joined', '2026-10-25T01:00:00.000Z')]
    });
    assert.deepEqual(kindsWithSystem(items), ['date', 's:joined', 'm1', 's:removed', 'm2', 'date', 'm3']);
  });

  it('메시지 0개 + 이벤트만 → date + system', () => {
    const items = groupMessages([], { ...opts, events: [ev('joined', '2026-10-25T01:00:00.000Z')] });
    assert.deepEqual(kindsWithSystem(items), ['date', 's:joined']);
  });

  it('unread 구분선은 메시지에만 · 이벤트가 사이에 있어도 한 번', () => {
    const items = groupMessages(base, {
      myUserId: ME,
      myLastReadMessageId: 1,
      events: [ev('joined', '2026-10-25T01:01:00.000Z')]
    });
    assert.deepEqual(kindsWithSystem(items), ['date', 'm1', 's:joined', 'unread', 'm2', 'date', 'm3']);
  });

  it('임시(optimistic) 메시지보다 늦은 이벤트도 임시 행 앞에 온다 · key 형식', () => {
    const items = groupMessages(
      [msg(1, OTHER, '2026-10-25T01:00:00.000Z'), msg('temp-x', ME, '2026-10-25T01:00:30.000Z')],
      { ...opts, events: [ev('joined', '2026-10-25T01:05:00.000Z', 'u9')] }
    );
    assert.deepEqual(kindsWithSystem(items), ['date', 'm1', 's:joined', 'mtemp-x']);
    const system = items.find((item) => item.type === 'system');
    assert.equal(system.key, 'system-joined-u9-2026-10-25T01:05:00.000Z');
  });
});
