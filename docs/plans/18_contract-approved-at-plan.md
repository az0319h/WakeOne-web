# 계약서 문서승인일 정식 필드화 기획서

> Date: 2026-07-08
> Status: Approved
> Author: planner
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [16](./16_contract-management-plan.md)
> **SQL 후보:** `supabase/sql/20_contract_approved_at.sql` (기획 시점 `supabase/sql/` 최대 번호: `19`)

## 한 줄 요약

계약서 관리의 날짜 기준을 `문서 생성일(document_created_at)` 중심에서 **문서승인일(`approved_at`)** 중심으로 전환하고, OpenClaw Import API가 승인일을 필수로 전달하도록 정식 필드와 UI/검증을 추가한다.

---

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **07** | `/api/*` 인증/인가 defense in depth, admin/service token guard 유지 |
| **08** | Import/update 등 CUD Route 전 HTTP 분기 `recordActivityLog`, `x-request-id`, metadata allowlist 유지 |
| **16** | 계약서 관리의 DB/API/UI/Import API/날짜 필터/정렬 기존 기준을 본 plan에서 승인일 기준으로 후속 변경 |

---

## 확정 결정

| 항목 | 결정 |
|------|------|
| DB/API 필드명 | `approved_at` |
| DB 타입 | `timestamptz null` |
| Import API | `approved_at` 필수 |
| 기존 데이터 | backfill 없음. 기존 rows는 `approved_at = null` 유지 |
| UI 라벨 | `문서승인일` |
| 목록 컬럼 | 기존 `문서 생성일` 표시를 `문서승인일`로 대체 |
| 날짜 범위 필터 | `from`/`to`를 승인일 기준으로 처리 |
| 기본 정렬 | `approved_at desc` |
| 상세/수정 | `문서승인일` 표시 및 수정 가능 |
| `document_created_at` | 즉시 제거하지 않고 기존 호환 필드로 유지 |

---

## 목표 & 완료 기준

### 목표

- OpenClaw가 승인된 계약 문서만 WakeOne Import API로 넘긴다는 전제에 맞춰, WakeOne 계약서 관리의 주 날짜를 `문서승인일`로 표시한다.
- Import API는 `approved_at` 누락 payload를 거부해 승인일 없는 자동 생성 행을 막는다.
- 관리자는 기존 null 데이터의 `문서승인일`을 상세/수정 화면에서 직접 채울 수 있다.
- 목록 날짜 범위 필터와 기본 정렬은 `approved_at` 기준으로 동작한다.
- `approved_at` 변경은 `contract.update` activity log의 `changed_fields`에 기록된다.

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API | OpenClaw service token과 `approved_at` 포함 import payload | `POST /api/contracts/import` 호출 | HTTP 201 또는 idempotent 200 응답이 반환되고 계약 행의 `approved_at`이 저장되며 `contract.import_create` 또는 `contract.import_duplicate` 로그가 남는다 |
| AC-02 | API | OpenClaw service token과 `approved_at` 누락 import payload | `POST /api/contracts/import` 호출 | HTTP 400 validation 응답이 반환되고 계약 행은 생성되지 않으며 `contract.import_failed` 로그 metadata에 `error_code`와 비민감 message가 기록된다 |
| AC-03 | Playwright/API | 승인일이 서로 다른 계약 문서들이 존재 | `/dashboard/contracts`에서 날짜 범위를 선택 | 선택한 `approved_at` 범위에 포함되는 행만 표시되고 URL `from`/`to` 상태가 유지된다 |
| AC-04 | Playwright/API | 승인일이 있는 행과 `approved_at = null`인 기존 행이 함께 존재 | 기본 계약 목록을 조회 | 승인일이 있는 행은 `approved_at desc` 기준으로 정렬되고 null 행은 깨지지 않으며 `문서승인일` 빈 값으로 표시된다 |
| AC-05 | Playwright | admin이 계약 상세 화면에 진입 | 계약 상세 정보를 확인 | `문서승인일`이 문서번호, 작성자, 계약대상 등과 함께 표시된다 |
| AC-06 | Playwright/API | `approved_at = null`인 기존 계약 문서가 존재 | admin이 수정 화면에서 `문서승인일`을 입력하고 저장 | 목록과 상세에 입력한 승인일이 반영되고 `contract.update` 로그 metadata `changed_fields`에 `approved_at`이 포함된다 |
| AC-07 | Playwright/API | 승인일이 있는 기존 계약 문서가 존재 | admin이 수정 화면에서 `문서승인일`을 변경하고 저장 | 변경된 승인일이 목록·상세에 반영되고 `contract.update` 로그 metadata `changed_fields`에 `approved_at`이 포함된다 |
| AC-08 | API | `system_role=user` 세션 | 계약 update mutation API 호출 | 기존 RBAC 정책대로 HTTP 403 계열 응답이 반환되고 실패 분기 activity log 정책이 유지된다 |

---

## 범위 (In / Out)

### In Scope

- Supabase migration:
  - `contract_documents.approved_at timestamptz null` 추가
  - 기존 rows backfill 없음
  - 구현 시 SQL 파일 후보: `supabase/sql/20_contract_approved_at.sql`
- 계약서 API/서비스:
  - Import validator에서 `approved_at` required
  - admin update validator에서 `approved_at` nullable/update 가능
  - list/detail response type에 `approved_at` 포함
  - 날짜 필터 `from`/`to`를 `approved_at` 기준으로 적용
  - 기본 정렬 `approved_at desc`
- 계약서 UI:
  - 목록 컬럼 `문서 생성일`을 `문서승인일`로 대체
  - 상세 화면에 `문서승인일` 표시
  - 수정 폼에서 `문서승인일` 입력/수정 가능
  - `approved_at = null` 기존 데이터는 빈 값으로 표시하고 수정 가능
- React Query/Mutation:
  - 기존 `mutations.ts` onSettled invalidate 유지
  - 수정 성공 후 폼 reset 규칙 유지
- Activity log:
  - `contract.import_create`, `contract.import_duplicate`, `contract.import_failed` 기존 정책 유지
  - `contract.update` metadata `changed_fields`에 `approved_at` 포함
  - 실패 metadata는 `error_code`, 비민감 message 등 allowlist만 사용
- 검증:
  - API spec: import 성공/누락 실패, update changed_fields
  - Playwright: 목록 컬럼, 날짜 필터, 상세/수정, null 표시
  - `tsc`, lint, build

### Out of Scope

- 기존 계약 rows의 `approved_at` 자동 backfill
- `document_created_at` 컬럼 제거
- OpenClaw 봇/Gmail/Flex 파싱 구현 자체
- 날짜 필터 기준 선택 UI 추가
- CSV/Excel export

---

## OpenClaw Import payload 변경

| 필드 | 필수 | 설명 |
|------|------|------|
| `approved_at` | 필수 | Flex/Gmail에서 확인한 계약 문서 승인 일시. ISO timestamp 권장 |
| `document_created_at` | 기존 호환 | DB 호환을 위해 유지하되 UI 주 기준은 아님 |

예상 payload 일부:

```json
{
  "document_number": "FLEX-2026-001",
  "approved_at": "2026-07-08T09:00:00+09:00",
  "document_created_at": "2026-07-07",
  "author_name": "홍길동",
  "contract_target": "계약대상",
  "contract_summary": "계약 내용"
}
```

---

## API / Service Layer 영향

| 영역 | 변경 |
|------|------|
| `types.ts` | 계약 row/detail/list/update/import 타입에 `approved_at` 추가 |
| `validators.ts` | import schema는 `approved_at` required, update schema는 nullable/update 가능 |
| `service.server.ts` | insert/update/list/detail select와 filter/sort 기준 반영 |
| `service.ts` | client API payload/response 타입 반영 |
| `queries.ts` | query key filter 의미는 유지하되 `from`/`to`가 승인일 기준임을 타입/주석/호출부에 반영 |
| `mutations.ts` | 기존 update mutation 경유, onSettled invalidate 유지 |
| `POST /api/contracts/import` | `approved_at` 누락 시 400 + `contract.import_failed` |
| `PATCH /api/contracts/[id]` | `approved_at` 변경 허용 + `changed_fields` 기록 |

---

## UI 요구사항

### 목록 (`/dashboard/contracts`)

- 테이블 컬럼의 날짜 라벨은 **문서승인일**.
- 기존 `문서 생성일` 컬럼은 목록 기본 표시에서 제외한다.
- 날짜 범위 캘린더 필터는 `approved_at` 기준으로 동작한다.
- 기본 정렬은 `approved_at desc`.
- `approved_at = null`인 기존 행은 빈 값 또는 `-`로 표시하되 테이블 렌더링과 페이지네이션이 깨지면 안 된다.

### 상세/수정

- 상세 화면에 **문서승인일**을 표시한다.
- 수정 폼에서 **문서승인일**을 입력/변경할 수 있다.
- 기존 null 데이터는 사용자가 직접 입력할 수 있어야 한다.
- 수정 성공 시 기존 폼 reset 및 mutation invalidate 규칙을 유지한다.

---

## 활동 감사 로그

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

| Route | action | 기록 분기 |
|-------|--------|-----------|
| `POST /api/contracts/import` | `contract.import_create` / `contract.import_duplicate` / `contract.import_failed` | 401 invalid token · 400 validation(`approved_at` 누락 포함) · 200 duplicate · 201 created · 500 |
| `PATCH /api/contracts/[id]` | `contract.update` | 401 · 403 · 400 validation · 404 · 200 · 500 |

metadata allowlist 추가/확인:

| key | 용도 |
|-----|------|
| `document_number` | 계약 문서 식별 |
| `changed_fields` | `approved_at` 포함 가능 |
| `error_code` | `validation`, `missing_approved_at`, `internal_error` 등 |
| `message` | 비민감 한국어 오류 메시지 |

---

## 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | 기존 rows의 `approved_at = null`로 목록 정렬/필터가 어색해짐 | null은 빈 값으로 표시하고 수정 가능하게 하며, 필터 적용 시 null 제외를 명확히 검증 |
| 2 | Import API 필수값 추가로 OpenClaw payload 누락 시 자동 수집 실패 | 400 validation 응답과 `contract.import_failed` 로그에 누락 사유 기록 |
| 3 | `timestamptz` 표시 timezone 혼동 | 저장은 ISO timestamp, UI는 한국어 로케일 날짜/일시 표시 규칙으로 통일 |
| 4 | 기존 `document_created_at` 참조가 남아 필터/정렬 불일치 | contracts feature 내 `document_created_at`, `from`, `to`, sort 참조 grep 검증 |
| 5 | activity log metadata에 민감 payload가 섞임 | `approved_at`, changed field명, 오류 코드 등 비민감 allowlist만 기록 |

---

## 구현 순서 제안

1. SQL migration 추가: `approved_at` nullable 컬럼, backfill 없음.
2. BE 타입/validator/service 반영: import required, update nullable.
3. Import/update Route 반영: `approved_at` 저장, validation 실패 로그, changed_fields 기록.
4. FE API 타입/service/mutation payload 반영.
5. 목록 컬럼·날짜 필터·기본 정렬을 `문서승인일`/`approved_at` 기준으로 전환.
6. 상세/수정 UI에 `문서승인일` 표시 및 수정 입력 추가.
7. API/Playwright spec 작성 및 `tsc`, lint, build 검증.

---

## 영향 파일 후보

| 파일 | 변경 |
|------|------|
| `supabase/sql/20_contract_approved_at.sql` | `approved_at` 컬럼 추가 migration 후보 |
| `src/features/contracts/api/types.ts` | 타입 계약 확장 |
| `src/features/contracts/api/validators.ts` | import/update schema 확장 |
| `src/features/contracts/api/service.server.ts` | DB select/insert/update/filter/sort 반영 |
| `src/features/contracts/api/service.ts` | client API 타입 반영 |
| `src/features/contracts/api/queries.ts` | filter 의미/키 반영 |
| `src/features/contracts/api/mutations.ts` | update mutation payload 확인 |
| `src/app/api/contracts/import/route.ts` | Import API required validation/logging |
| `src/app/api/contracts/[id]/route.ts` | update route changed_fields/logging |
| `src/features/contracts/components/**` | table/detail/edit UI 반영 |
| `src/lib/searchparams.ts` | contracts 날짜 필터 의미 확인 |
| `e2e/contracts/**` | AC 기반 Playwright/API 검증 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|-----------|--------|
| 2026-07-08 | 최초 작성 · `/root` planner Phase 3+4 · Status Approved | planner |
