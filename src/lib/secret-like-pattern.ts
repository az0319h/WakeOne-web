/**
 * plan 103 — 비밀번호·로그인 정보로 보이는 문구 패턴 (서버 검증 · 엑셀 이관 스크립트 공용 단일 상수).
 *
 * - Route: 구독·비품 `manager_memo`에 이 패턴이 있으면 400 「비밀번호·로그인 정보는 저장할 수 없어요.」 (AC-21)
 * - 이관(`scripts/asset-ledger-import/run.mjs`): 패턴이 든 엑셀 칸은 **통째로 버린다**(부분 마스킹 금지 · AC-49)
 *
 * 오탐(예: 「아이디어:」)은 보안 우선으로 막는다 — 사용자가 표현을 바꾸면 된다.
 * Node(`node --test`·이관 스크립트)에서도 import하므로 path alias·런타임 의존성을 두지 않는다.
 */
export const SECRET_LIKE_PATTERN =
  /(pw|password|passwd|비밀번호|비번|아이디|login|\bid\b)\s*[:=]|비밀번호|비번/i;

export const SECRET_LIKE_MESSAGE = '비밀번호·로그인 정보는 저장할 수 없어요.';

export function containsSecretLike(value: string | null | undefined): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  return SECRET_LIKE_PATTERN.test(value);
}
