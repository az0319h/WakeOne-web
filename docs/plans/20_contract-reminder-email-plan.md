# 계약서 첨부 누락 독촉 메일 완성 기획서

> Date: 2026-07-10
> Status: Approved
> Author: planner
> **선행:** [08](./08_activity-audit-log-plan.md), [16](./16_contract-management-plan.md), [18](./18_contract-approved-at-plan.md), [19](./19_user-single-name-plan.md)
> **SQL:** `18` (기존) + `25` (unmatched 확장, 구현 시 `supabase/sql/` 최대 번호+1 확인)

## 한 줄 요약

plan 16에서 부분 구현된 **주 1회 계약서 첨부 누락 독촉**을 완성한다. 수신자는 `author_name` ↔ `profiles.full_name` 이름 매칭으로 결정하고, 매주 월요일 18:00 KST Vercel Cron으로 자동 발송하며, run/recipient/unmatched 이력은 **`/dashboard/system-email-logs`** (admin-only, 활동 로그 UI 패턴)에서 조회한다.

---

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **16** (Approved) | 독촉 API·Nodemailer·activity log·`contract_reminder_*` 테이블 초안 — 본 plan에서 **수신자 매핑·Cron·로그 UI·이메일 본문** 완성 |
| **18** (Approved) | `approved_at` 필드 — 독촉 메일 본문에 `document_created_at`과 함께 표시 |
| **19** (Approved) | `profiles.full_name` 필수 — 이름 매칭의 전제 (`author_email` fallback **사용 안 함**) |
| **08** (Approved) | `contract.reminder_send` / `contract.reminder_failed` activity log — 기존 Route 유지·AC 검증 |

**중복 금지:** 활동 로그(`/dashboard/logs`)와 독촉 로그 UI **통합하지 않음**. 수동 발송 UI **Out**. `author_email` fallback **Out**.

---

## 확정 결정 (deep-interview + 사용자 지시)

| 항목 | 결정 |
|------|------|
| **스케줄** | 매주 **월요일 18:00 KST** — Vercel Cron → `POST /api/contracts/reminders` |
| **Idempotency** | ISO week `run_key` — **한 주 1회** run만 실행 (중복 호출 시 skip) |
| **누적 독촉** | 매 run마다 **현재 첨부 누락 상태 재스캔** — 지난주 독촉했어도 여전히 누락이면 **다음 주에도 포함** (별도 "이미 독촉함" 제외 없음) |
| **수신자 매칭** | `contract_documents.author_name` ↔ `profiles.full_name` — **trim + 연속 공백 정규화 + 대소문자 무시** |
| **동명이인** | 매칭된 **모든** profile에게 **각각 별도 메일** — 동일 `author_name`의 **모든 누락 계약 목록을 동일하게** 포함 |
| **미등록** | **미전송** — run에 `unmatched_targets` 기록 (author_name, document_numbers, 사유) |
| **author_email** | **fallback 사용 안 함** |
| **수동 발송** | **Out** — cron 자동만 |
| **발신** | `wakeone,ops@gmail.com` — `SMTP_FROM` env |
| **메일 날짜** | `document_created_at` + `approved_at` **둘 다** — `approved_at` null이면 해당 날짜 **필드 생략** (행 유지) |
| **메일 필드 제외** | 금액·계약 내용 요약 **미포함** |
| **CTA 버튼** | **없음** (문서번호 `source_document_url` 하이퍼링크는 **허용**) |
| **로그 UI** | `/dashboard/system-email-logs` — admin-only, 활동 로그와 **동일 구조** (PageContainer + 테이블 + Suspense) |
| **로그 상세** | run row 클릭 → **Dialog** — 문서번호 목록, 수신자, 발송/실패/미매칭 상태·사유 |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API | `18`+`25` migration 적용, 첨부 누락 계약 2건(`author_name=홍길동`), `profiles.full_name=홍길동` 사용자 1명 | cron secret으로 `POST /api/contracts/reminders` | HTTP 200, 홍길동 profile email로 메일 1건, `contract_reminder_runs` 1행·`contract_reminder_recipients` 1행(sent), activity log `contract.reminder_send` |
| AC-02 | API | 동명이인 2명(`full_name=김철수`), `author_name=김철수` 누락 계약 3건 | 독촉 실행 | **2명 각각** 동일 3건 문서번호 목록으로 메일 2건, recipient 2행 |
| AC-03 | API | `author_name=미등록인` 누락 계약 1건, 매칭 profile 0명 | 독촉 실행 | 해당 계약 **미전송**, run `unmatched_targets`에 author_name·document_numbers·`no_profile_match` 기록, recipient 행 **없음** |
| AC-04 | API | 활성 첨부 1개 이상 또는 `no_attachment_required=true` | 독촉 실행 | 해당 문서 **제외** (plan 16 AC-18 동일) |
| AC-05 | API | 동일 ISO week에 이미 completed run 존재 | 같은 `run_key`로 재호출 | HTTP 200 duplicate, **재발송 없음**, metadata `duplicate_run` |
| AC-06 | API | 지난주 독촉 후에도 여전히 첨부 누락인 계약 | **다음 ISO week** run | 해당 계약 **다시 포함**·재발송 |
| AC-07 | API | SMTP 실패 | 독촉 실행 | recipient `status=failed`, `error_message` 저장, activity log `contract.reminder_failed`, run `partial_failed` 또는 `failed` |
| AC-08 | API | cron secret 없이 `system_role=user` | `POST /api/contracts/reminders` | HTTP 403 |
| AC-09 | Playwright | admin 로그인 | `/dashboard/system-email-logs` 이동 | 페이지 제목 **「시스템 이메일 로그」**, run 목록 테이블 표시 |
| AC-10 | Playwright | `system_role=user` | `/dashboard/system-email-logs` 직접 접근 | `/dashboard/overview` 리다이렉트 또는 접근 거부, 목록 미표시 |
| AC-11 | Playwright | admin, 독촉 run 1건 이상 | run row 클릭 | Dialog에 **문서번호 목록**, 수신자 email, 발송/실패 상태, 미매칭 author_name·사유 표시 |
| AC-12 | Playwright | admin | 사이드바 nav 확인 | **「시스템 이메일 로그」** 메뉴(admin-only) 표시, 활동 로그와 유사 위치 |
| AC-13 | API | 독촉 발송 1건 성공 | `GET /api/activity-logs?action=contract.reminder_send` | action·recipient_email·missing_document_numbers metadata 확인 |
| AC-14 | grep | `vercel.json` | cron path 확인 | `POST /api/contracts/reminders`, 월요일 **09:00 UTC**(18:00 KST), `CONTRACT_REMINDER_CRON_SECRET` 헤더 |
| AC-15 | CLI | 구현 완료 | `bunx playwright test e2e/contract-reminder/` | spec green |

---

## 범위 (In / Out)

### In Scope

- **수신자 매핑 변경:** `listContractReminderRecipientGroups()` — `profiles.full_name` 조회·정규화 매칭, 동명이인 다중 발송, unmatched 수집
- **DB:** `18_contract_reminders.sql` remote 적용 + `unmatched_targets` (jsonb) run 컬럼 또는 동등 구조 (`25_*`)
- **이메일 템플릿:** `send-contract-reminder-email.ts` — 사용자 확정 HTML/텍스트 (§이메일 본문)
- **Vercel Cron:** `vercel.json` — 월 18:00 KST
- **Read API:** run 목록·상세(recipients + unmatched) — admin-only
- **UI:** `/dashboard/system-email-logs` — activity logs 패턴 (prefetch, Suspense, skeleton, nuqs page/perPage)
- **nav:** admin-only 사이드바 항목
- **activity log:** 기존 `POST /api/contracts/reminders` 전 분기 유지
- **E2E:** `e2e/contract-reminder/` spec

### Out Scope

- 관리자 **수동 발송** 버튼/UI
- `author_email` fallback
- "이미 독촉함" 영구 제외 로직
- 활동 로그 페이지와 UI **통합**
- 이메일 **CTA 버튼**·계약서 관리 페이지 deep link (문서번호 `source_document_url` 하이퍼링크는 **In**)
- 금액·계약 내용 본문 포함
- 독촉 로그 수정/삭제
- Supabase Edge Function cron fallback (1차는 Vercel Cron만)

---

## 독촉 대상 계산

매 run 실행 시 **현재 시점** 기준:

| 조건 | 포함 |
|------|------|
| `status = active` | ✅ |
| 활성 첨부파일 수 = 0 | ✅ |
| `no_attachment_required = false` | ✅ |
| 작성자 이름 → profile 매칭 ≥ 1 | ✅ → 각 profile email 발송 |
| 작성자 이름 → profile 매칭 = 0 | ❌ 발송 → `unmatched_targets` |

**제외:** soft deleted, 첨부 있음, `첨부파일 없음` 지정.

---

## 이름 매칭 알고리즘

```
normalize(s) = trim(s).replace(/\s+/g, ' ').toLowerCase()

for each missing contract with author_name A:
  profiles = all active profiles where normalize(full_name) = normalize(A)
  if profiles.length === 0:
    append to unmatched_targets[{ author_name, document_numbers, contract_ids, reason: 'no_profile_match' }]
  else:
    for each profile in profiles:
      add contract to recipient group keyed by profile.email
      (동명이인 N명 → N groups, each gets full list for author_name A)
```

- **author_email** 컬럼은 조회·발송에 **사용하지 않음**.
- plan **19** `full_name` NOT NULL 전제; null profile은 매칭 대상에서 제외.

---

## 이메일 본문 (확정 초안)

**제목:** `[WakeOne] 계약서 누락 안내 ({N}건)`

**HTML 구조:**

| 영역 | 내용 |
|------|------|
| 헤더 | **계약서 누락 안내** |
| 인사 | `{author_name}님, 아래 계약서 체결 요청 문서의 계약서를 전달해 주시지 않아서 전달 요청드립니다` |
| 목록 | bullet — **`document_number`는 `source_document_url`이 있으면 HTML `<a href>` 하이퍼링크**, 없으면 plain text — `/ {contract_target} / 문서생성일: {document_created_at}` + (`approved_at` 있으면) ` / 문서승인일: {approved_at}` |
| CTA | **없음** (페이지 이동용 별도 버튼 없음 — 문서번호 링크만 허용) |
| 푸터 | `해당 이메일 회신을 통해 계약서를 전달을 부탁드립니다. 감사합니다.` |

**문서번호 링크 규칙:**

| 조건 | HTML | plain text |
|------|------|------------|
| `source_document_url` 있음 | `<a href="{url}">{document_number}</a>` (새 탭 `target="_blank"`) | `{document_number} ({url})` |
| 없음 | `{document_number}` (링크 없음) | `{document_number}` |

- 링크 대상: 계약 row의 `source_document_url` (OpenClaw/Flex 등 외부 문서 URL). WakeOne 대시보드 deep link **아님**.
- 독촉 대상 조회·메일 템플릿에 `source_document_url` 필드 **포함** 필요.

**텍스트/plain:** HTML과 동일 정보; 문서번호에 URL 있으면 괄호로 URL 병기. 별도 CTA 버튼 없음.

**발신:** `SMTP_FROM` (= `wakeone,ops@gmail.com` 운영 설정).

---

## Vercel Cron

```json
{
  "crons": [{
    "path": "/api/contracts/reminders",
    "schedule": "0 9 * * 1"
  }]
}
```

- **09:00 UTC = 18:00 KST** (월요일).
- Request header: `Authorization: Bearer ${CONTRACT_REMINDER_CRON_SECRET}` (기존 `_utils` 패턴).
- Cron 실패 시 Vercel 대시보드 + run `failed` + activity log로 추적.

---

## 데이터 모델

### 기존 (`18_contract_reminders.sql`)

- `contract_reminder_runs` — run_key, trigger_source, status, counts
- `contract_reminder_recipients` — run_id, recipient_email, author_name, document_numbers, status

### 신규/확장 (`25_*` 또는 `18` amend)

`contract_reminder_runs`에 컬럼 추가:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `unmatched_targets` | `jsonb not null default '[]'` | `[{ author_name, contract_ids, document_numbers, reason }]` |

`reason` enum: `no_profile_match` (1차).

**RLS:** 기존 admin select 유지. INSERT/UPDATE/DELETE는 service role only (Route Handler).

---

## API / Service Layer

### Feature 구조

```txt
src/features/system-email-logs/api/   (또는 contract-reminder-logs)
  types.ts
  service.server.ts
  queries.ts
src/features/contracts/api/
  service.server.ts  — listContractReminderRecipientGroups 수정
```

| Method | Path | 용도 | Auth | Log |
|--------|------|------|------|-----|
| POST | `/api/contracts/reminders` | 주간 독촉 실행 | cron secret / admin | `contract.reminder_send` / `contract.reminder_failed` (기존) |
| GET | `/api/system-email-logs` | run 목록 (page, perPage, sort) | admin | READ Out |
| GET | `/api/system-email-logs/[runId]` | run 상세 + recipients + unmatched_targets | admin | READ Out |

**POST reminders 응답 확장:** `unmatched_targets` 배열 포함.

---

## UI 요구사항

### `/dashboard/system-email-logs`

- **참조:** `/dashboard/logs` — `PageContainer`, `Suspense`, skeleton, nuqs pagination
- **pageTitle:** `시스템 이메일 로그`
- **pageDescription:** `계약서 첨부 누락 독촉 등 시스템 발송 이메일 run 이력을 확인합니다.`
- **RBAC:** `requireAdminPage` + API 403
- **테이블 컬럼 (run):** 실행 시각, run_key, trigger(admin/cron), status, 대상 수, 발송 성공, 실패, 미매칭 건수
- **row 클릭:** Dialog — recipients 테이블(수신자, author_name, document_numbers, status, error_message) + unmatched_targets 섹션(author_name, document_numbers, reason)
- **loading.tsx** 또는 Suspense fallback 필수

### nav

- `nav-config.ts` — admin-only, **계정** 그룹 또는 활동 로그 인접
- title: `시스템 이메일 로그`, url: `/dashboard/system-email-logs`

---

## 활동 감사 로그

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

### 정책

- **CUD In:** `POST /api/contracts/reminders` — 기존 action 유지
- **READ Out:** `GET /api/system-email-logs*` — activity log **기록하지 않음**
- 독촉 로그 UI는 **Read only** — append-only DB, 수정/삭제 UI **없음**

### 기록 연동 (기존 유지·확장)

| Route | action | return 분기 |
|-------|--------|-------------|
| `POST /api/contracts/reminders` | `contract.reminder_send` | 200 success · 200 duplicate_run · 수신자별 sent |
| `POST /api/contracts/reminders` | `contract.reminder_failed` | 401 · 403 · 400 no-targets · 500 · 수신자별 failed |
| `POST /api/contracts/reminders` | (metadata) | `unmatched_count` allowlist 추가 가능 |

### metadata allowlist (추가)

| key | 용도 |
|-----|------|
| `unmatched_count` | 미매칭 계약 건수 |
| `unmatched_author_names` | 미매칭 작성자명 배열 (비민감) |

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `supabase/sql/18_contract_reminders.sql` | remote 적용 + Status Completed |
| `supabase/sql/25_contract_reminder_unmatched.sql` | `unmatched_targets` 컬럼 (번호는 구현 시 확인) |
| `vercel.json` | **신규** — cron |
| `src/features/contracts/api/service.server.ts` | `listContractReminderRecipientGroups` — full_name 매칭 |
| `src/lib/mail/send-contract-reminder-email.ts` | 본문·날짜 필드·CTA 제거 |
| `src/app/api/contracts/reminders/route.ts` | unmatched 저장·응답 |
| `src/features/system-email-logs/**` | Read feature 신규 |
| `src/app/dashboard/system-email-logs/page.tsx` | 신규 page |
| `src/app/dashboard/system-email-logs/loading.tsx` | skeleton |
| `src/app/api/system-email-logs/**` | Read Route Handlers |
| `src/config/nav-config.ts` | admin nav |
| `src/lib/searchparams.ts` | 필요 시 filter keys |
| `env.example.txt` | SMTP_FROM 예시 (`wakeone,ops@gmail.com`) |
| `e2e/contract-reminder/*.spec.ts` | Playwright AC |

**의존:** plan **19** `profiles.full_name` migration 적용 후 이름 매칭 AC-02~03 검증.

---

## 리스크 & 완화책

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | `18` SQL remote 미적용 | 구현 1순위 migration + MCP apply |
| 2 | 동명이인 중복 스팸 | 사용자 확정 — 동일 목록 2통 허용, run/recipient로 추적 |
| 3 | 이름 불일치(띄어쓰기·표기) | normalize 규칙 AC·단위 테스트 |
| 4 | plan 19 미구현 시 매칭 불가 | BE: 19 선행 또는 stub 없이 blocker 명시 |
| 5 | Cron timezone 오류 | `0 9 * * 1` UTC = 18:00 KST 문서화 + AC-14 |
| 6 | unmatched만 있는 run | target_count=0, unmatched>0 → run completed + UI 미매칭 섹션 |

---

## 구현 순서 제안

1. DB: `18` apply + `unmatched_targets` migration
2. BE: full_name 매칭 + unmatched + email template
3. BE: `GET /api/system-email-logs` Read API
4. FE: `/dashboard/system-email-logs` + Dialog + nav
5. `vercel.json` cron
6. E2E spec + activity log API 검증

---

## E2E spec 구조 (verifier용)

```txt
e2e/contract-reminder/
  system-email-logs.spec.ts   — AC-09~12 (admin/user RBAC, Dialog)
  reminders-api.spec.ts       — AC-01~08, 13 (API·storageState admin)
```

셀렉터: `getByRole` · `getByTestId` only.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-07-10 | 이메일 본문 문서번호 `source_document_url` 하이퍼링크 허용 | planner |
| 2026-07-10 | 최초 작성 · deep-interview 확정 · Status Approved | planner |
