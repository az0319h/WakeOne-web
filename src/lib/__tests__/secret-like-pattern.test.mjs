import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { containsSecretLike } from '../secret-like-pattern.ts';

/** plan 103 AC-21·49 — 비밀번호·로그인 패턴 (서버 400 · 이관 칸 통째 제외 공용) */

describe('containsSecretLike', () => {
  it('AC-21 예시 3개는 막힌다', () => {
    for (const value of ['PW: abc', '비밀번호 1234', 'ID: x@y']) {
      assert.equal(containsSecretLike(value), true, value);
    }
  });

  it('그 밖 표현', () => {
    for (const value of ['password=1', 'passwd : x', '비번 알려줌', '아이디: hong', 'login: a', 'pw:1']) {
      assert.equal(containsSecretLike(value), true, value);
    }
  });

  it('일반 메모는 통과', () => {
    for (const value of ['연 결제 갱신 확인', '대상자(원문): 홍길동', 'android 앱', '', null, undefined]) {
      assert.equal(containsSecretLike(value), false, String(value));
    }
  });
});
