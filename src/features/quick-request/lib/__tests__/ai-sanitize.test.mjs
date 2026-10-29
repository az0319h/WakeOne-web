import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseSuggestionsJson,
  sanitizeSuggestions,
  sanitizeSuggestionText,
  suggestionDedupeKey
} from '../ai-sanitize.ts';

/**
 * plan 100 AC-13 — 실행: `node --test src/features/quick-request/lib/__tests__/ai-sanitize.test.mjs`
 */

const REQUESTER_FALLBACK = [
  '취소 부탁드립니다',
  '시간 변경 부탁드립니다',
  '연락 부탁드립니다',
  '잠시만 기다려 주세요',
  '확인했습니다'
];

describe('sanitizeSuggestionText', () => {
  it('trim · 따옴표·이모지·번호 매기기 제거 · 공백 정리', () => {
    assert.equal(sanitizeSuggestionText('  "네, 가능합니다!" 😊 '), '네, 가능합니다!');
    assert.equal(sanitizeSuggestionText('1. 확인했습니다'), '확인했습니다');
    assert.equal(sanitizeSuggestionText('- 「잠시만요」\n기다려 주세요'), '잠시만요 기다려 주세요');
    assert.equal(sanitizeSuggestionText('3.5톤 차량 가능할까요?'), '3.5톤 차량 가능할까요?');
  });

  it('숫자 7자리 이상(구분자 포함) 문장은 제거 — 전화·금액', () => {
    assert.equal(sanitizeSuggestionText('010-1234-5678로 연락 주세요'), null);
    assert.equal(sanitizeSuggestionText('1,500,000원 입금했습니다'), null);
    assert.equal(sanitizeSuggestionText('0212345678 입니다'), null);
    assert.equal(sanitizeSuggestionText('10월 28일 14시 30분 도착 예정입니다'), '10월 28일 14시 30분 도착 예정입니다');
  });

  it('가림 표시가 들어간 문장은 제거', () => {
    assert.equal(sanitizeSuggestionText('[연락처]로 연락드리겠습니다'), null);
    assert.equal(sanitizeSuggestionText('[주소]로 가겠습니다'), null);
  });

  it('40자 클립 (코드 포인트 기준)', () => {
    const long = '가'.repeat(50);
    const result = sanitizeSuggestionText(long);
    assert.equal(Array.from(result).length, 40);
  });

  it('문자열이 아니거나 비면 null', () => {
    assert.equal(sanitizeSuggestionText(42), null);
    assert.equal(sanitizeSuggestionText('   '), null);
    assert.equal(sanitizeSuggestionText('🙏'), null);
  });
});

describe('sanitizeSuggestions — 4개 보정', () => {
  it('AI 4개 그대로 · aiCount 4', () => {
    const raw = ['네, 가능합니다.', '죄송하지만 어렵습니다.', '몇 시쯤 가능할까요?', '확인 후 연락드리겠습니다.'];
    const result = sanitizeSuggestions(raw, { fallback: REQUESTER_FALLBACK });
    assert.deepEqual(result.suggestions, raw);
    assert.equal(result.aiCount, 4);
  });

  it('필터·중복 제거 후 부족분은 규칙 칩 → 공통 문구 순으로 채운다', () => {
    const raw = ['네, 가능합니다.', '네 가능합니다', '010-1234-5678로 주세요', '😀'];
    const result = sanitizeSuggestions(raw, { fallback: REQUESTER_FALLBACK });
    assert.equal(result.aiCount, 1);
    assert.deepEqual(result.suggestions, ['네, 가능합니다.', '취소 부탁드립니다', '시간 변경 부탁드립니다', '연락 부탁드립니다']);
  });

  it('AI가 규칙 칩과 같은 문장을 내면 fallback에서 건너뛴다', () => {
    const raw = ['연락 부탁드립니다.', '취소 부탁드립니다'];
    const result = sanitizeSuggestions(raw, { fallback: REQUESTER_FALLBACK });
    assert.equal(result.aiCount, 2);
    assert.deepEqual(result.suggestions, ['연락 부탁드립니다.', '취소 부탁드립니다', '시간 변경 부탁드립니다', '잠시만 기다려 주세요']);
  });

  it('5개 이상이면 앞 4개만', () => {
    const raw = ['가나', '다라', '마바', '사아', '자차'];
    const result = sanitizeSuggestions(raw, { fallback: REQUESTER_FALLBACK });
    assert.deepEqual(result.suggestions, ['가나', '다라', '마바', '사아']);
  });

  it('배열이 아니면 AI 0개 → 규칙 4개', () => {
    const result = sanitizeSuggestions(null, { fallback: REQUESTER_FALLBACK });
    assert.equal(result.aiCount, 0);
    assert.equal(result.suggestions.length, 4);
    assert.deepEqual(result.suggestions, REQUESTER_FALLBACK.slice(0, 4));
  });
});

describe('parseSuggestionsJson', () => {
  it('{suggestions: string[]}만 통과', () => {
    assert.deepEqual(parseSuggestionsJson('{"suggestions":["a","b"]}'), ['a', 'b']);
    assert.equal(parseSuggestionsJson('{"suggestions":"a"}'), null);
    assert.equal(parseSuggestionsJson('["a"]'), null);
    assert.equal(parseSuggestionsJson('{"suggest'), null);
  });
});

describe('suggestionDedupeKey', () => {
  it('공백·문장부호 무시', () => {
    assert.equal(suggestionDedupeKey('네, 가능합니다.'), suggestionDedupeKey('네 가능합니다'));
  });
});
