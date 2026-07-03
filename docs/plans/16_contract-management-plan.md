# 계약서 관리 기획서

> Date: 2026-07-02
> Status: Approved
> Author: planner
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [12](./12_dashboard-skeleton-mobile-sheet-quality-plan.md), [14](./14_delete-confirm-dialog-plan.md), [15](./15_asset-ledger-plan.md)

## 한 줄 요약

`/dashboard/contracts`에 **admin-only 계약서 관리 페이지**를 추가하고, OpenClaw가 Gmail/Flex 문서를 확인해 WakeOne Import API로 계약서 체결 요청 문서를 자동 생성한다. 관리자는 첨부파일 상태와 `첨부파일 없음` 예외를 관리하고, 주 1회 누락 계약서 독촉 메일을 사람별로 취합 발송한다.

---

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **07** | `/api/*` 세션 필수, `requireAdminSession`, `requireAdminPage`, dashboard defense in depth 패턴 재사용 |
| **08** | CUD Route 전 HTTP 분기 `recordActivityLog`, `x-request-id`, `/dashboard/logs` 검증 AC 필수 |
| **12** | 비동기 목록 화면 skeleton, 모바일 Sheet CTA 접근성 표준 적용 |
| **14** | 삭제/비활성화 등 위험 액션은 `AlertModal`, `window.confirm` 금지 |
| **15** | 테이블형 관리 화면, nuqs 필터, React Query mutation `onSettled` invalidate, soft delete/상태 표시 패턴 참고 |

**중복 금지:** READ 조회 로그는 Out. 계약서 파일 hard delete와 계약 행 물리 삭제는 Out.

---

## 목표 & 완료 기준

### 목표

- OpenClaw가 Gmail에서 flex 계약서 체결 요청 완료 메일을 감지하고 Flex 문서 상세를 읽어 WakeOne Import API로 계약 행을 자동 생성한다.
- 관리자는 자동 생성된 계약서 체결 요청 문서를 수정·soft delete하고 첨부파일 상태를 관리한다.
- 목록은 사용자 관리 페이지처럼 페이지네이션되며, 첨부 이미지의 날짜 범위 선택 UI를 참고한 캘린더 필터를 제공한다.
- 첨부파일이 없고 `첨부파일 없음`도 지정되지 않은 계약 문서는 주 1회 독촉 대상이 된다.
- 독촉 메일은 사람별로 누락 문서번호를 취합해 1건만 발송한다.
- 모든 CUD 및 독촉 발송 성공/실패는 activity log로 추적한다.

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | admin 로그인 | `/dashboard/contracts` 이동 | 페이지 제목 **「계약서 관리」**, 날짜 범위 캘린더 필터, 페이지네이션 테이블, 자동 수집 상태 안내가 보인다 |
| AC-02 | Playwright | `system_role=user` 로그인 | `/dashboard/contracts` 직접 접근 | `/dashboard/overview`로 이동하거나 접근 거부 안내가 표시되고 계약서 화면은 렌더되지 않는다 |
| AC-03 | API | `system_role=user` 세션 | `GET /api/contracts` 또는 mutation API 호출 | HTTP **403**, `{ success: false, message: '관리자 권한이 필요합니다.' }` 계열 응답 |
| AC-04 | Playwright | admin, 계약 문서 15건 이상 존재 | 페이지 크기 10으로 목록 조회 후 다음 페이지 이동 | 2페이지 데이터가 표시되고 URL page/perPage 상태가 유지된다 |
| AC-05 | Playwright/API | 서로 다른 문서 생성일의 계약 문서 존재 | 날짜 범위 캘린더에서 기간 선택 | 선택한 문서 생성일 범위에 포함되는 행만 표시된다 |
| AC-06 | API | OpenClaw service token, flex 계약서 체결 요청 완료 메일/문서 payload | `POST /api/contracts/import` 호출 | 목록에 문서번호, 문서 생성일, 작성자, 계약대상, 계약 내용, 금액, 첨부파일 상태가 자동 생성되고 `contract.import_create` 로그가 남는다 |
| AC-06-1 | API | 동일 문서번호가 이미 존재 | OpenClaw가 같은 문서번호로 `POST /api/contracts/import` 재호출 | 중복 행은 생성되지 않고 기존 행이 idempotent 응답되며 `contract.import_duplicate` 로그가 남는다 |
| AC-07 | Playwright/API | 기존 계약 문서 존재 | admin이 계약대상/계약 내용/금액 등을 수정 | 수정값이 목록·상세에 반영되고 `contract.update` 로그에 changed_fields가 기록된다 |
| AC-08 | Playwright/API | 기존 계약 문서 존재 | admin이 계약 문서를 soft delete 처리 | 행은 목록에서 삭제/비활성 상태로 빨간 표시되고 `contract.soft_delete` 로그가 남는다 |
| AC-09 | Playwright | 계약 문서 상세 진입 | admin이 상세를 확인 | 첨부 이미지 흐름을 참고해 문서번호, 작성일, 작성자, 계약대상, 계약 내용, 계약 시작/종료일(있으면), 비고, 금액, 첨부파일 목록/상태가 보인다 |
| AC-10 | Playwright/API | 계약 행에 활성 첨부파일이 없음 | admin이 1MB 이하 파일을 업로드 | Supabase Storage에 저장되고 파일명이 목록에 표시되며 다운로드 가능하고 `contract.attachment_upload` 로그가 남는다 |
| AC-11 | API | 같은 계약 행에 `계약서.pdf` 활성/삭제 이력 중 동일 파일명 존재 | admin이 동일 파일명으로 재업로드 | HTTP **400**, 파일명 중복 오류가 반환되고 실패 로그가 남는다 |
| AC-12 | API | 1MB 초과 파일 업로드 요청 | admin이 첨부 업로드 | HTTP **400**, 용량 제한 오류가 반환되고 Storage/DB에 활성 파일이 생성되지 않는다 |
| AC-13 | Playwright/API | 활성 첨부파일 존재 | admin이 첨부파일 다운로드 | 원 파일명으로 다운로드되고 READ 동작이므로 activity log는 생성하지 않는다 |
| AC-14 | Playwright/API | 활성 첨부파일 존재 | admin이 첨부파일 soft delete | 첨부파일은 빨간 삭제/비활성 상태로 표시되고 독촉 제외 계산에서 제외되며 `contract.attachment_soft_delete` 로그가 남는다 |
| AC-15 | Playwright/API | 활성 첨부파일이 없는 계약 문서 | admin이 `첨부파일 없음` 지정 | 행 상태가 `첨부파일 없음`으로 표시되고 독촉 제외 대상이 되며 `contract.no_attachment_set` 로그가 남는다 |
| AC-16 | Playwright/API | `첨부파일 없음` 지정 문서 | admin이 지정을 해제 | 행은 첨부 누락 상태로 돌아가고 다음 독촉 대상에 포함되며 `contract.no_attachment_unset` 로그가 남는다 |
| AC-17 | API | 작성자 A의 누락 계약 문서 3건, 작성자 B의 누락 계약 문서 1건 존재 | 주간 독촉 실행 | A에게 문서번호 3건을 담은 메일 1건, B에게 문서번호 1건을 담은 메일 1건이 발송된다 |
| AC-18 | API | 활성 첨부파일 1개 이상 또는 `첨부파일 없음` 지정 문서 존재 | 주간 독촉 실행 | 해당 문서는 독촉 메일 목록에서 제외된다 |
| AC-19 | API | SMTP 설정 정상 | 주간 독촉 발송 성공 | `contract.reminder_send` 2xx 로그가 사람별 메일 단위로 기록되고 request id가 응답/로그에 남는다 |
| AC-20 | API | SMTP 발송 실패 상황 | 주간 독촉 실행 | 실패 대상은 `contract.reminder_failed` 로그로 기록되고 전체 API는 실패 내역을 포함해 안전하게 응답한다 |
| AC-21 | Playwright/API | OpenClaw import 또는 admin CUD 또는 독촉 발송 1건 수행 | `/dashboard/logs` 또는 `GET /api/activity-logs?action=contract.import_create` 조회 | 해당 action, endpoint, status, target 문서번호, actor/service token 주체가 확인된다 |
| AC-22 | grep/Playwright | 계약서 삭제·첨부 soft delete UI | 삭제/비활성 액션 수행 | `AlertModal` 확인 후에만 mutation이 실행되고 `window.confirm` 사용은 0건이다 |

---

## 범위 (In / Out)

### In Scope

- `/dashboard/contracts` 계약서 관리 목록 및 상세 보기
- admin-only nav/menu/page/API 잠금 (`profiles.system_role = 'admin'`)
- OpenClaw 기반 계약 문서 자동 생성 Import API
- 계약 문서 관리자 수정/soft delete
- 계약 문서 필드:
  - 문서번호
  - 문서 생성일
  - 작성자
  - 계약대상
  - 계약 내용
  - 금액
  - 첨부파일 상태/목록
  - 상세 보기 보조 필드: 계약 시작일/종료일, 비고 등 외부 문서 payload 대비 nullable 확장 필드
- 목록: 페이지네이션 + 날짜 범위 캘린더 필터 + 기본 정렬 `document_created_at desc`
- Supabase Storage 첨부 업로드/다운로드
- 첨부파일 정책:
  - 파일 종류 제한 없음
  - 계약 행당 파일 크기 합계 또는 단일 파일 기준 **1MB 이하**로 제한. 구현 시 더 안전한 정책으로 **행당 활성 첨부 총량 1MB**를 기본값으로 적용
  - 같은 계약 행 내 파일명 중복 금지
  - 삭제는 soft delete, UI에 삭제/비활성 상태 표시
- `첨부파일 없음` 관리자 지정/해제
- 주 1회 독촉 메일:
  - 활성 첨부파일 1개 이상 또는 `첨부파일 없음` 지정 시 제외
  - 사람별 누락 문서번호 취합
  - Nodemailer 우선
- activity log 전 분기 기록

### Out of Scope

- flex 공식 계약서 체결 요청 API 연동
- WakeOne 서버가 직접 Gmail/Flex를 polling하거나 Flex에 로그인하는 기능
- 전자서명 자체 기능
- OCR/파일 내용 분석
- OpenClaw 봇 구현 자체
- 계약 행 또는 Storage object 물리 삭제 UI
- 첨부파일 미리보기 뷰어
- 독촉 메일 템플릿 고도화/다국어
- CSV/Excel export

---

## Gmail / OpenClaw / Flex 연동 정책

flex 공식 Open API 문서 기준으로 계약서 체결 요청/결재 문서 조회 API는 확인되지 않았다. 사용자가 확인한 운영 흐름상 계약서 체결 요청 완료 메일은 Gmail로 수신되며, OpenClaw는 Gmail 확인 및 Flex 로그인/문서 접근이 가능하다.

### 1차 구현

- WakeOne은 Gmail 또는 Flex에 직접 접근하지 않는다.
- OpenClaw 봇이 Gmail API로 flex 메일을 감지한다.
- OpenClaw 봇이 `계약서 체결 요청` 및 `승인이 완료` 계열 메일을 필터링한다.
- OpenClaw 봇이 메일 본문 링크로 Flex 문서 상세에 접근해 문서번호, 작성자, 문서 생성일, 계약대상, 계약 내용, 금액, 비고, 첨부 관련 힌트를 추출한다.
- OpenClaw 봇이 WakeOne의 `POST /api/contracts/import`를 service token으로 호출한다.
- WakeOne Import API는 문서번호 기준 idempotent upsert를 수행한다.
- 관리자는 WakeOne UI에서 자동 생성된 행의 필드 보정, 첨부파일 업로드, `첨부파일 없음` 지정/해제, soft delete만 수행한다.

### OpenClaw → WakeOne Import payload

| 필드 후보 | 용도 |
|-----------|------|
| `document_number` | 필수. flex 문서번호. idempotency key |
| `document_created_at` | 필수. flex 문서 생성일 또는 메일/문서에서 추출한 기준일 |
| `author_name` | 필수. 작성자 표시명 |
| `author_email` | nullable. 독촉 메일 수신자 fallback |
| `contract_target` | 필수. 계약대상 |
| `contract_summary` | 필수. 계약 내용 요약 |
| `amount` | nullable. 금액 |
| `contract_start_date` / `contract_end_date` | nullable. 문서에서 확인될 때만 저장 |
| `notes` | nullable. 비고 또는 파싱 보조 정보 |
| `source_message_id` | Gmail message id. 중복 방지 보조키 |
| `source_thread_id` | Gmail thread id |
| `source_mail_subject` | 메일 제목. 비민감 범위만 저장 |
| `source_document_url` | Flex 문서 URL. 접근 제어상 admin-only 상세에서만 노출 여부 결정 |
| `external_payload` | 비민감 파싱 payload 및 누락/불확실 필드 |

### 보안 정책

- OpenClaw 전용 Import API token을 환경변수로 관리한다.
- `POST /api/contracts/import`는 일반 사용자 세션이 아니라 service token만 허용한다.
- token은 요청 헤더 `Authorization: Bearer ${CONTRACT_IMPORT_TOKEN}` 또는 `x-contract-import-token` 중 구현 시 하나로 고정한다.
- Import API는 service role로 DB write를 수행하되, 응답에는 민감 정보를 반환하지 않는다.
- Flex 로그인 계정/비밀번호는 WakeOne에 저장하지 않는다. OpenClaw 쪽에서 관리한다.
- 계약 내용과 문서 URL은 민감할 수 있으므로 activity log metadata에는 문서번호와 상태/결과만 저장한다.

### 후속 확인 태스크

- OpenClaw Gmail polling 주기와 Slack 봇 실행 주기 확정
- flex 메일 제목/본문 샘플 3~5개로 파싱 규칙 검증
- Flex 문서 상세에서 필요한 필드가 안정적으로 추출되는지 검증
- OpenClaw가 Flex 로그인 세션 만료/2FA/권한 오류를 감지하고 실패 payload를 전달할 수 있는지 확인
- Import 실패 시 Slack 알림 또는 WakeOne import error 목록 노출 여부 결정

---

## 권한 / RBAC

| 대상 | 허용 | 거부 시 |
|------|------|---------|
| nav `계약서 관리` | `profiles.system_role = 'admin'` | 메뉴 숨김 |
| `/dashboard/contracts` page | admin only | `/dashboard/overview` + 접근 거부 안내 |
| `/api/contracts/import` | OpenClaw service token only | HTTP 401 |
| `/api/contracts*` 관리 API | admin only | HTTP 403 |
| `/api/contracts/reminders` | admin only 또는 서버 cron secret + admin-equivalent guard | HTTP 401/403 |

- nav 숨김은 UX일 뿐이며, page/API에서 반드시 서버 가드를 수행한다.
- 기존 `requireAdminSession`, `requireAdminPage` 패턴을 따른다.

---

## 데이터 모델 요구사항

### `contract_documents` (가칭)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint identity | PK |
| `document_number` | text unique not null | 문서번호 |
| `document_created_at` | date/timestamptz not null | 문서 생성일 |
| `author_user_id` | uuid nullable | 작성자 프로필 매핑 가능 시 |
| `author_email` | text nullable | 독촉 메일 대상 fallback |
| `author_name` | text not null | 작성자 표시명 |
| `contract_target` | text not null | 계약대상 |
| `contract_summary` | text not null | 계약 내용 |
| `amount` | numeric nullable | 금액 |
| `contract_start_date` | date nullable | 상세 보기 보조 필드 |
| `contract_end_date` | date nullable | 상세 보기 보조 필드 |
| `notes` | text nullable | 비고 |
| `no_attachment_required` | boolean not null default false | `첨부파일 없음` 지정 여부 |
| `no_attachment_reason` | text nullable | 지정 사유 |
| `status` | text not null | `active` / `soft_deleted` |
| `source_type` | text not null default `openclaw_gmail` | `openclaw_gmail` / `manual_adjustment` / `flex_api` |
| `source_message_id` | text nullable | Gmail message id |
| `source_thread_id` | text nullable | Gmail thread id |
| `source_mail_subject` | text nullable | 수신 메일 제목 |
| `source_document_url` | text nullable | Flex 문서 URL |
| `external_document_id` | text nullable | 추후 Flex 공식 API adapter |
| `external_payload` | jsonb nullable | 비민감 파싱 payload |
| `imported_at` / `synced_at` | timestamptz nullable | 자동 생성/동기화 시각 |
| `created_by_id` / `updated_by_id` | uuid | 관리자 추적 |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | 감사용 |

### `contract_attachments` (가칭)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | bigint identity | PK |
| `contract_id` | bigint FK | 계약 문서 |
| `file_name` | text not null | 원 파일명 |
| `storage_bucket` | text not null | Supabase Storage bucket |
| `storage_path` | text not null | object path |
| `content_type` | text nullable | 파일 종류 제한 없음 |
| `file_size` | integer not null | 1MB 제한 계산 |
| `status` | text not null | `active` / `soft_deleted` |
| `uploaded_by_id` / `deleted_by_id` | uuid nullable | 관리자 추적 |
| `created_at` / `deleted_at` | timestamptz | 감사용 |

**중복 정책:** 같은 `contract_id` 안에서 동일 `file_name`은 재업로드 금지. soft deleted 이력이 있어도 같은 파일명 재사용은 금지해 감사 추적을 단순화한다.

### `contract_reminder_runs` / `contract_reminder_recipients` (가칭)

- 주간 독촉 중복 발송 방지를 위해 run 단위 idempotency를 둔다.
- 사람별 recipient row에 누락 문서번호 배열, 발송 성공/실패, error message allowlist를 저장한다.

### `contract_import_events` (가칭)

- OpenClaw Import API 호출 이력을 저장한다.
- `source_message_id`, `document_number`, `status`, `error_code`, `error_message`, `received_payload` allowlist를 기록한다.
- 같은 Gmail message id 또는 같은 문서번호 재호출은 idempotent하게 처리한다.

---

## API / Service Layer

Feature 구조:

```txt
src/features/contracts/api/
  types.ts
  validators.ts
  service.ts
  service.server.ts
  queries.ts
  mutations.ts
```

API 후보:

| Method | Path | 용도 | Log |
|--------|------|------|-----|
| GET | `/api/contracts` | 목록, 페이지네이션, 날짜 범위 필터 | READ Out |
| POST | `/api/contracts/import` | OpenClaw 자동 생성/import | `contract.import_create` / `contract.import_duplicate` / `contract.import_failed` |
| GET | `/api/contracts/[id]` | 상세 조회 | READ Out |
| PATCH | `/api/contracts/[id]` | 계약 문서 수정 | `contract.update` |
| DELETE | `/api/contracts/[id]` | 계약 문서 soft delete | `contract.soft_delete` |
| POST | `/api/contracts/[id]/attachments` | 첨부 업로드 | `contract.attachment_upload` |
| GET | `/api/contracts/[id]/attachments/[attachmentId]/download` | 다운로드 | READ Out |
| DELETE | `/api/contracts/[id]/attachments/[attachmentId]` | 첨부 soft delete | `contract.attachment_soft_delete` |
| PATCH | `/api/contracts/[id]/no-attachment` | `첨부파일 없음` 지정/해제 | `contract.no_attachment_set` / `contract.no_attachment_unset` |
| POST | `/api/contracts/reminders` | 주간 독촉 실행 | `contract.reminder_send` / `contract.reminder_failed` |

목록 query:

| Query | 설명 |
|-------|------|
| `page`, `limit` | 페이지네이션 |
| `from`, `to` | 문서 생성일 날짜 범위 |
| `search` | 문서번호, 작성자, 계약대상 일부 검색 |
| `attachment_status` | `missing` / `has_attachment` / `no_attachment_required` / `soft_deleted` |
| `sort` | 기본 `document_created_at.desc` |

Mutation 규칙:

- 클라이언트는 `mutations.ts`의 `mutationOptions` + `useMutation`만 사용한다.
- CUD는 API Route 경유, Supabase client 직접 mutation 금지.
- `onSettled`에서 `contractKeys.all` invalidate.
- 생성/수정 Sheet/Dialog 폼은 성공 후 reset.

---

## 독촉 메일 요구사항

### 대상 계산

독촉 대상 문서:

- 계약 문서 `status = active`
- 활성 첨부파일 수 = 0
- `no_attachment_required = false`
- 작성자 이메일 또는 담당자 이메일이 존재

독촉 제외:

- 활성 첨부파일 1개 이상
- 관리자가 `첨부파일 없음` 지정
- 계약 문서 soft deleted

### 발송 방식

- 1차: 기존 초대 메일과 같은 Nodemailer (`src/lib/mail/smtp.ts`) 우선.
- 사람별로 누락 문서번호를 취합해 메일 1건 발송.
- 메일 본문에는 문서번호 목록, 계약대상, 문서 생성일, 계약서 관리 페이지 링크를 포함한다.
- SMTP 설정/런타임 제약으로 Nodemailer가 불가하면 Supabase Edge Function cron으로 대체한다. 이 대체안은 배포까지 포함되는 구현 리스크로 관리한다.

### 스케줄

- 주 1회 실행.
- 실행 방식은 구현 단계에서 선택:
  - Vercel Cron → `/api/contracts/reminders`
  - Supabase Edge Function cron fallback
- 중복 방지를 위해 run key(예: ISO week)를 저장한다.

---

## UI 요구사항

### 목록 (`/dashboard/contracts`)

- `PageContainer` 사용:
  - `pageTitle="계약서 관리"`
  - `pageDescription="계약서 체결 요청 문서와 첨부 상태를 관리합니다."`
- 상단 안내: `Flex 계약서 체결 요청은 OpenClaw/Gmail 수집을 통해 자동 생성됩니다.`
- 보조 액션: `Import 상태 보기` 또는 `최근 수집 이력` 링크/버튼
- 테이블 컬럼:
  - 문서번호
  - 문서 생성일
  - 작성자
  - 계약대상
  - 계약 내용
  - 금액
  - 첨부파일 상태/목록
  - actions
- 필터:
  - 날짜 범위 캘린더
  - 검색
  - 첨부 상태
- 페이지네이션: 사용자 관리 페이지 패턴
- 상태 표시:
  - `첨부 누락`
  - `첨부 완료`
  - `첨부파일 없음`
  - `삭제됨/비활성`은 빨간 계열 표시

### 상세 보기

첨부 이미지의 계약서 상세/승인 흐름을 참고한다.

- 문서번호, 작성일, 작성자, 계약대상, 계약 내용, 계약 시작/종료일, 비고, 금액을 읽기 좋은 섹션으로 표시한다.
- 첨부파일 목록은 활성/soft deleted 상태를 구분한다.
- 다운로드 버튼은 활성 첨부파일에만 제공한다.
- `첨부파일 없음` 지정/해제는 관리자 확인 UI를 거친다.
- soft delete류 위험 액션은 `AlertModal` 확인 후 실행한다.

### 로딩/모바일

- 비동기 Read 경로는 `loading.tsx` 또는 Suspense fallback 필수.
- Sheet 기반 생성/수정 폼은 모바일에서 CTA가 항상 도달 가능하도록 `SheetContent flex flex-col`, 본문 `flex-1 overflow-auto`, `SheetFooter` 외부 고정 패턴을 따른다.

---

## 활동 감사 로그 (CUD In)

> `core-conventions.mdc` §활동 감사 로그 · 참조 [plan 08](./08_activity-audit-log-plan.md)

### 정책

- READ, 다운로드 GET, 목록/상세 조회는 activity log Out.
- 자동 import 생성/중복/실패, 수정/soft delete, 첨부 업로드/soft delete, `첨부파일 없음` 지정/해제, 독촉 메일 발송 성공/실패는 activity log In.
- Route Handler 진입 시 `requestId = crypto.randomUUID()` 1회 생성.
- 모든 return 직전 `recordActivityLog` 또는 `jsonWithActivityLog`.
- 응답에는 `x-request-id` 헤더 포함.
- log insert 실패는 원 mutation 응답을 바꾸지 않는다.
- metadata는 문서번호, 파일명, 상태, changed_fields, error_code, message 등 비민감 allowlist만 허용한다.

### action 코드

| action | HTTP | Path | target |
|--------|------|------|--------|
| `contract.import_create` | POST | `/api/contracts/import` | 문서번호 |
| `contract.import_duplicate` | POST | `/api/contracts/import` | 문서번호 |
| `contract.import_failed` | POST | `/api/contracts/import` | 문서번호 또는 source_message_id |
| `contract.update` | PATCH | `/api/contracts/[id]` | 문서번호 |
| `contract.soft_delete` | DELETE | `/api/contracts/[id]` | 문서번호 |
| `contract.attachment_upload` | POST | `/api/contracts/[id]/attachments` | 문서번호 + 파일명 |
| `contract.attachment_soft_delete` | DELETE | `/api/contracts/[id]/attachments/[attachmentId]` | 문서번호 + 파일명 |
| `contract.no_attachment_set` | PATCH | `/api/contracts/[id]/no-attachment` | 문서번호 |
| `contract.no_attachment_unset` | PATCH | `/api/contracts/[id]/no-attachment` | 문서번호 |
| `contract.reminder_send` | POST | `/api/contracts/reminders` | 수신자 이메일 |
| `contract.reminder_failed` | POST | `/api/contracts/reminders` | 수신자 이메일 |

`ActivityAction`에 위 action을 추가하고, `ActivityTargetType`에는 `contract`를 추가한다.

### return 분기 매트릭스

| Route | action | 기록 분기 |
|-------|--------|----------|
| `POST /api/contracts/import` | `contract.import_create` / `contract.import_duplicate` / `contract.import_failed` | 401 invalid token · 400 validation/parse · 200 duplicate · 201 created · 500 |
| `PATCH /api/contracts/[id]` | `contract.update` | 401 · 403 · 400 validation · 404 · 200 · 500 |
| `DELETE /api/contracts/[id]` | `contract.soft_delete` | 401 · 403 · 404 · 200 · 500 |
| `POST /api/contracts/[id]/attachments` | `contract.attachment_upload` | 401 · 403 · 400 validation/duplicate/size · 404 · 201 · 500 |
| `DELETE /api/contracts/[id]/attachments/[attachmentId]` | `contract.attachment_soft_delete` | 401 · 403 · 404 · 200 · 500 |
| `PATCH /api/contracts/[id]/no-attachment` | `contract.no_attachment_set` / `contract.no_attachment_unset` | 401 · 403 · 400 validation · 404 · 200 · 500 |
| `POST /api/contracts/reminders` | `contract.reminder_send` / `contract.reminder_failed` | 401 · 403 · 400 no-targets · 200 partial/success · 500 |

### metadata allowlist

| key | 용도 |
|-----|------|
| `document_number` | 계약 문서 식별 |
| `source_message_id` | Gmail message id |
| `source_type` | `openclaw_gmail` 등 생성 출처 |
| `file_name` | 첨부 파일명 |
| `changed_fields` | 수정 필드명 |
| `recipient_email` | 독촉 수신자 |
| `missing_document_numbers` | 독촉 대상 문서번호 목록 |
| `error_code` | 실패 코드 |
| `message` | 비민감 한국어 오류 메시지 |

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `supabase/sql/*_contract_management.sql` | 신규 테이블, RLS, Storage bucket/policy |
| `src/features/contracts/**` | 신규 feature |
| `src/app/dashboard/contracts/page.tsx` | 신규 page |
| `src/app/dashboard/contracts/loading.tsx` | 신규 skeleton |
| `src/app/api/contracts/**` | 신규 Route Handlers |
| `src/app/api/contracts/import/route.ts` | OpenClaw 전용 자동 생성 Import API |
| `src/lib/mail/send-contract-reminder-email.ts` | 신규 Nodemailer 메일 |
| `src/features/activity-logs/api/types.ts` | action/target/metadata 확장 |
| `src/features/activity-logs/api/log.server.ts` | metadata allowlist 확장 |
| `src/config/nav-config.ts` | admin-only nav 추가 |
| `src/lib/searchparams.ts` | 날짜 범위/계약 필터 param 추가 |
| `.env` / `env.example.txt` | `CONTRACT_IMPORT_TOKEN` 및 SMTP/cron 관련 env 문서화 |

---

## 리스크 & 완화책

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | Flex 공식 계약 API 부재 | OpenClaw가 Gmail/Flex 상세를 읽고 WakeOne Import API 호출 |
| 2 | 주간 독촉 중복 발송 | run key / recipient 이력 저장, 사람별 1메일 원칙 |
| 3 | Storage 업로드와 DB insert 불일치 | 업로드 전 검증, DB 실패 시 Storage cleanup 또는 orphan cleanup 태스크 |
| 4 | soft deleted 파일이 독촉 제외 계산에 포함 | 활성 첨부파일만 제외 조건으로 계산 |
| 5 | 계약 내용/파일 경로 등 민감 정보가 log metadata에 저장 | metadata allowlist만 허용 |
| 6 | Nodemailer가 운영 환경에서 실패 | SMTP 설정 검증, 실패 시 Edge Function cron 대체안 명시 |
| 7 | 첨부 용량 기준 혼동 | 구현 기본값을 행당 활성 첨부 총량 1MB로 고정 |
| 8 | OpenClaw의 Flex 로그인 세션 만료/2FA | OpenClaw가 실패 payload를 Import API로 보내거나 Slack 알림 처리 |
| 9 | Gmail/Flex 문서 파싱 오류 | 필수 필드 validation, import_events 실패 이력, admin 보정 UI |

---

## 구현 순서 제안

1. DB/Storage/RLS 및 admin-only/API token guard 설계
2. `POST /api/contracts/import` + `contract_import_events` + idempotent upsert 구현
3. 계약 목록/상세 READ API와 `/dashboard/contracts` skeleton/page 구성
4. 관리자 수정/soft delete mutation + activity log
5. 첨부 업로드/download/soft delete + 중복/용량 검증
6. `첨부파일 없음` 지정/해제 + 독촉 제외 계산
7. Nodemailer 독촉 메일 + 주간 실행 endpoint + idempotency
8. OpenClaw import API 샘플 payload 검증 + Playwright/API 검증 + tsc/lint/build

---

## 열린 질문

| # | 질문 | 기본값 |
|---|------|--------|
| 1 | OpenClaw가 WakeOne Import API에 보낼 최종 payload | 본 문서 payload 후보 기준 |
| 2 | Gmail/Flex 문서에서 작성자 이메일이 항상 추출되는지 | 없으면 작성자명만 저장하고 독촉 대상에서 제외/보정 필요 |
| 3 | 독촉 메일 수신자가 작성자 외 계약 담당자/참조자를 포함하는지 | 작성자 이메일 우선 |
| 4 | 계약 시작/종료일이 항상 외부 문서에 있는지 | nullable 상세 필드 |
| 5 | 주간 발송 요일/시간 | `[TBD]` · 구현 시 운영 기본값 제안 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-07-02 | 최초 작성 · `/root` planner Phase 3+4 · Status Approved | planner |
| 2026-07-03 | Flex 공식 계약 API 부재 확인 후 OpenClaw/Gmail 기반 자동 Import API 구조로 변경 | GPT-5.5 |
