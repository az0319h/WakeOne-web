/**
 * plan 93 C-23 — 「입력 중…」 한 줄 문구 (순수 함수 · 단위 테스트 대상).
 * 0명 `''` · 1명 `A님이 입력 중…` · 2명 `A님, B님이 입력 중…` · 3명 이상 `A님 외 N명이 입력 중…`.
 * 순서는 호출자가 입력을 시작한 순으로 넘긴다. 본인은 호출자가 뺀다.
 */
export function formatTypingNames(names: readonly string[]): string {
  const list = names.filter((name) => name.trim().length > 0);
  if (list.length === 0) {
    return '';
  }
  if (list.length === 1) {
    return `${list[0]}님이 입력 중…`;
  }
  if (list.length === 2) {
    return `${list[0]}님, ${list[1]}님이 입력 중…`;
  }
  return `${list[0]}님 외 ${list.length - 1}명이 입력 중…`;
}
