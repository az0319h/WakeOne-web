# 사무실 간식(office-snacks) 완전 제거 기획서

> Date: 2026-08-06
> Status: Completed
> Author: planner
> **선행:** [13](./13_office-snack-vote-plan.md) (Cancelled)
> **SQL:** `39` · `supabase/sql/39_office_snack_removal.sql` (구현 시)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **13** | 사무실 간식 투표 도입 — **본 plan에서 전면 폐기(Cancelled)** |
| **08** | activity log — 일반적으로 append-only이나, **본 plan 예외:** `office_snack.*` action 행 **물리 삭제** (사용자 확정) |
| **07** | dashboard/API 인가 — office-snacks 전용 guard·라우트 **제거** |
| **23** | 비품 대장 제거 — **동일 패턴 참조** (404 · TRUNCATE+DROP · log DELETE) |

---

## 한 줄 요약

사무실 간식(office-snacks) 기능을 **앱·API·middleware·활동 로그·DB**에서 완전 제거한다. `/dashboard/office-snacks/**` 및 `/api/office-snacks/**` 접근 시 **404**, 원격 `office_snack_*` 데이터는 **TRUNCATE 후 DROP**, `activity_logs`의 `office_snack.*` 행도 **삭제**한다.

---

## deep-interview 확정 (2026-08-06)

| # | 결정 |
|---|------|
| Q1 | DB 완전 제거 + **`office_snack.*` activity_logs 행도 삭제** (비품 대장 제거 plan 23과 동일) |
| Q2 | 라우트·nav **완전 삭제** → 접근 시 **404** (리다이렉트 금지) |
| Q3 | 원격 `office_snack_*` 테이블 **TRUNCATE + DROP** (백업/export 없음) |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | admin 로그인 | `/dashboard/office-snacks` 이동 | **404** Not Found · 「사무실 간식」 UI **없음** |
| AC-02 | Playwright | admin 로그인 | `/dashboard/office-snacks/1` 이동 | **404** |
| AC-03 | API | admin storageState | `GET /api/office-snacks/sessions` | **404** (라우트 미존재) |
| AC-04 | API | admin storageState | `POST /api/office-snacks/sessions` | **404** |
| AC-05 | Playwright | wake user 로그인 | 사이드바·kbar 검색 | **「사무실 간식」** / `office-snacks` nav·검색 항목 **없음** |
| AC-06 | grep | 구현 완료 | `src/features/office-snacks` `src/app/api/office-snacks` `src/app/dashboard/office-snacks` | 디렉터리·파일 **0건** |
| AC-07 | grep | 구현 완료 | `src/**` `officeSnack` `office-snacks` `office_snack` `requireOfficeSnacks` `canAccessOfficeSnacks` `OFFICE_SNACKS` | 참조 **0건** (activity log 타입·라벨·필터 포함) |
| AC-08 | grep | 구현 완료 | `middleware.ts` `disabled-routes.ts` `session.server.ts` `access-denied-toast.tsx` | office-snacks 전용 import·guard·flash **0건** |
| AC-09 | SQL/MCP | migration 적용 후 | `information_schema.tables` · `pg_views` · `pg_proc` | `office_snack_sessions` / `office_snack_candidates` / `office_snack_votes` **없음** · `office_snack_results` view **없음** · `validate_office_snack_vote_candidates` / `prevent_office_snack_vote_mutation` **없음** |
| AC-10 | SQL/MCP | migration 적용 후 | `select count(*) from activity_logs where action like 'office_snack.%' or target_type = 'office_snack'` | **0건** |
| AC-11 | Playwright | admin | `/dashboard/logs` 활동 로그 action 필터 | `office_snack.session_create` 등 `office_snack.*` 옵션 **없음** |
| AC-12 | CLI | 구현 완료 | `bunx playwright test e2e/office-snack-removal.spec.ts` · `npm run build` | green |
| AC-13 | docs | plan 저장 | `13_office-snack-vote-plan.md` Status | **Cancelled** · README 35행 등록 |

---

## In Scope

### 앱·FE

- 삭제: `src/features/office-snacks/**` (26 files)
- 삭제: `src/app/dashboard/office-snacks/**` (`page.tsx`, `[sessionId]/page.tsx`, `loading.tsx` ×2)
- 삭제: `src/config/office-snacks-routes.ts`
- 수정: `src/config/disabled-routes.ts` — `/dashboard/office-snacks` 항목 **제거** (현재 overview 리다이렉트 → 삭제 후 **404** 허용)
- 수정: `middleware.ts` — `isOfficeSnacksDashboardPath` · `canAccessOfficeSnacks` · flash redirect 분기 **제거**
- 수정: `src/contexts/nav-access.tsx` — `officeSnacks` access 분기 **제거**
- 수정: `src/types/index.ts` — `officeSnacks` nav access 타입 **제거**
- 수정: `src/components/dashboard/access-denied-toast.tsx` — office-snacks flash 키·메시지 **제거**
- 수정: `src/features/auth/api/session.server.ts` — `requireOfficeSnacksPage` / `requireOfficeSnacksSession` **제거**

> **nav-config:** 현재 `nav-config.ts`에 사무실 간식 항목 **없음** — 추가 작업 불필요. AC-05는 회귀 확인.

### API

- 삭제: `src/app/api/office-snacks/**`
  - `sessions/route.ts`, `sessions/[id]/route.ts`
  - `sessions/[id]/candidates/route.ts`, `sessions/[id]/votes/route.ts`
  - `candidates/[id]/route.ts`, `_utils.ts`

### Activity log

- 수정: `src/features/activity-logs/api/types.ts` — `office_snack.*` **ActivityAction** · `ActivityTargetType`의 `office_snack` **제거**
- 수정: `src/features/activity-logs/labels.ts` — action 라벨 7건 · `targetLabel === 'office_snack'` 분기 **제거**
- `activity-logs-table/options.tsx` — `ACTION_LABELS` 파생이므로 types/labels 제거로 자동 반영
- **DB:** migration에서 `office_snack.*` 행 DELETE (사용자 확정)

### E2E

- 신규: `e2e/office-snack-removal.spec.ts` — AC-01~05, AC-11 최소 검증 (plan 23 `asset-ledger-removal.spec.ts` 패턴)

### DB (SQL 39)

`supabase/sql/39_office_snack_removal.sql`:

1. `drop trigger if exists trg_activity_logs_no_update` (append-only 우회)
2. `delete from activity_logs where action like 'office_snack.%' or target_type = 'office_snack';`
3. `create trigger trg_activity_logs_no_update ...` (복원)
4. `drop view if exists public.office_snack_results;`
5. `truncate table public.office_snack_votes, public.office_snack_candidates, public.office_snack_sessions restart identity cascade;` (또는 FK 순서에 맞게 개별 TRUNCATE)
6. `drop table if exists public.office_snack_votes cascade;`
7. `drop table if exists public.office_snack_candidates cascade;`
8. `drop table if exists public.office_snack_sessions cascade;`
9. `drop function if exists public.validate_office_snack_vote_candidates();`
10. `drop function if exists public.prevent_office_snack_vote_mutation();`

원격 Supabase MCP `apply_migration` 적용 필수.

### 문서

- `13_office-snack-vote-plan.md` → Status: **Cancelled**
- `docs/plans/README.md` — 35행 추가, 13 Status 갱신

---

## Out Scope

- 다른 feature의 activity log 삭제
- `/dashboard/office-snacks`를 overview 등으로 **리다이렉트** (404만 허용)
- 간식 데이터 **백업/export**
- plan 13 파일 **삭제** (번호 재사용 금지 — Cancelled 유지)
- `supabase/sql/12_office_snack_vote.sql` **삭제** (히스토리 유지)
- `tasks.md` 등 레거시 메모의 「간식」 언급 정리 (코드 grep AC 범위 외)

---

## activity log (본 plan 예외)

| 구분 | 처리 |
|------|------|
| **Route CUD** | API Route 삭제 → 신규 `office_snack.*` log **발생 불가** |
| **기존 log** | migration `DELETE` — **사용자 명시 요청 (이번 한정)** |
| **UI** | 활동 로그 필터에서 office_snack action 옵션 제거 |

---

## 영향 파일 (구현 체크리스트)

```
삭제:
  src/features/office-snacks/**
  src/app/api/office-snacks/**
  src/app/dashboard/office-snacks/**
  src/config/office-snacks-routes.ts

수정:
  middleware.ts
  src/config/disabled-routes.ts
  src/contexts/nav-access.tsx
  src/types/index.ts
  src/components/dashboard/access-denied-toast.tsx
  src/features/auth/api/session.server.ts
  src/features/activity-logs/api/types.ts
  src/features/activity-logs/labels.ts

신규:
  supabase/sql/39_office_snack_removal.sql
  e2e/office-snack-removal.spec.ts
```

---

## 리스크

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | activity log 삭제는 되돌리기 어려움 | 사용자 명시 승인 · migration 1회 |
| 2 | 북마크 `/dashboard/office-snacks` 404 | 의도된 동작 (AC-01) |
| 3 | `disabled-routes` 제거 전까지 overview 리다이렉트 | FE에서 disabled 항목 제거 + 페이지 삭제로 404 보장 |

---

## 구현 순서 (root 파이프라인)

1. **designer** — 삭제 위주 · middleware/disabled-routes 정리 (UI 신규 없음)
2. **backend-dev** — SQL 39 + migration 적용 + activity log DELETE
3. **frontend-dev** — 파일 삭제·참조 제거·404 확인
4. **verifier** — spec · grep · build · 원격 DB 확인

---

## 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-06 | 최초 작성 · deep-interview A/A/A 확정 · Status Approved | planner |
