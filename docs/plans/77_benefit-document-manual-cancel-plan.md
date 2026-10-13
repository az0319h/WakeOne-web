# 복지비 문서 수동 취소·복구 기획서

> Date: 2026-10-13
> Status: Completed
> Author: planner
> **선행:** [08](./08_activity-audit-log-plan.md), [73](./73_benefits-url-filters-plan.md), [74](./74_admin-my-benefits-proxy-plan.md), [75](./75_benefits-admin-inactive-roster-plan.md), [76](./76_hr-benefits-manager-access-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **08** | Approved | cancel/restore Route **CUD** → `recordActivityLog` 전 분기 |
| **73** | Approved | admin URL 필터·테이블 shell **유지** |
| **76** | Completed | **admin + wake 인사팀** 동일 권한 |
| **SQL 73** | Applied | `benefit_documents` — soft cancel 컬럼 **추가 migration** |

---

## 한 줄 요약

Flex에서 이미 반영된 복지비 문서를, 신청자 쪽 취소 등으로 **관리자·인사팀이 수동 취소(soft)** 하고 **복구**할 수 있게 한다. 취소 건은 **합계·한도·차트에서 제외**, 관리 목록에는 **「취소됨」** 표시, **내 복지비**에는 **「취소됨」** 표시·금액 제외.

---

## 정책 확정안 (deep-interview)

| # | 항목 | 확정 |
|---|------|------|
| Q1 | **관리 UI** | **A** — 같은 달 목록에 취소 건 유지 · 합계 제외 · **shadcn 권장 표현** (아래 UI) |
| Q2 | **내 복지비** | **B** — 목록에 **「취소됨」** · 월 합계·한도 **제외** |
| Q3 | **자동 import 재수신** | **A (권장·기본)** — 기존 행이 있으면 **duplicate** · 자동 복구 **하지 않음** · 수동 **복구**만 (아래 §Q3 설명) |
| Q4 | **확인 UX** | **AlertModal** — 문서번호·금액·신청 유형 포함 한국어 확인 |
| Q5 | **권한** | `canAccessBenefitsAdmin` — **admin + wake 인사팀** |

### Q3 쉬운 설명 (운영)

자동화는 Gmail/Flex에서 승인 메일을 읽어 `document_number`로 **이미 DB에 있으면 “중복”** 으로 넣지 않습니다.
인사팀이 **우리 사이트에서만 취소**해 두면, DB에는 행이 남고 **금액만 빠진 상태**입니다.
나중에 **같은 문서번호**로 자동 import가 다시 오면:

- **A (본 plan):** 여전히 “이미 있음(duplicate)” → **자동으로 다시 살아나지 않음**. Flex에서 진짜로 다시 승인된 거면 **관리 화면 [복구]**.
- (대안 B) import가 오면 **자동 복구** — 실수로 취소된 문서가 메일만 다시 돌면 **원치 않게 복구**될 수 있어 **기본값은 A**.

### UI 권장 (shadcn New York · Q1)

| 요소 | 구현 |
|------|------|
| 취소 행 | `opacity` + 금액·제목 `line-through` |
| 상태 | `Badge variant="outline"` + `text-muted-foreground` — **「취소됨」** (한도 초과 `destructive`와 구분) |
| 액션 | 활성: `Button variant="ghost"` **취소** · 취소됨: **복구** |
| 확인 | `@/components/modal/alert-modal` `AlertModal` |
| 데모 | Cursor canvas [benefits-cancelled-status-ui.canvas.tsx](/Users/hoon/.cursor/projects/Users-hoon-Desktop-Wake-Auto/canvases/benefits-cancelled-status-ui.canvas.tsx) |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | admin · 활성 benefit 문서 D | 복지비 관리에서 D 행 **취소** → AlertModal 확인 | D 상태 **취소됨** · 구성원 **total_used**에서 D.amount **제외** · 차트/요약 **동기** |
| AC-02 | Playwright | AC-01 후 | D 행 **복구** → 확인 | D 활성 · total_used **복원** |
| AC-03 | Playwright | 취소된 D | 신청자 **내 복지비** 동일 월 | D 행 **취소됨** Badge · 합계 **D 제외** |
| AC-04 | Playwright | wake 인사팀 H | D 취소·복구 | admin과 **동일** |
| AC-05 | Playwright | 일반 user W | 복지비 관리 | 취소/복구 버튼 **없음** |
| AC-06 | API | admin | `PATCH /api/benefits/documents/:id/cancel` | 200 · `cancelled_at` 설정 · `x-request-id` · `benefit.document_cancel` log |
| AC-07 | API | admin | `PATCH .../restore` on active | 400 또는 409 |
| AC-08 | API | admin | `PATCH .../restore` on cancelled | 200 · `benefit.document_restore` log |
| AC-09 | API | user W | cancel API | **403** |
| AC-10 | API | service token | `POST /api/benefits/import` 동일 document_number · 행 **cancelled** | **duplicate** · `cancelled_at` **유지** (Q3-A) |
| AC-11 | Playwright | admin | plan 73·75·76 회귀 | URL 필터·비활성 명단·HR nav **유지** |

---

## 범위 (In / Out)

### In Scope

| # | 영역 |
|---|------|
| 1 | SQL: `cancelled_at`, `cancelled_by` on `benefit_documents` |
| 2 | `listMonthDocuments` / `summarizeDocuments` — active vs all-for-admin-list |
| 3 | API cancel + restore Route · `requireBenefitsAdminSession` |
| 4 | Activity: `benefit.document_cancel`, `benefit.document_restore` |
| 5 | FE `mutations.ts` · `DocumentRow` 액션 · `stopPropagation` on Flex row click |
| 6 | `my-benefits-dashboard` 취소 건 표시 (Q2-B) |
| 7 | E2E + API specs |

### Out of Scope

| 항목 |
|------|
| Flex/Gmail 자동화 로직 변경 (duplicate 정책만 AC-10으로 고정) |
| 물리 DELETE |
| import 시 자동 복구 (Q3-B) |

---

## API (초안)

| Method | Path | Body |
|--------|------|------|
| PATCH | `/api/benefits/documents/[id]/cancel` | — |
| PATCH | `/api/benefits/documents/[id]/restore` | — |

응답: 갱신된 document 요약 또는 `{ success, data: { id, cancelled_at } }` — FE invalidate `benefitsKeys.all`.

---

## 검증 (verifier)

- `bunx playwright test e2e/benefits/benefit-document-cancel*.spec.ts`
- benefits 회귀 · build
