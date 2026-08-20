# CS 문의 (Support Requests) 기획서

> Date: 2026-08-18  
> Status: Approved  
> Author: planner  
> **SQL:** `45` · `supabase/sql/45_support_requests.sql`  
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [39](./39_announcements-plan.md), [40](./40_filter-shell-loading-ux-plan.md)  
> **개발자 검증:** [42_cs-support-dev-checklist.md](./42_cs-support-dev-checklist.md) — **verifier Subagent Out** (수동 QA)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **07** auth-route-guard | Completed | `/dashboard/support`·`/api/support*` 세션 필수 · defense in depth |
| **08** activity-audit-log | Approved | CUD Route **전 HTTP 분기** `recordActivityLog` · `support.*` action 신규 |
| **39** announcements | Approved | **1차 UI/UX 참조** — infinite list · filter shell · detail Dialog · nuqs deep-link |
| **40** filter-shell-loading | Approved | filter·toolbar Suspense **밖** · data body `PageLoadingSpinner variant="fill"` |
| **27** notifications | Approved | admin **UserCombobox** 패턴 — admin user 필터 참조 |
| **41** user-my-contracts | Approved | user-scoped READ · 단일 URL + role별 API scope 참고 |

**폐기 scope:** nav-user email-only Form Sheet · Nodemailer · `wakeone.ops@gmail.com` · ticket DB 없음 → **이번 In에 DB·listing·상태·user PATCH 포함**.

---

## 한 줄 요약

`/dashboard/support` 단일 URL에서 **전 로그인 사용자**가 본인 CS 문의를 **목록·상세 Dialog**로 추적하고 **「문의하기」Sheet**로 등록하며, **`pending`(접수대기) 상태에서만** 제목·본문을 수정한다. **admin**은 전체 문의를 user/status/search 필터로 조회하고 detail Dialog에서 **status를 `received`(접수됨) → `completed`(처리완료)** 로 변경한다. **이메일 발송 없음** — ops는 CS 페이지 detail에서 전문 확인.

---

## 정책 확정안 (deep-interview · battle-plan · `go`)

| 항목 | 확정 |
|------|------|
| **URL** | `/dashboard/support` — admin·user **동일 URL** (API가 role별 scope) |
| **Nav** | Account 그룹 **「CS 문의」** → `/dashboard/support` · **전 authenticated** (`access` 없음) |
| **「문의하기」 CTA** | **`/dashboard/support` `pageHeaderAction` ONLY** — nav-user·다른 화면 **Out** |
| **Create UI** | **Sheet** (우측 slide-out) · `useAppForm` + Zod · 이름·이메일 **read-only** (세션 프로필) |
| **Detail UI** | 행 클릭 → **Dialog** · `/dashboard/support/[id]` page route **Out** |
| **Deep-link** | nuqs `?support={id}` — detail Dialog auto-open (announcements `announcement=` 패턴) |
| **Status enum** | `pending`(접수대기) · `received`(접수됨) · `completed`(처리완료) |
| **Status 초기값** | create 직후 **`pending`** |
| **Status 변경** | **admin only** · `pending`→`received`→`completed` · **역방향·재오픈 없음** |
| **User 수정** | **`pending`만** title·body PATCH 가능 · `received`/`completed` **잠금** |
| **User 취소/삭제** | **Out** |
| **이메일** | create/update/status 변경 시 **Nodemailer Out** · in-app 알림 fan-out **Out** |
| **목록** | infinite scroll · cursor pagination (announcements 동일) |
| **Admin 필터** | UserCombobox(전체/특정 user) · search(제목·본문) · status multi-select · 초기화 |
| **Admin listing 컬럼** | submitter name·email(**create 시 스냅샷**) · status Badge · title · created_at |
| **User listing 컬럼** | status Badge · title · created_at (submitter 컬럼 **없음**) |
| **타임스탬프** | `@/lib/format-datetime` **`formatAbsoluteDateTimeKo` only** |
| **검증** | **Playwright spec Out** — [dev-checklist](./42_cs-support-dev-checklist.md) 수동 QA |

---

## 목표 & 완료 기준 (AC)

> **검증 방식:** 본 plan은 `/root` 파이프라인에서 **verifier Subagent 생략**. AC는 개발자가 checklist로 **Manual** 또는 **API** 검증.

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Manual | active user | sidebar Account | **「CS 문의」** 표시 · 클릭 시 `/dashboard/support` |
| AC-02 | Manual | user | `/dashboard/support` | `pageTitle` **「CS 문의」** · **`pageHeaderAction`「문의하기」** 표시 |
| AC-03 | Manual | user | nav-user 드롭다운 확인 | **CS 문의·문의하기 항목 없음** (nav-user shortcut **Out**) |
| AC-04 | Manual | user | **「문의하기」** Sheet — 제목≥2·본문≥10 입력 후 저장 | 목록 1행 · status **접수대기** · 본인만 보임 · Sheet 닫힘 · 폼 reset · 성공 토스트 |
| AC-05 | Manual | user | Sheet에서 제목&lt;2 또는 본문&lt;10 제출 | Zod 한국어 에러 · 제출 차단 · Sheet 유지 |
| AC-06 | Manual | user | Sheet 이름·이메일 필드 | 프로필 `full_name`·`email` **read-only/disabled** |
| AC-07 | Manual | user A, A의 문의 1건 | user B가 목록·detail 접근 시도 | B 목록에 A 문의 **없음** · B가 A id detail API **403/404** |
| AC-08 | Manual | user, status **접수대기** 문의 | detail Dialog에서 제목·본문 수정 저장 | 목록·detail 갱신 · **「수정됨 {formatAbsoluteDateTimeKo(updated_at)}」** (updated_at &gt; created_at) |
| AC-09 | Manual | user, status **접수됨** 또는 **처리완료** | detail Dialog | 제목·본문 **수정 UI 없음**(read-only) · PATCH 시도 시 **403** |
| AC-10 | Manual | admin | `/dashboard/support` | **전체 user** 문의 · submitter name·email(**스냅샷**) 컬럼 · user/status/search 필터 |
| AC-11 | Manual | admin | detail Dialog에서 status **접수됨** 저장 | Badge **접수됨** · user listing에도 반영 · `status_updated_at`·`status_updated_by` 갱신 |
| AC-12 | Manual | admin | status **처리완료** 저장 | Badge **처리완료** · **재오픈 UI 없음** · `pending`/`received`로 되돌리기 **403** |
| AC-13 | Manual | user (non-admin) | detail Dialog | status 변경 UI **없음** · 본문 read-only(**pending**이면 edit 가능) |
| AC-14 | Manual | user | 목록 행 클릭 | read-only/detail Dialog · `?support={id}` deep-link auto-open |
| AC-15 | Manual | DB seed 11건+ | 목록 하단 스크롤 | cursor **lazy load** · `PageLoadingSpinner variant="compact"` · filter shell **유지** (plan 40) |
| AC-16 | API | user | `POST /api/support` 2xx | `activity_logs` **1건** · action **`support.create`** · `x-request-id` |
| AC-17 | API | user, own `pending` | `PATCH /api/support/[id]` title/body 2xx | action **`support.update`** · metadata `changed_fields` |
| AC-18 | API | user, own `received`/`completed` | `PATCH /api/support/[id]` body 변경 | **403** + log |
| AC-19 | API | admin | `PATCH /api/support/[id]` status 2xx | action **`support.status_update`** · metadata `previous_status`·`new_status` |
| AC-20 | API | user | `PATCH /api/support/[id]` status 변경 시도 | **403** + log |
| AC-21 | Manual | 모바일 viewport | **「문의하기」** Sheet 스크롤 | `SheetFooter` CTA **항상 도달 가능** (flex-col · footer form 밖) |
| AC-22 | Manual | — | create/update/status **전 경로** | **Nodemailer·ops 이메일 호출 없음** |

**회귀:** plan 39 announcements · plan 07 auth · nav-user 기존 메뉴 **변경 없음**(CS 항목 추가만 nav-config).

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE SQL → BE API → FE → E2E Out · checklist QA**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **SQL 45** | `support_requests` · RLS · indexes · `updated_at` trigger |
| B | **BE API** | `GET/POST /api/support` · `GET/PATCH /api/support/[id]` |
| C | **BE activity log** | `support.create` · `support.update` · `support.status_update` |
| D | **FE feature** | `src/features/support/api/*` · queries · mutations |
| E | **FE UI** | list page · infinite list · filters · detail Dialog · form Sheet |
| F | **Nav** | Account **「CS 문의」** |
| G | **Dev checklist** | [42_cs-support-dev-checklist.md](./42_cs-support-dev-checklist.md) |

### Out Scope

| 항목 | 비고 |
|------|------|
| Nodemailer · `wakeone.ops@gmail.com` | **Out** — create/update/status **이메일 없음** |
| nav-user CS shortcut | **Out** |
| `/dashboard/support/[id]` page route | **Out** — Dialog + query param |
| user 취소·hard delete | **Out** |
| status 재오픈·rollback | **Out** |
| 첨부·댓글·FAQ | **Out** |
| overview widget · in-app 알림 fan-out | **Out** |
| Playwright spec · verifier Subagent | **Out** — dev checklist |
| Storage bucket | **Out** |

---

## DB (`supabase/sql/45_support_requests.sql`)

```sql
-- Plan: 42_cs-support-plan.md
-- Date: 2026-08-18
-- Status: Approved

create table public.support_requests (
  id bigint generated always as identity primary key,
  submitted_by uuid not null references auth.users(id),
  submitter_name text not null,
  submitter_email text not null,
  title text not null check (char_length(trim(title)) >= 2),
  body text not null check (char_length(trim(body)) >= 10),
  status text not null default 'pending'
    check (status in ('pending', 'received', 'completed')),
  status_updated_at timestamptz,
  status_updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_support_requests_user_list
  on public.support_requests (submitted_by, created_at desc, id desc);

create index idx_support_requests_admin_list
  on public.support_requests (status, created_at desc, id desc);

-- updated_at trigger (announcements 패턴)
-- RLS:
--   SELECT authenticated AND (submitted_by = auth.uid() OR is_admin())
--   INSERT/UPDATE/DELETE authenticated role revoke → Route service_role only
```

| 컬럼 | 용도 |
|------|------|
| `submitter_name` / `submitter_email` | create 시 `profiles` **스냅샷** — 이후 프로필 변경과 무관 |
| `status` | listing Badge · admin 필터 · user edit gate |
| `status_updated_by/at` | admin status 변경 이력 · detail 표시 |
| `updated_at` | user PATCH 시 갱신 · **「수정됨」** 표시 |

### Status 전이 (서버 강제)

| from | to | actor |
|------|-----|-------|
| `pending` | `received` | admin |
| `received` | `completed` | admin |
| `pending` | `completed` | **403** (received 경유 필수) |
| any | `pending` | **403** (재오픈 없음) |

---

## 권한 / RBAC

| 대상 | user (본인) | admin |
|------|---------------|-------|
| nav 「CS 문의」 | ✅ | ✅ |
| `/dashboard/support` | ✅ | ✅ |
| 목록 scope | `submitted_by = me` | **전체** |
| `POST /api/support` | ✅ | ✅ (본인 문의 생성 가능) |
| `GET /api/support/[id]` | own only | all |
| `PATCH` title/body | own + **`status=pending`** | **403** |
| `PATCH` status | **403** | ✅ (전이 규칙 준수) |
| DELETE | **403** | **403** (Out) |

- nav·UI 숨김은 UX — **Route Handler 서버 가드 필수** (plan 07).
- detail·PATCH는 목록과 **별도 ownership 재검증** (IDOR 방지).

---

## API / Service Layer

### Routes

| Route | Method | Role | 동작 |
|-------|--------|------|------|
| `/api/support` | GET | authenticated | cursor infinite list · user: own · admin: all + filters |
| `/api/support` | POST | authenticated | INSERT · `status=pending` · submitter 스냅샷 |
| `/api/support/[id]` | GET | authenticated | 단건 · user: own · admin: all · 404 |
| `/api/support/[id]` | PATCH | authenticated | **user:** `{ title, body }` if `pending`+own · **admin:** `{ status }` only · 403/400 |

### 목록 query (announcements 패턴)

| Query | user | admin |
|-------|------|-------|
| `cursor`, `limit` | ✅ | ✅ |
| `search` | ✅ (제목·본문) | ✅ |
| `status` | ✅ (multi) | ✅ |
| `submitted_by` | **무시/403** | ✅ (UserCombobox · UUID) |

**Read:** `useSuspenseInfiniteQuery(supportInfiniteQueryOptions)`  
**CUD:** `mutations.ts` → `service.ts` → `/api/*` · `onSettled` → `supportKeys.all` invalidate

### Feature 구조

```
src/features/support/api/
  types.ts              — SupportStatus · filters · payloads
  service.ts            — fetch wrappers
  service.server.ts     — cursor encode/decode · scope helpers
  keys.ts               — supportKeys · SUPPORT_PAGE_SIZE
  queries.ts            — supportInfiniteQueryOptions · supportDetailQueryOptions
  mutations.ts          — createSupport · updateSupport · updateSupportStatus
  filter-utils.ts
src/features/support/components/
  support-page.tsx
  support-infinite-list.tsx
  support-list-filters.tsx
  support-list-row.tsx
  support-status-badge.tsx
  support-detail-dialog.tsx      — user: edit form(pending) / admin: status controls
  support-form-sheet.tsx         — create only
src/app/dashboard/support/
  page.tsx · loading.tsx
```

---

## 활동 감사 로그

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

### 기록 범위

| 구분 | 기록 |
|------|------|
| `support.create` | **In** |
| `support.update` | **In** (user title/body PATCH) |
| `support.status_update` | **In** (admin status PATCH) |
| GET list/detail | **Out** (READ) |

### 기록 연동

| Route | action | target_type | return 분기 |
|-------|--------|-------------|-------------|
| `POST /api/support` | `support.create` | `support_request` | 401 · 400 · 201 · 500 |
| `PATCH /api/support/[id]` (user fields) | `support.update` | `support_request` | 401 · 403 · 400 · 404 · 200 · 500 |
| `PATCH /api/support/[id]` (admin status) | `support.status_update` | `support_request` | 401 · 403 · 400 · 404 · 200 · 500 |

**`ActivityAction` 확장:** `support.create` · `support.update` · `support.status_update`  
**`ActivityTargetType` 확장:** `support_request`  
**`ACTION_LABELS`:** CS 문의 등록 · CS 문의 수정 · CS 문의 상태 변경  
**metadata allowlist:**

| action | keys |
|--------|------|
| create 2xx | `support_request_id` · `title`(max 100 truncate) · `body_length` |
| update 2xx | `support_request_id` · `changed_fields` (`title`/`body`) |
| status_update 2xx | `support_request_id` · `previous_status` · `new_status` |
| 4xx/5xx | `error_code` · `message` (한국어 Route message) |

**본문 전문·이메일·토큰 metadata 저장 금지.**

**삭제 확인 Dialog:** DELETE **Out** — `AlertModal` 해당 없음.

---

## UI 요구사항 (designer / FE)

### `/dashboard/support`

- `PageContainer` — `pageTitle="CS 문의"` · `pageDescription` — 본인 문의 추적 안내(user/admin 공통 copy, admin은 전체 관리 문구 보조)
- **`pageHeaderAction`:** Button **「문의하기」** → `SupportFormSheet` open — **이 페이지만**
- Filter shell Suspense **밖** · list body `Suspense key={querySignature}` + `PageLoadingSpinner variant="fill"` (plan 40)
- **`SupportInfiniteList`** — cursor · admin extra columns
- 행 클릭 → **`SupportDetailDialog`**

### `SupportFormSheet` (create)

- `SheetContent className="flex min-h-0 flex-col"` · 본문 scroll · **`SheetFooter` form 밖**
- Fields: 이름·이메일 disabled · 제목 · 본문(textarea)
- Success: toast **「문의가 접수되었습니다.」** · close · `form.reset()`

### `SupportDetailDialog`

| role | status | UI |
|------|--------|-----|
| user | `pending` | 제목·본문 **편집 가능** · 저장 → `updateSupportMutation` |
| user | `received`/`completed` | **read-only** 전체 |
| admin | any | 제출자 스냅샷·본문 read-only · **status Select/Radio + 저장** → `updateSupportStatusMutation` |

- Status Badge: `SupportStatusBadge` — 접수대기 / 접수됨 / 처리완료
- Timestamps: `formatAbsoluteDateTimeKo` · `font-mono text-xs whitespace-nowrap`

### Nav

```ts
// src/config/nav-config.ts — Account 그룹
{ title: 'CS 문의', url: '/dashboard/support', icon: 'help', shortcut: ['c', 's'], items: [] }
```

### Deep-link

- `src/lib/searchparams.ts` — `support: parseAsString`
- `?support={id}` — mount 시 detail Dialog open (announcements 패턴)

---

## `/root` 파이프라인 (본 feature)

| 단계 | 포함 |
|------|------|
| planner | ✅ (본 document) |
| designer → backend-dev → frontend-dev | **`승인` 후** |
| **verifier** | **❌ Out** — [dev-checklist](./42_cs-support-dev-checklist.md) |

---

## 수정 이력

| 날짜 | 변경 |
|------|------|
| 2026-08-18 | 최초 Approved — listing+DB+status+user edit(pending) · email Out · verifier Out · dev checklist |
