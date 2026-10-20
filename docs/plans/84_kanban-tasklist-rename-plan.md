# 칸반 — Google Tasks 목록 이름 수정

> Date: 2026-10-20
> Status: Approved
> Author: planner (`/root` · deep-interview → battle-plan → `go`)
> **신규 SQL:** 없음 — `supabase/sql/84_*` **만들지 않음**. plan 81의 `supabase/sql/83_google_tasks_connections.sql`은 **SQL 파일 번호**이며 본 plan NN=84과 무관하다.
> **선행:** [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [49](./49_live-users-presence-plan.md), [81](./81_kanban-google-tasks-plan.md)
> **번호 주석:** Phase 2 당시 leftover untracked `82_quick-request`를 피해 NN=83을 가정했으나, 저장 직전 README에 [82](./82_quick-request-plan.md)·[83](./83_quick-request-wizard-plan.md)가 **Approved·등록**되어 있어 **83은 사용하지 않는다.** 본 칸반 rename follow-up은 **84**. 82/83 퀵 요청 내용은 In에 **포함하지 않는다.**

---

## 한 줄 요약

`/dashboard/kanban` 열 메뉴 **「이름 바꾸기」** Dialog로 Google Tasks **tasklist title**만 수정한다. BE `PATCH`·`google_tasks.tasklist.update`·뮤테이션은 plan 81에 이미 있고, 이번 작업은 **FE Dialog + E2E/API AC**다.

---

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **81** | 칸반 본체 · PATCH `tasklists/[tasklistId]` · `google_tasks.tasklist.update` · `updateGoogleTasklistMutation` · AC-15는 **생성만**. **81 본문 재작성 금지** — 본 plan은 follow-up |
| **08** | CUD Route 전 HTTP 분기 `recordActivityLog`. 기존 PATCH 유지 + **전용 API AC** |
| **14** | 삭제·clear만 `AlertModal`. rename은 UPDATE → AlertModal **Out** |
| **49** | `/dashboard/kanban`은 `dashboard/layout` 하위 → **`DashboardPresenceTrack` 상속**. 페이지별 track **0건** |
| **82 / 83** | 퀵 요청. **범위 제외** · 파일 덮어쓰기 금지 |

**중복 금지:** 신규 Route·SQL·`ActivityAction` 신설 · 인라인 편집 · admin 타인 proxy · leftover 82 내용.

---

## 정책 확정 (deep-interview · battle-plan `go`)

| # | 결정 |
|---|------|
| Q1 문서 | **후속 신규 plan 84** (81 미수정). leftover/등록 82·83 퀵 요청 미사용 |
| Q2 UX | 열 메뉴 **이름 바꾸기** + Dialog. 새 목록(`new-tasklist-dialog.tsx`)과 **동일 제목 필드 패턴**. 성공 → `updateGoogleTasklistMutation` + `form.reset`. **인라인 편집 Out**. **AlertModal Out** |
| Q3 가장자리 | `@default` **이름 변경 허용** (삭제는 계속 금지) · 빈/공백 → 제출 차단 + 기존 400 「목록 제목을 입력해 주세요.」 · 같은 제목 → no-op 또는 그대로 PATCH · **title만** |
| Q4 권한·AC | **본인 목록만** (admin도 자기 칸반만). AC: 성공 · 빈 제목 차단 · 기본 목록 이름 변경 · activity log는 **API** (`PATCH` + `x-request-id`), UI `/dashboard/logs` 필수 아님 |

---

## 목표 & 완료 기준

- **목표:** 칸반 열(목록) 이름을 Dialog로 수정하고, 헤더가 새로고침 없이 갱신된다.
- **완료 기준:** 아래 AC-01~06 전부 green · `bunx playwright test` (kanban + google-tasks activity API) · tsc · lint · build · `npm run e2e:cleanup` exit 0.

---

## 범위 (In / Out)

### In

| # | 영역 |
|---|------|
| 1 | 열 `⋯` 메뉴 **이름 바꾸기** + Dialog (`useAppForm` · 제목 필드 · 현재 title 초기값) |
| 2 | 기존 `updateGoogleTasklistMutation` 연결 (`onSettled` → `googleTasksKeys.all` invalidate 유지) |
| 3 | 성공 시 토스트 · `form.reset` · Dialog 닫기. 취소/실패 시 reset **금지** |
| 4 | `@default` / `isDefault` 목록도 이름 바꾸기 가능. 삭제 메뉴 disabled 유지 |
| 5 | 빈/공백 제목: 클라이언트 검증 + 기존 PATCH 400 문구 |
| 6 | Playwright AC-01~03 · API AC-04~05 · presence grep AC-06 |

### Out

| 항목 | 비고 |
|------|------|
| 신규 Route / SQL / `ActivityAction` | PATCH·로그·action 이미 81에 존재 |
| 인라인 헤더 편집 | Q2 |
| rename용 `AlertModal` | 파괴 작업 아님 (plan 14 해당 없음) |
| admin `tasks_user` proxy · 타인 목록 | plan 81 Out 유지 |
| title 외 tasklist 필드 | notes/updated 등 UI 없음 |
| plan 81 재작성 · leftover 82/83 퀵 요청 | — |
| Vercel env · OAuth unverified-app · deploy | — |
| 생성·삭제·clear·DnD 재설계 | 81 유지 |

---

## UI 요구사항

```
열 헤더: [제목(정적)] [N]  [⋯ 메뉴] [grip]
메뉴:
  이름 바꾸기          ← 본 plan
  완료 항목 삭제
  목록 삭제 | 기본 목록은 삭제할 수 없음
```

- **트리거:** `DropdownMenuItem` 「이름 바꾸기」 (`data-testid` 권장: `kanban-rename-tasklist-menu-item`). 기본 목록에도 **표시·활성**.
- **Dialog:** `new-tasklist-dialog.tsx`와 동일 패턴 — `useAppForm` + `FormTextField` name=`title` · label **목록 제목** · 스키마 `trim().min(1, '목록 제목을 입력해 주세요.')` (+ 생성과 같이 max 120 권장). 제목 「이름 바꾸기」(또는 동등). 저장/취소.
- **초기값:** 현재 `tasklist.title`. UPDATE 성공 후 `form.reset` (마운트 default 또는 최신 title).
- **취소:** Dialog만 닫기 · reset **금지**.
- **실패:** validation·4xx·5xx 시 reset 금지.
- **아이콘:** `Icons.*` only. `src/components/ui` 수정 금지.
- **로딩:** mutation Button `isPending` (기존 Button Spinner). 신규 페이지 로딩 없음.

---

## API / DB 요구사항

**신규 Route·SQL 없음.** 재사용만.

| Method | Path | Google | action | 본 plan |
|--------|------|--------|--------|---------|
| PATCH | `/api/google-tasks/tasklists/[tasklistId]` | `tasklists.patch` `{ title }` | `google_tasks.tasklist.update` | **재사용** — body `title` trim 후 빈 값 400 「목록 제목을 입력해 주세요.」 |
| — | FE `updateGoogleTasklist` → 위 PATCH | — | — | 기존 `service.ts` / `mutations.ts` |

- 세션: `requireSession` · active · **본인** `google_tasks_connections`만 (plan 81).
- Mock: `patchTasklist`는 `@default` 제목 변경 허용 (삭제만 `DEFAULT_LIST` 차단) — **유지**.
- 같은 제목: no-op 또는 그대로 PATCH. 전용 AC 없음.

---

## 활동 감사 로그 (CUD In)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

**신규 action 없음.** 기존 PATCH가 전 분기 기록 중. 본 plan은 **전용 API AC**(AC-04·AC-05)만 추가.

### 기록 연동

| Route | action | 분기 (이미 구현) |
|-------|--------|------------------|
| `PATCH /api/google-tasks/tasklists/[tasklistId]` | `google_tasks.tasklist.update` | 401/403 (`logGoogleTasksAuthFailure`) · 400 잘못된 JSON · 400 빈 title · 200 성공 · 404/502/500 (`googleTasksMutationErrorResponse`) |

공통: Handler 진입 `requestId` → 각 return `recordActivityLog` → `x-request-id`. metadata allowlist: `tasklist_id`, `title`(2xx), `error_code`, `message` — token 금지.

READ(GET tasklists) · 로그인/로그아웃 **Out**.

---

## 영향 파일 & 패턴

| 팀 | 경로 | 이유 |
|----|------|------|
| FE | `src/features/kanban/components/google-tasks-column.tsx` | 메뉴 + Dialog 연동 |
| FE | `src/features/kanban/components/new-tasklist-dialog.tsx` | 패턴 참조 (복제·공유 스키마) |
| FE | `src/features/google-tasks/api/mutations.ts` | **호출만** — `updateGoogleTasklistMutation` 이미 있음 |
| verifier | `e2e/kanban/cud.spec.ts` · `e2e/kanban/helpers.ts` | AC-01~03 |
| verifier | `e2e/api/google-tasks-activity-log.spec.ts` | AC-04~05 (`task.create`만 있던 파일에 `tasklist.update` 추가) |

패턴: 컴포넌트는 `useMutation({ ...updateGoogleTasklistMutation, onSuccess: 토스트·reset·닫기 })`. invalidate는 mutations `onSettled`. service 직접 호출 금지.

---

## AC (Given-When-Then)

공통: `E2E_GOOGLE_TASKS_MOCK=1` · active `system_role=user` `storageState` · `/dashboard/kanban`은 `dashboard/layout` 하위.

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| **AC-01** | Playwright | 목록 「업무」가 `/dashboard/kanban`에 보일 때 | 열 메뉴 **이름 바꾸기** → 「업무-수정」저장 | Dialog 닫힘 · `kanban-column-title`이 **업무-수정** · refetch 후에도 유지 · 성공 토스트 |
| **AC-02** | Playwright | 이름 바꾸기 Dialog가 열린 때 | 제목을 비우거나 공백만 넣고 제출 | 「목록 제목을 입력해 주세요.」 표시 · 제출 **차단** · 열 제목 불변 |
| **AC-03** | Playwright | `isDefault` 기본 목록이 보일 때 | 이름 바꾸기 → 새 제목 저장 | 헤더가 새 제목. 삭제 메뉴는 계속 **disabled** (「기본 목록은 삭제할 수 없음」) |
| **AC-04** | API mock | user 세션 | `PATCH /api/google-tasks/tasklists/{id}` `{ "title": "…" }` 성공 | **200** · 헤더 **`x-request-id`** · `activity_logs` action **`google_tasks.tasklist.update`** status **2xx** |
| **AC-05** | API mock | user 세션 | 같은 Route에 빈 title PATCH | **400** · 동일 request id · `google_tasks.tasklist.update` **4xx** 행 |
| **AC-06** | grep/구현 | 구현 완료 | `src/app/dashboard/kanban` 트리 | `dashboard/layout.tsx` **상속** · kanban 전용 `DashboardPresenceTrack` **0건** (plan 49) |

**AC 개수:** 6. 권한(타인 목록)은 plan 81 AC-25/26 유지 — 본인 connection만 mutate.

---

## 리스크 & 완화책

| 등급 | 리스크 | 완화 |
|------|--------|------|
| MED | 헤더 DnD 핸들과 편집 포커스 충돌 | 인라인 Out · 메뉴→Dialog만 |
| MED | 생성 Dialog 스키마와 불일치 | `new-tasklist-dialog` title 스키마 재사용 |
| LOW | 같은 제목 PATCH가 불필요 로그 | 허용 · 전용 AC 없음 |
| LOW | NN 82/83 퀵 요청과 혼동 | 본 파일만 84 · 82/83 미수정 |

**롤백:** 메뉴 항목·Dialog만 제거. PATCH Route는 plan 81 자산 — 되돌리지 않음.

---

## 열린 질문

없음 (인터뷰·battle-plan `go`로 닫힘).

---

## 팀 handoff

| 순서 | 팀 | 입력 |
|------|-----|------|
| — | **designer** | **생략.** UX가 「새 목록 Dialog와 동일」로 확정. 신규 레이아웃 없음 |
| — | **backend-dev** | **생략.** PATCH·빈 title 400·전 분기 로그·mock `@default` rename 이미 존재. 신규 Route/SQL 없음 |
| 1 | **frontend-dev** | 본 plan UI · `google-tasks-column` · 기존 mutation · 성공 reset |
| 2 | **verifier** | AC-01~06 · `e2e/kanban` + `e2e/api/google-tasks-activity-log.spec.ts` · cleanup |

`/root` 다음 단계: 사용자 **`승인`** (정확히 이 두 글자) 후 frontend-dev → verifier. planner는 팀을 호출하지 않는다. `go`는 plan 저장 허가만 — **구현 승인 아님**.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-20 | 최초 작성 (NN=84 · 82/83 퀵 요청과 번호 충돌 회피) | planner |
