# 비품 대장 완전 제거 기획서

> Date: 2026-07-14
> Status: Completed
> Author: planner
> **선행:** [15](./15_asset-ledger-plan.md) (Cancelled)
> **SQL:** `30` · `supabase/sql/30_asset_ledger_removal.sql` (구현 시)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **15** | 비품 대장 도입 — **본 plan에서 전면 폐기(Cancelled)** |
| **08** | activity log — 일반적으로 append-only이나, **본 plan 예외:** `asset.*` action 행 **물리 삭제** (사용자 확정) |
| **07** | dashboard/API 인가 — 비품 전용 guard·라우트 **제거** |

---

## 한 줄 요약

비품 대장 기능을 **앱·API·네비·E2E·DB·활동 로그**에서 완전 제거한다. `/dashboard/product` 및 `/api/asset-items/**` 접근 시 **404**, 원격 `asset_items` 데이터는 **TRUNCATE 후 DROP**, `activity_logs`의 `asset.create` / `asset.update` / `asset.delete` 행도 **삭제**한다.

---

## deep-interview 확정 (2026-07-14)

| # | 결정 |
|---|------|
| Q1 | DB 완전 제거 + **`asset.*` activity_logs 행도 삭제** (이번 작업 한정 예외) |
| Q2 | 라우트·nav **완전 삭제** → 접근 시 **404** |
| Q3 | 원격 `asset_items` **TRUNCATE + DROP** (복구 없음) |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | admin 로그인 | `/dashboard/product` 이동 | **404** Not Found 페이지 표시 · 비품 대장 UI **없음** |
| AC-02 | API | admin storageState | `GET /api/asset-items` | **404** (라우트 미존재) |
| AC-03 | Playwright | wake user 로그인 | 사이드바 네비 확인 | **「비품 대장」** 메뉴 항목 **없음** |
| AC-04 | grep | 구현 완료 | `src/features/asset-ledger` `src/app/api/asset-items` `src/app/dashboard/product` | 디렉터리·파일 **0건** (삭제됨) |
| AC-05 | grep | 구현 완료 | `src/**` `assetLedger` `requireAssetLedger` `ASSET_LEDGER` | 참조 **0건** (activity log 타입·필터 옵션 제거 포함) |
| AC-06 | SQL/MCP | migration 적용 후 | `information_schema.tables` · `pg_proc` | `asset_items` 테이블 **없음** · `suggest_asset_number` · `extract_asset_prefix` 함수 **없음** |
| AC-07 | SQL/MCP | migration 적용 후 | `select count(*) from activity_logs where action in ('asset.create','asset.update','asset.delete')` | **0건** |
| AC-08 | Playwright | admin | `/dashboard/logs` 활동 로그 action 필터 옵션 확인 | `asset.create` / `asset.update` / `asset.delete` 옵션 **없음** |
| AC-09 | CLI | 구현 완료 | `bunx playwright test` (asset-ledger spec **삭제** 또는 제거 검증 spec green) · `npm run build` | green |
| AC-10 | docs | plan 저장 | `15_asset-ledger-plan.md` Status | **Cancelled** · README 22행 등록 |

---

## In Scope

### 앱·FE

- 삭제: `src/features/asset-ledger/**`
- 삭제: `src/app/dashboard/product/**` (`page.tsx`, `loading.tsx`, `[productId]/page.tsx`)
- 삭제: `src/config/asset-ledger-routes.ts`
- 수정: `src/config/nav-config.ts` — 비품 대장 nav 항목 제거
- 수정: `src/contexts/nav-access.tsx` — `assetLedger` access 제거
- 수정: `src/types/index.ts` — `assetLedger` nav access 타입 제거
- 수정: `src/hooks/use-breadcrumbs.tsx` — product/비품 breadcrumb 제거
- 수정: `src/components/dashboard/access-denied-toast.tsx` — asset-ledger flash 키 제거
- 수정: `src/features/auth/api/session.server.ts` — `requireAssetLedgerPage` / `requireAssetLedgerSession` 제거

### API

- 삭제: `src/app/api/asset-items/**` (route, `[id]`, `suggest-number`, `users`, `_utils`)

### Activity log

- 수정: `src/features/activity-logs/api/types.ts` — `asset.create` / `asset.update` / `asset.delete` **ActivityAction에서 제거**
- 수정: `activity-logs-table/options.tsx` — asset action 필터 옵션 제거
- **DB:** migration에서 `asset.*` 행 DELETE (사용자 확정)

### E2E

- 삭제: `e2e/asset-ledger/**`
- 수정: `playwright.config.ts` — asset-ledger project 매칭 제거 (해당 시)
- 신규(선택): `e2e/asset-ledger-removal.spec.ts` — AC-01~03, AC-08 최소 검증

### DB (SQL 30)

`supabase/sql/30_asset_ledger_removal.sql`:

1. `DELETE FROM activity_logs WHERE action IN ('asset.create','asset.update','asset.delete');`
2. `DROP TABLE IF EXISTS public.asset_items CASCADE;`
3. `DROP FUNCTION IF EXISTS public.suggest_asset_number(text);`
4. `DROP FUNCTION IF EXISTS public.extract_asset_prefix(text);`
5. (정책·트리거는 CASCADE로 정리)

원격 Supabase MCP `apply_migration` 적용 필수.

### 문서

- `15_asset-ledger-plan.md` → Status: **Cancelled**
- `docs/plans/README.md` — 22행 추가, 15 Status 갱신

---

## Out Scope

- 다른 feature의 activity log 삭제
- `/dashboard/product`를 다른 페이지로 **리다이렉트** (404만 허용)
- 비품 데이터 **백업/export**
- plan 15 파일 **삭제** (번호 재사용 금지 — Cancelled 유지)

---

## activity log (본 plan 예외)

| 구분 | 처리 |
|------|------|
| **Route CUD** | API Route 삭제 → 신규 `asset.*` log **발생 불가** |
| **기존 log** | migration `DELETE` — **사용자 명시 요청 (이번 한정)** |
| **UI** | 활동 로그 필터에서 asset action 옵션 제거 |

---

## 영향 파일 (구현 체크리스트)

```
삭제:
  src/features/asset-ledger/**
  src/app/api/asset-items/**
  src/app/dashboard/product/**
  src/config/asset-ledger-routes.ts
  e2e/asset-ledger/**

수정:
  src/config/nav-config.ts
  src/contexts/nav-access.tsx
  src/types/index.ts
  src/hooks/use-breadcrumbs.tsx
  src/components/dashboard/access-denied-toast.tsx
  src/features/auth/api/session.server.ts
  src/features/activity-logs/api/types.ts
  src/features/activity-logs/components/activity-logs-table/options.tsx
  playwright.config.ts (해당 시)

신규:
  supabase/sql/30_asset_ledger_removal.sql
  e2e/asset-ledger-removal.spec.ts (선택·권장)
```

---

## 리스크

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | activity log 삭제는 되돌리기 어려움 | 사용자 명시 승인 · migration 1회 |
| 2 | 북마크 `/dashboard/product` 404 | 의도된 동작 (AC-01) |
| 3 | wake 사용자 nav 변화 | AC-03으로 검증 |

---

## 구현 순서 (root 파이프라인)

1. **designer** — 삭제 위주 · nav 정리 (UI 신규 없음)
2. **backend-dev** — SQL 30 + migration 적용 + activity log DELETE
3. **frontend-dev** — 파일 삭제·참조 제거·404 확인
4. **verifier** — spec · grep · build · 원격 DB 확인

---

## 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-07-14 | 최초 작성 · deep-interview 확정 · Status Approved | planner |
