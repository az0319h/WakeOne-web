# Activity / Audit Log 기획서

> Date: 2026-06-04  
> Status: Approved  
> Author: planner  
> **SQL:** `10` · `supabase/sql/10_activity_logs.sql` (구현 시)  
> **선행:** [01](./01_supabase-auth-login-plan.md) ~ [07](./07_auth-route-guard-plan.md) (Completed)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **01** | Supabase Auth · `profiles.system_role` · middleware 세션 |
| **02~06** | Users invite/update/deactivate/reactivate · profile PATCH · admin RBAC — **CUD 기록 대상 Route Handler** |
| **07** | `/api/*` `requireSession` · `requireAdminSession` · defense in depth — **로깅은 mutation Route Handler server-side (성공·실패 전 분기)** |
| **sql/01 → sql/04** | 구 `audit_logs` 테이블은 **sql/04에서 DROP** — 본 plan은 **`activity_logs` 신규** (스키마·RLS 재설계, 이름 충돌 없음) |

**중복 금지:** READ(조회) API·페이지 방문 로깅 **Out**. 로그 수정·삭제 UI/API **Out**. export **후속 plan**.

---

## 한 줄 요약

Users·Profile 등 **CUD mutation Route**의 **모든 HTTP 응답(2xx/4xx/5xx)**을 append-only `activity_logs`에 기록하고, **동일 UI**의 `/dashboard/logs`에서 **user는 actor∪target 본인 관련**, **admin은 전체(+ actor_search 필터)** 조회한다. shadcn **tables-api-logs** 컬럼에 **행위자·액션·대상** audit 컬럼을 더하고, **조건부 행 확장**으로 metadata·실패 상세를 노출한다.

---

## 정책 확정안

| 항목 | 확정 |
|------|------|
| **기록 범위** | 확정 **6 mutation Route** — CREATE/UPDATE/DELETE 및 invite/reactivate/deactivate/password_change 등 **모든 응답 분기(2xx/4xx/5xx)** 1건 append |
| **READ** | **기록하지 않음** — `GET` Route Handler·페이지 조회·React Query fetch **Out** |
| **실패 요청** | 401/403/400/404/500 등 mutation Route **전부 기록 In** — Status Badge 4xx amber · 5xx red **실사용** |
| **불변성** | **UPDATE·DELETE 금지** — DB trigger + RLS(INSERT authenticated 없음) + API·UI에 삭제/편집 **없음** |
| **INSERT 주체** | Route Handler **`service_role`** 전용 — 클라이언트·authenticated role **직접 INSERT 불가** |
| **조회 권한** | **user:** `actor_user_id = auth.uid()` **OR** `target_user_id = auth.uid()` · **admin:** 전체 |
| **보관 기간** | **무기한** — purge·아카이브·파티션 **후속 plan** |
| **페이지 접근** | `/dashboard/logs` — **로그인 user 전원** (admin-only path **아님**) |
| **UI** | user·admin **동일 컴포넌트** — 데이터는 API/RLS가 필터 · admin만 **actor_search** Input |
| **행 확장** | **조건부 B** — 아래 §UI 요구사항 |
| **Request ID** | mutation 처리 시 `crypto.randomUUID()` — 응답 헤더 `x-request-id` **[INFERRED]** |
| **민감 데이터** | `metadata`에 **비밀번호·토큰·임시비밀번호** 저장 **금지** — `error_code`·allowlist message·changed_fields 등 **비민감**만 |
| **products mock** | `/api/products` CUD — **데모 데이터 Out** (본 plan 기록 대상 아님) |

### action 코드 (확정)

| action | HTTP | Path | actor | target |
|--------|------|------|-------|--------|
| `user.invite` | POST | `/api/users` | admin (또는 401/403 시 null·session) | 신규 `user_id` 또는 attempted email |
| `user.update` | PUT | `/api/users/[id]` | admin | `[id]` |
| `user.reactivate` | PATCH | `/api/users/[id]` | admin | `[id]` |
| `user.deactivate` | DELETE | `/api/users/[id]` | admin | `[id]` |
| `profile.update` | PATCH | `/api/profile` | 본인 | 본인 `user_id` |
| `profile.password_change` | PATCH | `/api/profile/password` | 본인 | 본인 `user_id` |

### 실패 시 metadata allowlist

| 키 | 용도 |
|----|------|
| `error_code` | `unauthenticated` · `forbidden` · `validation` · `duplicate_email` · `forbidden_field` · `inactive_user` · `not_found` · `wrong_password` · `internal_error` 등 enum |
| `message` | Route 기존 **한국어** 응답 message (비밀번호 상세·토큰 **제외**) |
| `validation_errors` | Zod 등 필드 오류 요약 (필드명만, 값 **민감 필드 제외**) |
| `changed_fields` | 2xx UPDATE 시 변경 필드명 배열 |
| `attempted_target` | early 400에서 `target_user_id` 미확정 시 email 또는 id |

**401 시:** `actor_user_id = null`, `actor_email = 'anonymous'` **[INFERRED]**

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin | Users에서 user B **초대** 성공 | `/dashboard/logs` 이동 | 최신 행: Method **POST** · Endpoint **`/api/users`** · Status **2xx green Badge** · Action **`user.invite`** · Target B 이메일(또는 id) · Actor admin 표시 |
| 2 | Playwright | admin | B **비활성화(DELETE)** 성공 | `/dashboard/logs` | 행: **DELETE** · **`user.deactivate`** · Target B · Status **2xx green** |
| 3 | Playwright | admin | inactive B **활성화(PATCH reactivate)** | `/dashboard/logs` | 행: **PATCH** · **`user.reactivate`** · Status **2xx green** |
| 4 | Playwright | admin | active B **조직 정보 수정(PUT)** | `/dashboard/logs` | 행: **PUT** · **`user.update`** · Status **2xx green** |
| 5 | Playwright | `system_role=user` 로그인 | 본인 `/dashboard/profile` PATCH 저장 | `/dashboard/logs` | **`profile.update`** · Actor·Target **본인** · 타 user/admin 전용 행 **없음** |
| 6a | Playwright | admin, user A active | admin이 A **비활성화** 성공 후 A 로그인 | `/dashboard/logs` | **`user.deactivate`** · Target **본인(A)** · `target_user_id=A` 행 **표시** |
| 6b | Playwright | user A 로그인 | `/dashboard/logs` | admin이 **B**에 수행한 invite/deactivate/update 행 | A 목록에 **표시되지 않음** (A≠actor, A≠target) |
| 7 | Playwright | user A | `/dashboard/logs` URL 직접 입력 | 페이지 **200** · 사이드바 **「활동 로그」** 항목 표시 · **셸 정상** |
| 8 | Playwright | admin | 중복 이메일 **초대 실패(400)** 후 `/dashboard/logs` | 최신 행 | Status **400 amber Badge** · Action **`user.invite`** · 행 **확장 가능** · 확장 시 `error_code`·`message`·`request_id` 표시 |
| 9 | Playwright | admin 또는 user | 로그 테이블 행 | metadata `{}`인 2xx 성공 행 | **flat** (확장 UI 없음 또는 비활성) |
| 10 | Playwright | admin 또는 user | metadata `changed_fields` 있는 2xx 행 | 행 확장 | `changed_fields` 등 metadata **표시** |
| 11 | Playwright | admin | `actor_search`에 admin 이메일 일부 입력 | 테이블 갱신 | 해당 admin **actor** 행만(또는 매칭 subset) 표시 |
| 12 | API | user A | `GET /api/activity-logs` | 응답 rows **전부** `actor_user_id === A` **OR** `target_user_id === A` |
| 13 | API | admin | `GET /api/activity-logs` | user A·B 행 **모두** 포함 가능 |
| 14 | API | admin | `GET /api/activity-logs?actor_search={admin_email_fragment}` | 반환 rows의 actor가 검색어와 **일치** |
| 15 | API | service_role 외 | `activity_logs` UPDATE/DELETE 시도 | **실패** (trigger 또는 권한) |
| 16 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 통과 |

**회귀:** plan 02~06 Users·profile mutation 동작 · plan 07 인증 가드 **유지**.

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE → FE**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **SQL `10`** | `activity_logs` · append-only trigger · RLS SELECT(actor∨target∨admin) · `target_user_id` 인덱스 · authenticated INSERT/UPDATE/DELETE **거부** |
| B | **BE — logging helper** | `src/features/activity-logs/api/log.server.ts` — `recordActivityLog({...})` service_role insert · `request_id` · metadata allowlist |
| C | **BE — 기록 연동** | 확정 6 Route **모든 `return` 분기** 직전 `recordActivityLog` (401/403/400/404/2xx/500) |
| D | **BE — 조회 API** | `GET /api/activity-logs` — pagination·sort(created_at desc) · non-admin OR필터 · admin `actor_search`·`action`·`search` |
| E | **FE — feature** | `src/features/activity-logs/` — types · service · queries · `ActivityLogsTable` (조건부 expand) |
| F | **FE — 페이지** | `/dashboard/logs` · `PageContainer` · Users DataTable + nuqs · admin **actor_search** Input |
| G | **FE — nav** | `nav-config.ts` Account **「활동 로그」** — **전 role** (`access` 없음) |
| H | **검증** | Playwright MCP AC #1~#11 · API #12~#15 · tsc · lint · build |

#### C) 기록 연동 — 확정 Route Handler

| 파일 | mutation | action | 기록 분기 |
|------|----------|--------|----------|
| `src/app/api/users/route.ts` | POST invite | `user.invite` | 401 · 403 · 400 validation · 201 · 400 duplicate · 500 |
| `src/app/api/users/[id]/route.ts` | PUT | `user.update` | 401 · 403 · 400* · 404 · 200 · 500 |
| `src/app/api/users/[id]/route.ts` | PATCH reactivate | `user.reactivate` | 동일 패턴 |
| `src/app/api/users/[id]/route.ts` | DELETE deactivate | `user.deactivate` | 동일 패턴 |
| `src/app/api/profile/route.ts` | PATCH | `profile.update` | 401 · 400 · 403 field · 200 · 500 |
| `src/app/api/profile/password/route.ts` | PATCH | `profile.password_change` | 401 · 400* · 500 · 200 |

**구현 패턴:** Handler 진입 시 `requestId = crypto.randomUUID()` 1회 생성 → 각 return 직전 `recordActivityLog` → `NextResponse`에 `x-request-id` 헤더 **[INFERRED]**

### Out of Scope

| 항목 | 비고 |
|------|------|
| READ 로깅 | GET·RSC·prefetch **전부 Out** |
| 로그 수정·삭제 UI/API | 모든 role **금지** |
| CSV/JSON **export** | 후속 plan |
| `/api/products` mock CUD | 데모 Out |
| **actor Combobox** picker | **Out** — `actor_search` Input만 |
| retention purge·아카이브·파티션 | **무기한** · 운영 **후속** |
| Playwright **CI** 스위트 | verifier **MCP만** (plan 01~07 동일) |
| Realtime 로그 스트림 | Out |
| 타 서비스 webhook ingest | Out |

---

## DB 스키마 (`supabase/sql/10_activity_logs.sql`)

```sql
-- Plan: 08_activity-audit-log-plan.md
-- Status: Approved (구현 시 In Progress → Completed)

create table public.activity_logs (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null,
  actor_display_name text,
  action text not null,
  target_type text not null,          -- 'user' | 'profile'
  target_user_id uuid references auth.users(id) on delete set null,
  target_label text not null,         -- email 또는 "이름 (email)" 또는 id fallback
  http_method text not null,
  http_path text not null,
  http_status smallint not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at
  on public.activity_logs (created_at desc);

create index if not exists idx_activity_logs_actor_created
  on public.activity_logs (actor_user_id, created_at desc);

create index if not exists idx_activity_logs_target_created
  on public.activity_logs (target_user_id, created_at desc);

-- append-only
create or replace function public.prevent_activity_log_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'activity_logs is append-only';
end;
$$;

create trigger trg_activity_logs_no_update
before update or delete on public.activity_logs
for each row execute function public.prevent_activity_log_mutation();

alter table public.activity_logs enable row level security;

-- SELECT: 본인 actor OR target OR admin
create policy activity_logs_select_self_or_admin
on public.activity_logs for select to authenticated
using (
  actor_user_id = auth.uid()
  or target_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.system_role = 'admin'
  )
);

-- INSERT/UPDATE/DELETE: authenticated에 정책 없음 + REVOKE
revoke insert, update, delete on public.activity_logs from authenticated;
revoke insert, update, delete on public.activity_logs from anon;
-- service_role은 bypass RLS로 Route Handler에서만 insert
```

**`metadata` 예시:**

- 2xx: `{ "changed_fields": ["affiliation", "department"] }`
- 4xx: `{ "error_code": "duplicate_email", "message": "이미 등록된 이메일입니다." }`
- password 관련 필드 **절대 저장 금지**

---

## API / Service Layer

### `GET /api/activity-logs`

| Query | 설명 | role |
|-------|------|------|
| `page`, `limit` | Users API와 동일 (page=1, limit=10) | all |
| `action` | action 코드 filter | admin |
| `actor_search` | `actor_email` · `actor_display_name` ilike | **admin only** |
| `search` | `target_label` ilike | admin |

- **인증:** `requireSession`
- **필터 (non-admin):** `.or(\`actor_user_id.eq.${uid},target_user_id.eq.${uid}\`)` — API·RLS **이중**
- **필터 (admin):** 위 query param 적용 · `actor_search` non-admin 요청 시 **무시**
- **응답:** `{ success, data: { logs, total, page, limit } }`

### Feature 구조 (core-conventions)

```
src/features/activity-logs/api/
  types.ts
  service.ts          — fetchActivityLogs (client → GET API)
  log.server.ts       — recordActivityLog (server-only)
  service.server.ts   — listActivityLogs
  queries.ts          — activityLogKeys + activityLogsQueryOptions
```

**CUD UI 없음** → `mutations.ts` **불필요**.

---

## UI 요구사항 (designer / FE)

**참고:** [shadcn tables-api-logs](https://www.shadcn.io/blocks/tables-api-logs) · Users `DataTableToolbar`

### 테이블 컬럼

| 컬럼 | 내용 |
|------|------|
| **Method** | Badge — POST/PUT/PATCH/DELETE 색 구분 |
| **Endpoint** | `http_path` monospace truncate + Tooltip |
| **Status** | `http_status` — 2xx **green** · 4xx **amber** · 5xx **red** (**전 status 실사용**) |
| **Time** | `created_at` — locale `ko-KR` 상대/절대 |
| **Request ID** | `request_id` 앞 8자 + copy Tooltip |
| **Actor** | `actor_display_name` 또는 email |
| **Action** | `action` Badge |
| **Target** | `target_label` |

### 조건부 행 확장 (designer 권고 **B** — 확정)

| 조건 | UI |
|------|-----|
| 2xx · `metadata` **비어 있음** (`{}`) | **flat** — 확장 토글 없음 |
| 2xx · `metadata` **있음** (예: `changed_fields`) | 행 **expand** — metadata 키·값 표시 |
| **4xx / 5xx** | 행 **expand 강조** (amber/red row hint **[INFERRED]**) — `error_code` · `message` · `validation_errors` · `request_id` 전체 |

**구현:** DataTable sub-row 또는 Collapsible row — Users 테이블 패턴 확장.

### Toolbar · 레이아웃

- `PageContainer` — `pageTitle="활동 로그"` · admin만 부제 **「전체 사용자 활동」** muted **[INFERRED]**
- `DataTable` + `DataTableToolbar` — 정렬 기본 `created_at desc`
- **admin only:** **「행위자」`actor_search` Input** — nuqs `actor_search` → API 동기화 · debounce 500ms (Users `name` 패턴) · **Combobox Out**
- **user:** toolbar에 actor_search **미표시**

**Nav:** Account 그룹 Profile 아래 `url: '/dashboard/logs'`, `icon: 'list'` 또는 `'activity'` (Icons에 있으면)

**admin-routes.ts:** `/dashboard/logs` **추가하지 않음** (전 user 접근)

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `supabase/sql/10_activity_logs.sql` | **신규** |
| `src/features/activity-logs/**` | **신규** feature |
| `src/app/api/activity-logs/route.ts` | **신규** GET |
| `src/app/api/users/route.ts` | POST **전 return** log |
| `src/app/api/users/[id]/route.ts` | PUT/PATCH/DELETE **전 return** log |
| `src/app/api/profile/route.ts` | PATCH **전 return** log |
| `src/app/api/profile/password/route.ts` | PATCH **전 return** log |
| `src/app/dashboard/logs/page.tsx` | **신규** |
| `src/config/nav-config.ts` | nav 항목 |
| `src/lib/searchparams.ts` | `actor_search` · `action` (logs RSC prefetch) |

**패턴:** Users `users-table` · `queries.ts` key factory · plan 07 `requireSession` · logging **`getServiceRoleClient()`** · log insert 실패 시 **mutation 응답 변경 없음**

---

## 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | Route return 분기 누락 → 감사 공백 | Route별 return 매트릭스 · AC #8(400 초대) 검증 |
| 2 | log insert 실패가 mutation 응답 변경 | `recordActivityLog` catch + server log · 응답 **독립** |
| 3 | service_role 남용 | `log.server.ts` **server-only** · 클라이언트 import 금지 |
| 4 | RLS 우회로 타인 로그 조회 | GET API **OR필터** + RLS 이중 · AC #6b |
| 5 | metadata에 PII·비밀번호 | `error_code` enum · message allowlist · password strip |
| 6 | early 400에서 target 미확정 | `attempted_target` · `target_label` fallback |
| 7 | 로그 테이블 무한 증가 | **무기한** · `created_at`·`target_user_id` 인덱스 |

---

## 추정

| 항목 | 값 |
|------|-----|
| 복잡도 | **Complex** (전 분기 로깅 + 조건부 expand) |
| SQL | 1 파일 |
| BE | 4 Route 전 return 매트릭스 + GET API + helper |
| FE | 1 page + table + expand + actor_search |
| verifier | Playwright MCP ~11 AC + API 4건 |
| 예상 시간 | **~3.5–4.5시간** |

---

## 확정 결정 (구 열린 질문 해소)

| # | 항목 | 확정값 |
|---|------|--------|
| 1 | user 조회 범위 | **actor + target** (RLS·API OR) |
| 2 | 보관 기간 | **무기한** |
| 3 | admin actor 필터 | **`actor_search` Input In** · Combobox **Out** |
| 4 | expandable / metadata | **조건부 행 확장 B** (§UI) |
| 5 | 실패 mutation 기록 | **전 HTTP(2xx/4xx/5xx) In** — 6 Route 모든 return |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-05 | 최초 작성 · `/root` 범위 확정 · Status Approved | planner |
| 2026-06-04 | 재기획: actor+target 조회 · 전 HTTP 기록 · actor_search · 조건부 expand B · AC 개정 | planner |
