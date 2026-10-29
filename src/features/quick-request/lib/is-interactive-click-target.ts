/**
 * plan 94 D-7 — 표 행·모바일 카드 전체 클릭 가드. 셀/카드 안의 버튼·링크·입력·메뉴 항목(또는 `data-no-row-click`)을 눌렀으면
 * 행 이동을 하지 않는다 (`src/components/ui/table/data-table.tsx` 내부 함수와 같은 규칙 · export 안 돼서 feature 공용으로 둔다).
 */
const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="menuitem"], [role="checkbox"], [data-no-row-click]';

export function isInteractiveClickTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(INTERACTIVE_SELECTOR));
}
