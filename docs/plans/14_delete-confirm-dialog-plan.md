> Date: 2026-06-09
> Status: Completed
> Author: root

# 14 — 삭제 확인 Dialog 전역 규칙

## 목표

프로덕션 UI에서 데이터 삭제·제거 전 **반드시 Dialog 확인**을 사용하고, `window.confirm` / `window.alert` 사용을 금지한다.

## 범위

| In | Out |
|----|-----|
| `core-conventions.mdc` 전역 규칙 | BE/API 변경 |
| 에이전트: `frontend-dev`, `designer`, `planner`, `verifier` | 데모 폼 `alert()` (성공 토스트) |
| office-snacks 회차·후보 삭제 UI | 신규 공통 훅 (기존 `AlertModal` 재사용) |

## 표준 패턴

- 컴포넌트: `@/components/modal/alert-modal` → `AlertModal`
- 참조: `users-table/cell-action.tsx`, `product-tables/cell-action.tsx`
- 흐름: 삭제 클릭 → `open` state → `AlertModal` → 확인 시 `mutate` + `loading={isPending}`

## AC

| ID | 기준 |
|----|------|
| AC-DEL-01 | `src/features`, `src/app`에 `window.confirm` **0건** |
| AC-DEL-02 | office-snacks 회차 삭제 시 `AlertModal` 표시 후 확인 시에만 DELETE |
| AC-DEL-03 | office-snacks 후보 삭제 시 `AlertModal` 표시 후 확인 시에만 DELETE |
| AC-DEL-04 | verifier `rg "window\.confirm"` grep 통과 |

## activity log

해당 없음 (FE 규칙·UI만 변경).
