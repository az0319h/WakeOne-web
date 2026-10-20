> Date: 2026-10-18
> Status: Approved
> Author: planner (/root · deep-interview → battle-plan → `go`)
> **SQL:** `supabase/sql/83_google_tasks_connections.sql` (구현 시 최대 번호 재확인)
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [14](./14_delete-confirm-dialog-plan.md), [26](./26_loading-spinner-unification-plan.md), [45](./45_auth-session-audit-log-plan.md), [49](./49_live-users-presence-plan.md), [57](./57_google-auth-approval-migration-plan.md)
> **Supersede:** [52](./52_google-tasks-plan.md) (파일 없음 · README 정책), [54](./54_google-tasks-cud-plan.md) (파일 없음 · README 정책) — Tasks OAuth·proxy·read-only 방향

# 칸반 — Google Tasks 멀티리스트 동기화

## 한 줄 요약

Active 직원이 **`/dashboard/kanban`**에서 **본인 Google Tasks**를 shadcn 칸반형 **가로 멀티열**(열 = Google **tasklist** 1개) UI로 조회·CUD·이동·재정렬·하위작업·목록 생성·목록별 **완료됨 (N개)** 섹션을 사용한다. **Google 로그인 OAuth에 Tasks scope 포함** — scope 거부 시 **WakeOne 로그인 불가**. 레거시 별도 Tasks OAuth·기존 `google_tasks_connections` 행은 **전량 제거** 후 로그인 callback에서 자동 연결한다.

---

## 선행 plan 참조 / supersede

| Plan | 관계 |
|------|------|
| **07** | dashboard/API active-only guard — 칸반·Tasks API 동일 |
| **08** | 모든 Tasks/tasklist **CUD Route** 전 HTTP 분기 `recordActivityLog` |
| **14** | tasklist 삭제·완료 항목 일괄 삭제(clear completed) → **`AlertModal`** · `window.confirm` 금지 |
| **26** | `/dashboard/kanban` Read 로딩 → `PageLoadingSpinner` (overview skeleton 재사용 Out) |
| **45** | `auth.sign_in` — Google OAuth 성공만; Tasks scope 거부는 **로그인 실패** (별도 Tasks connect log와 구분) |
| **49** | `/dashboard/kanban`은 `dashboard/layout` 하위 → **`DashboardPresenceTrack` 상속** (페이지별 track 코드 없음) |
| **57** | Google 로그인 전용 — Tasks는 **동일 OAuth·동일 Google 계정**으로 supersede (57의 「로그인 OAuth ≠ Tasks OAuth」 Out) |
| **52** (README) | Tasks 전용 OAuth · read-only · admin `tasks_user` proxy → **전부 supersede** |
| **54** (README) | 별도 write OAuth CUD → **supersede** (로그인 scope + Route CUD) |
| **60** | 약관 「선택적 Tasks 연결」 문구 — 구현 후 운영 체크리스트에서 legal follow-up |

### Supersede 매트릭스 (52 / 54 / 57)

| 항목 | plan 52/54 (README) | plan 57 | **plan 81** |
|------|---------------------|---------|-------------|
| OAuth | Tasks 전용 2차 연결 | 로그인과 Tasks 분리 유지 | **로그인 1회** + `https://www.googleapis.com/auth/tasks` |
| 연결 UI | Connect / disconnect | 별도 연결 보존 | **없음** — callback 자동 upsert |
| Admin proxy | `tasks_user` | — | **Out** — 본인 계정만 |
| Read scope | readonly | — | **full tasks** (CUD·clear·subtasks) |
| Route | `/dashboard/tasks` (57 AC) | — | **`/dashboard/kanban`** |
| Legacy data | — | 기존 connection 유지 AC | **전 행 삭제** · 재로그인 |

---

## 정책 확정 (deep-interview · battle-plan `go`)

| # | 결정 |
|---|------|
| Q1 | **A** — `signInWithOAuth`에 `https://www.googleapis.com/auth/tasks` 추가. scope **거부** → **로그인 차단** (WakeOne 사용 불가) |
| Q2 | shadcn 칸반 **카드·DnD·Add Task Dialog**만 차용. **열 = Google tasklist 1개**. **Backlog/In Progress/Done 워크플로 열 없음**. 가로 멀티리스트 보드 |
| Q3 | **3a** — Done 열 없음. 목록별 접이식 **`완료됨 (N개)`** (Google parity). 완료 시각 **`formatAbsoluteDateTimeKo`** |
| Q4 | 카드 **title + due만** (due는 **`formatAbsoluteDateKo`** date-only). **priority·assignee UI·WakeOne meta v1 없음** |
| Q5 | Route **`/dashboard/kanban`**. tasklist 0개 → 빈 UI. **+ 새 목록** 필수. 레거시 connection **전량 삭제** · 별도 Tasks OAuth 제거 |
| Clear | **완료됨** 헤더 메뉴 → **`AlertModal`** 확인 → `tasks.clear` API |

---

## 목표 & 완료 기준

- **목표:** Google Tasks를 WakeOne 칸반 UX로 full sync (API 허용 범위).
- **완료 기준:** 아래 AC 전부 green · `bunx playwright test` (kanban/google-tasks + mock) · Tasks CUD API activity log 테스트 · tsc · lint · build · `npm run e2e:cleanup` exit 0 · dev SQL `83` 적용.

## 범위

### In

| # | 영역 |
|---|------|
| 1 | SQL `83_google_tasks_connections` — 암호화 refresh token · RLS · 배포 시 **기존 행 DELETE** |
| 2 | Auth: `google/start` scopes · callback connection upsert · scope deny → sign-in 실패 UX |
| 3 | Server Google Tasks client + `E2E_GOOGLE_TASKS_MOCK=1` in-memory/mock |
| 4 | `/api/google-tasks/**` Route Handlers (CUD만 activity log) |
| 5 | `src/features/google-tasks/` (types · service · queries · mutations) + kanban UI 교체 |
| 6 | `nav-config` 칸반 항목 · `disabled-routes`에서 `/dashboard/kanban` 제거 |
| 7 | `ActivityAction` / labels 확장 · API log tests |
| 8 | E2E `e2e/kanban/` 또는 `e2e/google-tasks/` |

### Out

| 항목 | 비고 |
|------|------|
| Backlog / In Progress / Done **상태 열** | 워크플로 메타 DB 없음 |
| priority · assignee UI·meta | v1 Out (Q4) |
| admin `tasks_user` proxy | plan 52 Out |
| 별도 `/api/google-tasks/oauth/*` · `GOOGLE_TASKS_CLIENT_*` 2차 OAuth | 제거 |
| READ activity log | GET tasklists/tasks Out |
| `window.confirm` / `alert` 삭제 확인 | plan 14 |

---

## UI 모델 (열 = tasklist)

```
[ Page: 칸반 — header: + 새 목록 ]
┌─────────────┬─────────────┬─────────────┐  ← horizontal scroll
│ List A      │ List B      │ List C      │
│ [+ 할 일]   │ [+ 할 일]   │ [+ 할 일]   │
│ card…       │ card…       │ (empty)     │
│ ▼ 완료됨(2) │ ▼ 완료됨(0) │             │
└─────────────┴─────────────┴─────────────┘
```

- **미완료** task만 열 본문 카드 스택. **DnD:** 같은 열 reorder · 다른 열로 move (`tasks.move`).
- **Add Task:** demo 유사 Dialog — **title** (+ description → Google `notes` 또는 notes 필드 정책은 BE가 title/notes 분리).
- **카드 표시:** title · due 있으면 `formatAbsoluteDateKo` (date-only). priority/assignee **미표시**.
- **완료됨:** 접이 펼침 시 completed tasks · 체크·취소선 · 완료 시각 `formatAbsoluteDateTimeKo` · notes/하위작업 API 데이터 표시.
- **빈 계정:** tasklist 0개 → 빈 보드 + **「+ 새 목록」** CTA.
- **로딩:** `loading.tsx` 또는 Suspense `PageLoadingSpinner` (`variant="default"` / body `fill`).

---

## Auth & 연결

### Google Cloud / Supabase

- Supabase Auth Google Provider **Additional Scopes:** `https://www.googleapis.com/auth/tasks`
- `GET /api/auth/google/start`: `signInWithOAuth` `options.scopes`에 위 scope 포함 · `access_type: offline` · 필요 시 `prompt: 'consent'` (refresh token 확보 — 구현 시 스파이크로 확정)

### Callback (`/api/auth/google/callback`)

- Active user · session 성공 후: `provider_refresh_token` (또는 Supabase가 제공하는 provider token) → **암호화** → `google_tasks_connections` **upsert**
- `google_email` = 로그인 Google email · **불일치 시** connection 실패 처리 → **로그인 완료 불가** (Q1)
- OAuth `error=access_denied` (Tasks scope 거부): session 정리 · `/auth/sign-in` redirect · 한국어 안내 (**WakeOne 이용 불가**)

### 레거시 정리

- 배포 migration: `DELETE FROM google_tasks_connections;` (또는 truncate)
- 제거: `/api/google-tasks/oauth/**` Route · env `GOOGLE_TASKS_CLIENT_ID/SECRET` · sign-in/kanban의 「Tasks 연결」 CTA
- `google_tasks.connect` / `disconnect` action: callback upsert 성공·실패·(optional) 관리 migration 시 disconnect 로그 — **민감 토큰 metadata 금지**

---

## DB — `supabase/sql/83_google_tasks_connections.sql`

| 컬럼 | 타입 | 규칙 |
|------|------|------|
| `user_id` | uuid PK | FK `profiles.user_id` ON DELETE CASCADE |
| `google_email` | text NOT NULL | 로그인 Google email |
| `encrypted_refresh_token` | text NOT NULL | 서버만 복호화 · 클라이언트/RLS 노출 금지 |
| `token_updated_at` | timestamptz NOT NULL | |
| `created_at` | timestamptz | default now() |

- **RLS:** authenticated **SELECT own row only** (`user_id = auth.uid()`). INSERT/UPDATE/DELETE — **service role Route만**
- 파일 상단: `Plan: 81_kanban-google-tasks-plan.md` · Status · **배포 시 legacy rows wipe** 주석

---

## API surface (클라이언트는 Route만 · DB/Google 직접 금지)

| Method | Path | Google API | CUD log |
|--------|------|------------|---------|
| GET | `/api/google-tasks/tasklists` | tasklists.list | — |
| POST | `/api/google-tasks/tasklists` | tasklists.insert | `google_tasks.tasklist.create` |
| PATCH | `/api/google-tasks/tasklists/[tasklistId]` | tasklists.patch | `google_tasks.tasklist.update` |
| DELETE | `/api/google-tasks/tasklists/[tasklistId]` | tasklists.delete | `google_tasks.tasklist.delete` |
| GET | `/api/google-tasks/tasklists/[tasklistId]/tasks` | tasks.list | — |
| POST | `/api/google-tasks/tasklists/[tasklistId]/tasks` | tasks.insert (+ parent=subtask) | `google_tasks.task.create` |
| PATCH | `/api/google-tasks/tasks/[taskId]` | tasks.patch | `google_tasks.task.update` |
| DELETE | `/api/google-tasks/tasks/[taskId]` | tasks.delete | `google_tasks.task.delete` |
| POST | `/api/google-tasks/tasks/[taskId]/complete` | status completed | `google_tasks.task.complete` |
| POST | `/api/google-tasks/tasks/[taskId]/uncomplete` | status needsAction | `google_tasks.task.uncomplete` |
| POST | `/api/google-tasks/tasks/move` | tasks.move | `google_tasks.task.move` |
| POST | `/api/google-tasks/tasklists/[tasklistId]/clear-completed` | tasks.clear | `google_tasks.tasklist.clear_completed` |

공통: `requireDashboardSession` · `profiles.status = active` · connection 없으면 403 + log. Handler 진입 `requestId` → 각 return `recordActivityLog` → `x-request-id`.

### E2E mock

- `E2E_GOOGLE_TASKS_MOCK=1`: Route layer가 Google HTTP 대신 fixture store (`e2e-mock@gmail.com` connection seed).
- `playwright.config.ts` 기존 google-tasks 프로젝트 훅 유지·경로 `e2e/kanban/` 연동.

---

## 활동 감사 로그 — 기록 연동

> [plan 08](./08_activity-audit-log-plan.md) · `core-conventions.mdc`

### 신규 `ActivityAction` (types.ts · labels.ts)

| action | 대상 Route (요약) |
|--------|-------------------|
| `google_tasks.connect` | callback connection upsert **성공** (기존 타입 재사용) |
| `google_tasks.connect_failed` | callback token/scope/email 실패 **[INFERRED]** |
| `google_tasks.disconnect` | (optional) 연결 row 삭제 migration only |
| `google_tasks.tasklist.create` | POST tasklists |
| `google_tasks.tasklist.update` | PATCH tasklists/[id] |
| `google_tasks.tasklist.delete` | DELETE tasklists/[id] |
| `google_tasks.tasklist.clear_completed` | POST clear-completed |
| `google_tasks.task.create` | POST tasks |
| `google_tasks.task.update` | PATCH tasks/[id] |
| `google_tasks.task.delete` | DELETE tasks/[id] |
| `google_tasks.task.complete` | POST complete |
| `google_tasks.task.uncomplete` | POST uncomplete |
| `google_tasks.task.move` | POST move |

각 Route: **401 · 403 · 400 validation · 404 · 2xx · 502/500 Google 오류** 분기마다 1건 append.

### metadata allowlist (비민감)

`tasklist_id`, `task_id`, `parent_task_id`, `previous_tasklist_id`, `error_code`, `message` (한국어 Route message) — **token·refresh·notes 전문** 금지.

### AC (로그)

- 최소 1건 UI: admin/user가 task 생성 후 `/dashboard/logs`에서 `google_tasks.task.create` 2xx 행 확인 (별도 API AC 병행).

---

## 영향 파일 (요약)

| 팀 | 경로 |
|----|------|
| BE | `supabase/sql/83_*.sql` |
| BE | `src/app/api/auth/google/start/route.ts`, `callback/route.ts` |
| BE | `src/app/api/google-tasks/**` |
| BE | `src/features/google-tasks/api/*`, `src/lib/google-tasks/*` (encrypt, client, mock) |
| BE | `src/features/activity-logs/api/types.ts`, `labels.ts`, `log.server.ts` allowlist |
| FE | `src/features/kanban/**` (Google 연동) 또는 `google-tasks/components/kanban-*` |
| FE | `src/config/nav-config.ts`, `src/config/disabled-routes.ts` |
| FE | `src/app/dashboard/kanban/page.tsx`, `loading.tsx` |
| FE | `env.example.txt` (2차 OAuth 제거·scope 문서화) |
| verifier | `e2e/kanban/*.spec.ts`, `e2e/api/google-tasks-activity-log.spec.ts` (신규) |

패턴: Read `useSuspenseQuery` + CUD `mutations.ts` `onSettled` → `googleTasksKeys.all` invalidate.

---

## AC (Given-When-Then)

공통: dev DB SQL 83 적용 · E2E는 `E2E_GOOGLE_TASKS_MOCK=1` · active `system_role=user` 세션 (`storageState`) · `/dashboard/kanban`은 `dashboard/layout` 하위 (presence track 별도 코드 없음).

### 라우트 · nav · guard · presence

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-01 | Playwright | active user 로그인 | 사이드바에서 **「칸반」**(또는 기획 확정 한국어 제목) 클릭 | URL **`/dashboard/kanban`** · 페이지 제목 영역에 칸반 관련 헤더 표시 |
| AC-02 | Playwright | active user | `/dashboard/kanban` 직접 이동 | `disabled-routes` 리다이렉트 **없음** · overview로 튕기지 **않음** |
| AC-03 | Playwright | 미로그인 | `/dashboard/kanban` 이동 | sign-in 페이지만 표시 · dashboard 셸 **미노출** (plan 07) |
| AC-04 | Playwright | inactive 또는 pending user | `/dashboard/kanban` 이동 | dashboard 접근 차단 · sign-in 또는 거부 UX (plan 07·57) |
| AC-05 | grep/구현 | 구현 완료 | `src/app/dashboard/kanban` 트리 | `dashboard/layout.tsx` **상속** · kanban 전용 `DashboardPresenceTrack` **0건** (plan 49) |

### Auth · scope

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-06 | 수동/스테이징 | GCP+Supabase에 Tasks scope 설정 | Google 로그인 consent | Tasks 권한 요청 포함 |
| AC-07 | Playwright/API mock | OAuth callback이 `access_denied` 시뮬레이션 | sign-in 완료 시도 | `/auth/sign-in` · 한국어 메시지에 Tasks 권한 **필수**·이용 불가 의미 · **dashboard 접근 불가** |
| AC-08 | API/DB | active user 로그인 성공(mock) | callback 처리 후 | `google_tasks_connections`에 **본인 `user_id`** 1행 · `google_email` 일치 |
| AC-09 | 구현 | 레거시 별도 OAuth Route | grep `api/google-tasks/oauth` | **0건** (제거됨) |

### 보드 · 열 = tasklist · UI 제약

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-10 | Playwright mock | mock에 tasklist 「업무」「개인」2개 | `/dashboard/kanban` 로드 | 가로 **2열** · 헤더가 각 list **제목**과 일치 |
| AC-11 | Playwright | 칸반 로드 완료 | 열 헤더 텍스트 확인 | **「Backlog」「In Progress」「Done」** (또는 한국어 워크플로 열명) **0건** |
| AC-12 | Playwright mock | tasklist 0개 | `/dashboard/kanban` | 빈 보드 · **「+ 새 목록」**(또는 동일 의미 CTA) 표시 |
| AC-13 | Playwright mock | 목록 1개·미완료 task 1개 | 카드 확인 | **title** 표시 · priority/assignee badge·이름 **없음** |
| AC-14 | Playwright mock | due `2026-10-18` task | 카드 due 영역 | **`2026-10-18`** 형식 (`formatAbsoluteDateKo`) · 시각 없음 |

### CUD · DnD · 완료 · clear

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-15 | Playwright | mock list 선택 | **「+ 새 목록」** → 제목 입력·저장 | 새 열 추가 · mock/API에 tasklist create 반영 |
| AC-16 | Playwright | 열 A | **할 일 추가** Dialog → title·description 제출 | 열 A에 카드 추가 · 목록 refetch 후 유지 |
| AC-17 | Playwright | 미완료 task | 카드 체크(완료) | 열 본문에서 사라짐 · **`완료됨 (1개)`** (또는 N개) 섹션에 표시 · 취소선 |
| AC-18 | Playwright | 완료 task | 완료됨 섹션 펼침 | 완료 시각이 `yyyy-MM-dd (EEE) HH:mm:ss` 패턴 (`formatAbsoluteDateTimeKo`) |
| AC-19 | Playwright | 열 A·B 존재 | task를 A→B로 DnD | B에 표시 · A에서 제거 · mock move 호출 |
| AC-20 | Playwright | 열 내 2 tasks | 순서 DnD | reorder 반영 |
| AC-21 | Playwright | 완료 task ≥1 | 완료됨 헤더 메뉴 → 완료 삭제 | **`AlertModal`** 확인 문구 표시 · 확인 전 API **미호출** |
| AC-22 | Playwright | AC-21 Dialog | 확인 클릭 | 완료됨 섹션 비움 · `clear_completed` 성공 |
| AC-23 | Playwright | tasklist | 삭제 트리거 | **`AlertModal`** 후 삭제 (구현 UI 위치는 designer) |

### subtasks · notes

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-24 | Playwright/API mock | parent task | subtask 생성 | API `parent` 연결 · UI에 하위 항목 표시 (접기/펼치기 허용) |

### RBAC

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-25 | Playwright/API | admin 로그인 | 다른 user tasklist ID로 API mutate | **403** · 타인 task 데이터 UI **노출 없음** |
| AC-26 | Playwright | admin | 칸반 화면 | **타인 task proxy** UI **없음** |

### Activity log (API)

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-27 | API mock | user 세션 | `POST /api/google-tasks/tasklists/{id}/tasks` 성공 | 응답 **`x-request-id`** · DB `activity_logs` action **`google_tasks.task.create`** status 2xx |
| AC-28 | API mock | user 세션 | 필수 title 누락 POST | **400** · 동일 request id · `google_tasks.task.create` **4xx** 행 |
| AC-29 | Playwright | user | AC-27과 동일 task 생성 후 `/dashboard/logs` | 최신 관련 행 action **`google_tasks.task.create`** · Method **POST** |

### E2E · 품질

| ID | 검증 | Given | When | Then |
|----|------|-------|------|------|
| AC-30 | CLI | — | `bunx playwright test e2e/kanban` (또는 google-tasks) | **green** |
| AC-31 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 통과 |
| AC-32 | CLI | E2E 후 | `npm run e2e:cleanup` | exit **0** · `remaining.users=0` 등 기존 정책 유지 |

**AC 개수:** 32 (Given-When-Then)

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | Supabase callback에 refresh token 없음 | 스파이크 · `prompt=consent` · 실패 시 로그인 차단 (Q1) |
| HIGH | legacy token/email 불일치 | SQL wipe · 단일 OAuth |
| MED | list 많을 때 로딩 | completed lazy fetch · horizontal scroll |
| MED | plan 60 legal 문구 | 운영 체크리스트 |

롤백: kanban `disabled-routes` 복구 · scope revert · SQL drop table (사용자 Tasks 중단).

---

## 구현 후 운영자 체크리스트

1. **Google Cloud Console** — OAuth 클라이언트에 `https://www.googleapis.com/auth/tasks` scope · Supabase redirect URI 유지.
2. **Supabase Dashboard** — Authentication → Google → **Additional Scopes**에 Tasks scope 추가.
3. **환경 변수** — `GOOGLE_TASKS_TOKEN_ENCRYPTION_KEY`(또는 통합 키) 프로덕션 설정 · **레거시 `GOOGLE_TASKS_CLIENT_*` 제거**.
4. **SQL `83`** — dev → 검증 → main 적용 · migration 내 **legacy `google_tasks_connections` DELETE** 실행 확인.
5. **배포 후** — 기존 사용자 **재로그인** 안내 (Tasks 연결 갱신).
6. **수동 smoke** — active user 로그인 → `/dashboard/kanban` → 새 목록 · 할 일 · 완료 · 완료됨 섹션 · clear completed.
7. **scope 거부** — 테스트 계정으로 Tasks 거부 → sign-in 안내 · dashboard 불가 확인.
8. **활동 로그** — `/dashboard/logs`에서 `google_tasks.*` action 1건 이상 확인.
9. **Legal (plan 60)** — 이용약관·개인정보 「선택적 Tasks 연결」→ **로그인 필수 scope** 문구 개정 여부 PM 결정.
10. **모니터링** — Google API 429/5xx 시 사용자 한국어 에러 · activity log `error_code` 확인.

---

## 팀 handoff

| 순서 | 팀 | 입력 |
|------|-----|------|
| 1 | **designer** | 본 plan UI 모델 · 열=tasklist · 완료됨 섹션 · AlertModal · 모바일 가로 스크롤 |
| 2 | **backend-dev** | SQL 83 · auth scopes · API Route + activity log · mock |
| 3 | **frontend-dev** | google-tasks feature layer · kanban 교체 · nav/disabled-routes |
| 4 | **verifier** | AC-01~32 · API log tests · cleanup |

`/root` 다음 단계: 사용자 **`승인`** 후 위 순서 실행.
