import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPhoneDisplay, parsePhoneDigits, PHONE_REGEX } from '../phone.ts';
import { PHONE_INPUT_ERROR, PHONE_INPUT_HINT, PHONE_INPUT_PLACEHOLDER } from '../phone-messages.ts';

/**
 * plan 97 AC-17 — 실행: `node --test src/lib/__tests__/phone.test.mjs`
 */

describe('PHONE_REGEX', () => {
  it('9~11자리 전부 true', () => {
    assert.equal(PHONE_REGEX.test('021234567'), true);
    assert.equal(PHONE_REGEX.test('0311234567'), true);
    assert.equal(PHONE_REGEX.test('01012345678'), true);
  });

  it('8·12자리·하이픈 포함 false', () => {
    assert.equal(PHONE_REGEX.test('12345678'), false);
    assert.equal(PHONE_REGEX.test('010123456789'), false);
    assert.equal(PHONE_REGEX.test('010-1234-5678'), false);
    assert.equal(PHONE_REGEX.test(''), false);
  });
});

describe('parsePhoneDigits', () => {
  it('하이픈·공백 제거 · 최대 자릿수 slice 유지', () => {
    assert.equal(parsePhoneDigits('010-1234-5678'), '01012345678');
    assert.equal(parsePhoneDigits('02-123-4567'), '021234567');
    assert.equal(parsePhoneDigits(' 031 123 4567 '), '0311234567');
    assert.equal(parsePhoneDigits('010123456789'), '01012345678');
  });
});

describe('formatPhoneDisplay', () => {
  it('02 지역번호 2자리', () => {
    assert.equal(formatPhoneDisplay('0212345678'), '02-1234-5678');
    assert.equal(formatPhoneDisplay('021234567'), '02-123-4567');
  });

  it('그 외 3자리', () => {
    assert.equal(formatPhoneDisplay('0311234567'), '031-123-4567');
    assert.equal(formatPhoneDisplay('01012345678'), '010-1234-5678');
  });

  it('9자리 비-02 · 9~11자리 밖은 그대로', () => {
    assert.equal(formatPhoneDisplay('012345678'), '012345678');
    assert.equal(formatPhoneDisplay('1234'), '1234');
    assert.equal(formatPhoneDisplay('02123456789'), '021-2345-6789');
  });

  it('하이픈 입력도 숫자만 보고 포맷', () => {
    assert.equal(formatPhoneDisplay('02-123-4567'), '02-123-4567');
    assert.equal(formatPhoneDisplay('010 1234 5678'), '010-1234-5678');
  });

  it('빈 값은 null', () => {
    assert.equal(formatPhoneDisplay(null), null);
    assert.equal(formatPhoneDisplay(undefined), null);
    assert.equal(formatPhoneDisplay(''), null);
  });
});

describe('phone messages', () => {
  it('문구 상수 (고정 자릿수 문구 없음)', () => {
    assert.equal(PHONE_INPUT_ERROR, '연락처는 숫자 9~11자리로 입력해 주세요.');
    assert.equal(PHONE_INPUT_HINT, '숫자만 9~11자리');
    assert.equal(PHONE_INPUT_PLACEHOLDER, '010-1234-5678 / 02-123-4567');
    assert.equal(/(^|[^~])1{2}자리/.test(PHONE_INPUT_ERROR), false);
  });
});
