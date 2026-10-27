/** plan 93 U-15 · AC-37 — 배지 숫자 (100 이상은 「99+」). 사이드바·목록·상세 「대화 N」 공용 */
export const UNREAD_BADGE_MAX = 99;

export function formatUnreadBadge(count: number): string {
  if (!Number.isFinite(count) || count <= 0) {
    return '0';
  }
  return count > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : String(Math.floor(count));
}
