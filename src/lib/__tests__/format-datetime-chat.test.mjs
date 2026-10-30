import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatAbsoluteDateTimeKo,
  formatChatBubbleTimeKo,
  formatChatListTimeKo
} from '../format-datetime.ts';

/**
 * plan 106 AC-39 — 퀵 대화 짧은 시각 (KST 기준 · 상대 표현 없음).
 * 실행: `node --test src/lib/__tests__/format-datetime-chat.test.mjs`
 */

const RELATIVE_WORDS = /전|방금|어제|오늘/;

describe('formatChatBubbleTimeKo (말풍선·시스템 줄 HH:mm)', () => {
  it('UTC 15:30 → KST 다음날 00:30', () => {
    assert.equal(formatChatBubbleTimeKo('2026-10-28T15:30:00Z'), '00:30');
  });

  it('KST 오프셋 문자열·Date 모두 HH:mm (초 버림)', () => {
    assert.equal(formatChatBubbleTimeKo('2026-10-29T16:03:04+09:00'), '16:03');
    assert.equal(formatChatBubbleTimeKo(new Date('2026-10-29T07:03:59Z')), '16:03');
  });

  it('잘못된 입력 → 빈 문자열', () => {
    assert.equal(formatChatBubbleTimeKo('not-a-date'), '');
    assert.equal(formatChatBubbleTimeKo(''), '');
    assert.equal(formatChatBubbleTimeKo(new Date(Number.NaN)), '');
  });
});

describe('formatChatListTimeKo (목록: 오늘 HH:mm / 같은 해 MM-dd / 이전 해 yyyy-MM-dd)', () => {
  const now = new Date('2026-10-29T08:00:00Z'); // KST 2026-10-29 17:00

  it('같은 KST 날짜 → HH:mm', () => {
    assert.equal(formatChatListTimeKo('2026-10-29T07:03:04Z', now), '16:03');
    // UTC로는 전날(10-28 15:30)이지만 KST는 10-29 00:30 → 오늘
    assert.equal(formatChatListTimeKo('2026-10-28T15:30:00Z', now), '00:30');
  });

  it('KST 기준 어제(UTC로는 같은 날일 수 있음) → MM-dd', () => {
    // UTC 10-28 14:59 = KST 10-28 23:59 → 같은 해 다른 날
    assert.equal(formatChatListTimeKo('2026-10-28T14:59:00Z', now), '10-28');
    assert.equal(formatChatListTimeKo('2026-01-02T03:00:00Z', now), '01-02');
  });

  it('해 넘김: KST 12-31 23:59 ↔ 01-01 → yyyy-MM-dd', () => {
    const newYear = new Date('2026-12-31T15:30:00Z'); // KST 2027-01-01 00:30
    assert.equal(formatChatListTimeKo('2026-12-31T14:59:00Z', newYear), '2026-12-31'); // KST 2026-12-31 23:59
    assert.equal(formatChatListTimeKo('2026-12-31T15:00:00Z', newYear), '00:00'); // KST 2027-01-01 00:00 → 오늘
    assert.equal(formatChatListTimeKo('2025-12-30T05:00:00Z', now), '2025-12-30');
  });

  it('잘못된 입력 → 빈 문자열 · 잘못된 now는 지금으로 대체', () => {
    assert.equal(formatChatListTimeKo('nope', now), '');
    assert.equal(formatChatListTimeKo('', now), '');
    assert.match(formatChatListTimeKo('2020-05-05T00:00:00Z', new Date(Number.NaN)), /^2020-05-05$/);
  });

  it('상대 표현 0건 · 기존 절대 시각 함수 불변', () => {
    for (const value of ['2026-10-29T07:03:04Z', '2026-10-28T14:59:00Z', '2025-12-30T05:00:00Z']) {
      assert.doesNotMatch(formatChatListTimeKo(value, now), RELATIVE_WORDS);
      assert.doesNotMatch(formatChatBubbleTimeKo(value), RELATIVE_WORDS);
    }
    assert.equal(formatAbsoluteDateTimeKo('2026-10-29T07:03:04Z'), '2026-10-29 (목) 16:03:04');
  });
});
