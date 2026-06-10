# 비품 대장 (Asset Ledger) 기획서

> Date: 2026-06-10
> Status: Approved
> Author: planner
> **SQL:** `13` · `supabase/sql/13_asset_ledger.sql` (구현 시)
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [13](./13_office-snack-vote-plan.md) (wake RBAC·flash 패턴), [14](./14_delete-confirm-dialog-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **07** | `/api/*` `requireSession` · dashboard 인가 defense in depth |
| **08** | CUD Route **전 HTTP 분기** `recordActivityLog` · `/dashboard/logs` 검증 |
| **13** | `affiliation = wake` OR `admin` 접근 · access-denied flash cookie (쿼리 `accessDenied` 금지) |
| **14** | DELETE 전 `AlertModal` · `window.confirm` 금지 |
| **products (데모)** | `/dashboard/product` · `/api/products` mock — **본 plan에서 완전 교체·제거** |

**중복 금지:** READ(목록·상세 GET) activity log **Out**. 엑셀/CSV 일괄 이관 **Out (v1)**.

---

## 한 줄 요약

`/dashboard/product` 데모를 **비품 대장**으로 교체한다. wake 소속 전원이 행을 등록·수정하고, **삭제는 등록자·admin만** 가능하며, 모든 CUD는 `activity_logs`에 남긴다. 실사용자는 **Users 프로필 선택**, 사용처는 **`profiles.department` 동적 집계 기반 부서 선택**, 카테고리는 **text(nullable) + 추천값 제시 + 신규 입력 허용**, 목록은 **자산번호·자산명 검색**과 **상태/카테고리 단일 선택 필터(조합 가능)** 를 지원한다.

---

## 목표 & 완료 기준

### 목표

- 엑셀 `비품 대장_260526.xlsx` 열 구조를 웹 테이블·Sheet 폼으로 재현한다.
- 빈 장부에서 시작해 wake 전원이 협업으로 데이터를 채운다.
- 등록자·최종 수정자·실사용자(프로필)를 UI·DB에 명시한다.
- 삭제는 물리 삭제 + activity log로 추적한다.

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | wake user A 로그인 | `/dashboard/product` 이동 | 페이지 제목 **「비품 대장」** · 빈 목록 또는 등록 행 표시 · 데모 Product 이미지 컬럼 **없음** · 카테고리 컬럼/필터 표시 |
| AC-02 | Playwright | wake user A | **등록** Sheet에서 필수값 입력 후 저장 | 목록에 신규 행 · `생성자` A 표시 · `자산번호` 자동 추천값 적용(수정 가능했음) · 사용처 필드는 `profiles.department` 기반 **부서 선택** |
| AC-03 | Playwright | wake user A가 등록한 행 존재, wake user B 로그인 | B가 동일 행 **수정** Sheet 저장 | 필드 반영 · `최종 수정자` B · `생성자` A 유지 · 카테고리 추천값 외 신규 입력값도 저장 가능 |
| AC-04 | Playwright | A가 등록한 행, B 로그인 | B가 삭제 시도 | 삭제 버튼 **미노출** 또는 확인 후 **403** · 행 유지 |
| AC-05 | Playwright | A가 등록한 행, A 로그인 | `AlertModal` 확인 후 삭제 | 행 목록에서 **제거** · `/dashboard/logs`에 `asset.delete` **2xx** 행 |
| AC-06 | Playwright | admin 로그인 | A가 등록한 행 삭제 | 삭제 성공 · `asset.delete` log · actor admin |
| AC-07 | Playwright | `affiliation ≠ wake` non-admin | `/dashboard/product` 또는 API | overview redirect + flash 토스트 · API **403** |
| AC-08 | API/grep | 임의 CUD 1건 | `/dashboard/logs` | 해당 `asset.create` / `asset.update` / `asset.delete` 행 · 실패(403) 시에도 log |
| AC-09 | grep | — | `src/features/**` `src/app/**` | `window.confirm` **0건** (삭제는 `AlertModal`) |
| AC-10 | Playwright/API | 카테고리 `NULL` 행 1건, 카테고리 값 행 1건 존재 | 목록 `카테고리` 필터에서 특정 카테고리 또는 `카테고리 없음` 선택 | 단일 선택으로 필터 적용 · `카테고리 없음`은 `category IS NULL`(및 공백) 행만 조회 |
| AC-11 | Playwright/API | 자산번호 `N-001`, 자산명 `노트북(N)` 행 존재 | 목록 검색어에 자산번호 일부 또는 자산명 일부 입력 | `asset_number` 또는 `asset_name`에 매칭되는 행만 조회 · 모델번호/구입처/비고만 매칭되는 행은 검색 결과 제외 |
| AC-12 | Playwright | 상태 값이 다른 행 2건 이상 존재 | 상태 필터에서 `사용중` 선택 후 `미사용` 선택 | 상태 선택은 마지막 선택 1개만 유지 · URL은 `status=미사용` 단일값 |
| AC-13 | Playwright | 카테고리 값이 다른 행 2건 이상 존재 | 카테고리 필터에서 A 선택 후 B 선택 | 카테고리 선택은 마지막 선택 1개만 유지 · URL은 `category=B` 단일값 |
| AC-14 | Playwright/API | 상태·카테고리 조합을 만족하는 행과 불만족 행 존재 | 상태 1개 + 카테고리 1개를 동시에 적용 | 두 조건을 모두 만족하는 행만 조회 · URL은 `status=...&category=...` 형태 |
| AC-15 | Playwright | 전체 프로젝트 등록/저장/전송 계열 Sheet/Dialog/Page 폼 | submit/primary action 버튼 확인 | 기존 프로젝트 패턴에 맞는 `Icons.*` 장식 아이콘과 텍스트를 함께 표시 · 삭제 확인/드롭다운/Combobox check·chevron 등 기능 아이콘은 유지 |
| AC-16 | Playwright/Console | `/dashboard/product` 진입 후 브라우저 console 수집 | 상태 또는 카테고리 필터를 열고 선택·초기화 동작 수행 | hydration/console error 없음 · 특히 `<button>` descendant `<button>` 경고 없음 |

---

## 범위 (In / Out)

### In Scope

- `/dashboard/product` · `/dashboard/product/[id]` → 비품 대장 목록·편집 (경로 유지, 도메인 교체)
- nav 항목 라벨 **「비품 대장」** (url `/dashboard/product` 유지 또는 slug 정리 — 구현 시 `asset-ledger` alias **선택**, 기본은 **경로 유지**)
- Supabase `asset_items` 테이블 + RLS
- API `/api/asset-items` CRUD + 자산번호 추천 endpoint
- `src/features/products/` → `asset-ledger` (가칭) feature 교체 — DataTable · Sheet · mutations · queries 패턴 유지
- 열: 엑셀 12열 + `생성자` · `최종 수정자` (표시용, DB는 `created_by_id` · `updated_by_id`)
- 실사용자: `profiles` FK 선택 UI (검색 Combobox)
- 사용처: 자유입력 대신 `profiles.department` 동적 집계 기반 **부서 선택**
- 카테고리: `text` nullable + 추천값 제시 + 신규 입력 허용
- 목록: `asset_number` · `asset_name` 전용 검색
- 목록: 상태 **단일 선택** 필터 + 카테고리 **단일 선택** 필터 + `카테고리 없음`(NULL/공백) 옵션
- 목록: 상태 1개 + 카테고리 1개 **조합 필터 가능**, URL search params도 `status` · `category` 각각 단일값 유지
- 전체 프로젝트 등록/저장/전송 계열 submit/primary action 버튼 아이콘 유지/복구
- wake OR admin 접근 (office-snacks와 동일 `canAccess*` 패턴)
- CUD activity log 전 분기
- 삭제: 물리 DELETE · 등록자 또는 admin만

### Out of Scope

- 엑셀/CSV 일괄 이관 UI·시드 (사용자 수동 이관은 **후속**)
- 구글 시트 실시간 연동
- 테이블 인라인 셀 편집
- soft delete · 숨김 필터 · 삭제 복구 UI
- products mock API·`fakeProducts` 유지
- 카테고리 마스터 테이블(별도 관리 테이블) 구축
- 검색 대상에 `model_number` · `purchase_vendor` · `notes` 포함
- 삭제 확인, 드롭다운 메뉴, Combobox check/chevron 등 전송 버튼이 아닌 기능 아이콘 변경

---

## 인가 (auth_rules)

| 동작 | wake 소속 | admin | 비고 |
|------|-----------|-------|------|
| **조회 (READ)** | ✅ | ✅ | non-wake non-admin **403** / 페이지 flash |
| **등록 (CREATE)** | ✅ | ✅ | `created_by_id = actor` |
| **수정 (UPDATE)** | ✅ | ✅ | **등록자 여부 무관** — wake 전원 |
| **삭제 (DELETE)** | ✅ 본인 등록 행만 | ✅ 전체 | `created_by_id = actor` OR `system_role = admin` |

구현 참고: `canAccessAssetLedger()` · middleware · `requireAssetLedgerPage` · nav `access.assetLedger` (office-snacks `canAccessOfficeSnacks` 패턴 복제)

---

## 데이터 모델

### 테이블 `asset_items` (가칭)

| 컬럼 (UI 라벨) | DB 컬럼 | 타입 | 비고 |
|----------------|---------|------|------|
| 자산번호 | `asset_number` | `text` UNIQUE NOT NULL | 수동 수정 가능 |
| 자산명 | `asset_name` | `text` NOT NULL | 괄호 접두 추출용 |
| 상태 | `status` | `text` CHECK | `사용중` · `미사용` · `분실` |
| 품명(모델번호) | `model_number` | `text` | nullable |
| 실사용자 | `actual_user_id` | `uuid` FK → `profiles` | 프로필 선택 |
| 부서(사용처) | `usage_location` | `text` | `profiles.department` 선택값 저장 (legacy 사용처 값은 미승계) |
| 카테고리 | `category` | `text` | nullable (기본값 NULL) |
| 회계장부 | `accounting_ledger` | `text` | nullable |
| 장부코드 | `ledger_code` | `text` | nullable |
| 구입금액(+vat) | `purchase_amount` | `numeric(12,0)` | nullable |
| 구입날짜 | `purchase_date` | `date` | nullable |
| 구입처 | `purchase_vendor` | `text` | nullable |
| 비고 | `notes` | `text` | nullable |
| 생성자 | `created_by_id` | `uuid` FK → `profiles` | INSERT 시 server set |
| 최종 수정자 | `updated_by_id` | `uuid` FK → `profiles` | UPDATE 시 server set |
| — | `created_at` / `updated_at` | `timestamptz` | |

**RLS:** authenticated + wake 소속(또는 admin) SELECT/INSERT/UPDATE; DELETE는 **API Route에서만** 수행(service role 또는 정책 + Route 검증). 클라이언트 Supabase 직접 mutation **금지**.

### 부서 옵션 동적 집계

- 소스: `profiles.department`
- 규칙: `null`/빈 문자열 제외, trim 후 distinct 목록 구성
- 정렬: 한글 로케일 기준 오름차순 **[INFERRED]**
- 권한: wake+ 범위 내 기존 접근 정책 준수

### 카테고리 입력/추천 정책

- 저장 타입: `text` nullable, 기본값 `NULL`
- 입력 UX: 추천값 목록 표시 + 추천값 외 신규 텍스트 입력 허용
- 추천값 소스: `asset_items.category`의 distinct 값(공백/NULL 제외)
- 기존 데이터 기본값: 승계 없이 `NULL` 유지, 목록 필터에서 `카테고리 없음`으로 조회

### 마이그레이션 영향

- 기존 `usage_location` 데이터는 부서 체계로 이관하지 않고 **전량 공백/NULL 처리** (legacy 값 미승계)
- `category` 컬럼 신규 추가 시 기존 행 기본값은 일괄 `NULL`
- 롤백 시: `category` 미사용 상태로 되돌릴 수 있으나, null 처리된 legacy 사용처 텍스트는 복구 대상 아님 **[INFERRED]**

### 자산번호 자동 추천

- 규칙: `asset_name`에서 **괄호 안 1글자 이상** 추출 → 접두 `P` (예: `노트북(N)` → `N`)
- 동일 접두 `asset_number` 패턴 `P-###` 중 **최대 번호 + 1**, 3자리 zero-pad (예: `N-027`)
- 괄호 없거나 추출 실패 시: 추천 없음 · 사용자 **전량 수동** 입력
- UNIQUE 충돌 시 validation **400**

**Endpoint:** `GET /api/asset-items/suggest-number?asset_name=...` → `{ suggested: "N-027" }` (wake+)

---

## API 계약

| Method | Path | 인가 | activity action |
|--------|------|------|-------------------|
| GET | `/api/asset-items` | wake+ | — (READ, log Out) |
| POST | `/api/asset-items` | wake+ | `asset.create` |
| GET | `/api/asset-items/[id]` | wake+ | — |
| PATCH | `/api/asset-items/[id]` | wake+ | `asset.update` |
| DELETE | `/api/asset-items/[id]` | 등록자 or admin | `asset.delete` |
| GET | `/api/asset-items/suggest-number` | wake+ | — |
| GET | `/api/asset-items/users` | wake+ | — (실사용자 + 부서 선택 옵션용) |

목록 쿼리: `page` · `limit` · `search`(자산번호 `asset_number` · 자산명 `asset_name`만) · `status`(단일 선택) · `category`(단일 선택) · `sort` — product DataTable nuqs 패턴 재사용.

- `search` 필터:
  - `asset_number ILIKE` OR `asset_name ILIKE`
  - `model_number` · `purchase_vendor` · `notes` 등 기타 필드는 검색 대상 **Out**
- `status` 필터:
  - 일반 값: `status = {value}`
  - UI/URL 모두 1개 값만 유지. 같은 필터에서 새 값을 고르면 기존 선택을 교체
- `category` 필터:
  - 일반 값: `category = {value}`
  - `카테고리 없음` 선택: `category IS NULL OR btrim(category) = ''`
  - UI/URL 모두 1개 값만 유지. 같은 필터에서 새 값을 고르면 기존 선택을 교체
- `status` + `category` 조합:
  - 서로 다른 필터끼리는 동시에 적용 가능
  - URL 예: `?status=사용중&category=노트북`

DELETE 403 시: `recordActivityLog` + `{ message: '등록한 사용자만 삭제할 수 있습니다.' }` **[INFERRED]**

---

## 기록 연동 (activity_logs)

| action | HTTP | Path | actor | target |
|--------|------|------|-------|--------|
| `asset.create` | POST | `/api/asset-items` | wake user | `asset_number` 또는 `id` |
| `asset.update` | PATCH | `/api/asset-items/[id]` | wake user | 동일 |
| `asset.delete` | DELETE | `/api/asset-items/[id]` | 등록자/admin (403 시 시도자) | 동일 |

- Route 진입 `requestId = crypto.randomUUID()` · **전 return 분기** `recordActivityLog` · `x-request-id` 헤더
- metadata allowlist: `asset_number` · `asset_name` · `status` · `category` · `usage_location` · `changed_fields` · `error_code` · `message` (민감값 금지)
- `ActivityAction` 타입에 위 3 action 추가

---

## UI 요구사항

### 목록 (`/dashboard/product`)

- `PageContainer` · 제목 **비품 대장** · 설명 한국어
- `DataTable` + `DataTableToolbar` — product 테이블 골격 재사용
- 컬럼: 엑셀 12열 + 카테고리 + 생성자(name/email) + 최종 수정자 + actions
- CTA: **등록** → Sheet 폼
- 행 actions: **수정** (wake 전원) · **삭제** (등록자·admin만 노출)
- 삭제: `AlertModal` → `mutate` · `loading={isPending}`
- `loading.tsx` / Suspense skeleton 유지
- 툴바 검색: `asset_number` · `asset_name`만 대상
- 툴바 필터: 상태 **단일 선택** 필터 + 카테고리 **단일 선택** 필터 + `카테고리 없음` 옵션
- 필터 선택 방식: 기존 UI를 유지하되 같은 필터 안에서는 새 선택이 기존 선택을 교체한다. 상태 1개 + 카테고리 1개 조합은 허용한다.
- URL 동기화: `status` · `category`는 배열/중복값 없이 각각 단일 search param만 유지한다.
- Hydration 회귀 방지: `src/components/ui/table/data-table-faceted-filter.tsx`의 `DataTableFacetedFilter`에서 외부 trigger `Button` 내부에 reset용 `<button>`이 중첩되지 않아야 한다. 필터 클릭·선택·초기화 시 브라우저 console에 `<button>` descendant `<button>` hydration 경고가 없어야 한다.

### Sheet 폼 (등록·수정)

- `useAppForm` + Zod
- 실사용자: profiles 검색 Combobox (이름·이메일 표시)
- 사용처: 자유입력 금지, `profiles.department` 동적 집계 기반 Select/Combobox
- 카테고리: 추천값 목록 + 신규 입력 허용(text nullable)
- 자산번호: 등록 시 suggest API 호출 후 input prefill · **수정 가능**
- `SheetFooter` 본문 바깥 고정 (모바일 CTA)
- 제출 버튼: 등록/저장 submit 버튼은 기존 프로젝트 패턴에 맞게 `Icons.*` 장식 아이콘과 텍스트를 함께 표시한다.

### 전역 제출 버튼 아이콘 정책

- 범위: 전체 프로젝트의 등록/저장/전송 계열 Sheet/Dialog/Page 폼 submit 또는 primary action 버튼.
- 요구: 버튼 안의 장식 아이콘을 `@/components/icons`의 `Icons.*`로 유지/복구하고 텍스트도 유지한다. 기존 `isLoading`/disabled/pending 상태는 유지한다.
- 제외: 삭제 확인 `AlertModal`, 드롭다운 메뉴 아이콘, Combobox check/chevron, 행 action 아이콘, 선택 상태 표시 아이콘 등 전송 버튼이 아닌 기능 아이콘.
- 검증: 비품대장 폼을 포함해 주요 CUD 폼에서 CTA 아이콘·텍스트와 pending 상태가 유지되는지 확인한다.

### 제거·교체

- `fakeProducts` · mock product 이미지 폼 · `/api/products` Route **삭제 또는 미사용 처리**
- nav `Products` → **비품 대장**

---

## 수정 이력

| Date | Author | 내용 |
|------|--------|------|
| 2026-06-09 | planner | deep-interview·battle-plan 확정 후 초안 저장 (Approved) |
| 2026-06-10 | planner | 사용처→부서 선택, category(nullable) 추가, category 단일 필터(카테고리 없음) 및 legacy/null 마이그레이션 정책 반영 |
| 2026-06-10 | planner | 자산번호/자산명 검색, 상태·카테고리 단일 선택 및 조합 필터, 전역 제출 버튼 아이콘 정책 AC 보강 |
| 2026-06-10 | planner | 비품대장 필터 클릭 시 `DataTableFacetedFilter` nested button hydration/console error 방지 AC 보강 |
| 2026-06-10 | frontend-dev | 등록/저장/전송 계열 submit 아이콘 유지/복구 요구로 AC-15 및 UI 정책 정정 |
