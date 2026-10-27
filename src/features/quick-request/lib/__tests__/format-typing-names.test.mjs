import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTypingNames } from '../../components/chat/format-typing-names.ts';
import { formatUnreadBadge } from '../../components/chat/format-unread-badge.ts';

/**
 * plan 93 C-23 · AC-36 · AC-37 — 실행: `node --test src/features/quick-request/lib/__tests__/`
 */

describe('formatTypingNames', () => {
  it('0명 → 빈 문자열', () => {
    assert.equal(formatTypingNames([]), '');
    assert.equal(formatTypingNames(['', '  ']), '');
  });

  it('1명 → A님이 입력 중…', () => {
    assert.equal(formatTypingNames(['A']), 'A님이 입력 중…');
  });

  it('2명 → A님, B님이 입력 중… (입력 시작 순)', () => {
    assert.equal(formatTypingNames(['A', 'B']), 'A님, B님이 입력 중…');
    assert.equal(formatTypingNames(['B', 'A']), 'B님, A님이 입력 중…');
  });

  it('3명 이상 → A님 외 N명이 입력 중…', () => {
    assert.equal(formatTypingNames(['A', 'B', 'C']), 'A님 외 2명이 입력 중…');
    assert.equal(formatTypingNames(['A', 'B', 'C', 'D']), 'A님 외 3명이 입력 중…');
  });
});

describe('formatUnreadBadge', () => {
  it('0 이하·비정상 → 0', () => {
    assert.equal(formatUnreadBadge(0), '0');
    assert.equal(formatUnreadBadge(-3), '0');
    assert.equal(formatUnreadBadge(Number.NaN), '0');
  });

  it('1~99 → 그대로', () => {
    assert.equal(formatUnreadBadge(1), '1');
    assert.equal(formatUnreadBadge(99), '99');
  });

  it('100 이상 → 99+ (AC-37)', () => {
    assert.equal(formatUnreadBadge(100), '99+');
    assert.equal(formatUnreadBadge(1234), '99+');
  });
});
