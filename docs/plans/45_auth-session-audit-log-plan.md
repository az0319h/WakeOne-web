# Auth Session Audit Log (로그인 감사) 기획서

> Date: 2026-08-26  
> Status: Approved  
> Author: planner  
> **SQL:** 없음 (기존 `activity_logs` · plan 08 스키마 재사용)  
> **선행:** [01](./01_supabase-auth-login-plan.md) · [07](./07_auth-route-guard-plan.md) · [08](./08_activity-audit-log-plan.md) · [25](./25_activity-logs-ui-improvement-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **01** | `POST /api/auth/sign-in` · 클라이언트 `signOut()` — **로그인 Route만 기록 대상** |
| **07** | sign-in POST는 `isPublicAuthApiPath` **공개 API** — middleware 변경 **Out** |
| **08** | `activity_logs` · `recordActivityLog` · RLS(actor∨target∨admin) — **정책 확장**: 로그인 In · 로그아웃 Out 유지 |
| **25** | `ACTION_LABELS`에 `auth.sign_in` 한국어 라벨 추가 — UI 구조 변경 **Out** |
| **44** | 초기 PW 강제 변경 — sign-in 200 시 `must_change` metadata **In** |

**중복 금지:** sign-out Route 신설 · `auth.sign_out` · 로그아웃 FE 변경 · DB schema 변경 · READ 로깅.

---

## 한 줄 요약

`POST /api/auth/sign-in` **성공(200) 응답만** `auth.sign_in` activity log를 append하고, plan 08·`core-conventions.mdc`의 로그인 Out 정책을 **In으로 전환**한다. 로그아웃은 **계속 Out**. 실패(400/401/403/500)는 **기록하지 않음**.

---

## 정책 확정안

| 항목 | 확정 |
|------|------|
| **기록 Route** | `POST /api/auth/sign-in` **1개** — **성공(200)만** append |
| **action** | `auth.sign_in` |
| **target_type** | `auth` |
| **로그아웃** | **Out** — `signOut()` · sign-out Route · `auth.sign_out` **미기록** |
| **연쇄 signOut** | sign-in 내부 cleanup·force-password-change 세션 revoke — **별도 action 없음** (해당 Route 기존 action 유지) |
| **실패 요청** | 400/401/403/500 **Out** — plain `NextResponse.json` · activity log **없음** |
| **민감 데이터** | password·token·임시비밀번호 metadata **금지** — email은 `attempted_target`만 |
| **Request ID** | Handler 진입 `createRequestId()` → 응답 `x-request-id` |
| **DB** | schema·RLS 변경 **Out** — `target_type: 'auth'` 기존 사용 |
| **UI** | plan 25 5컬럼 테이블 · `ACTION_LABELS['auth.sign_in']` = **「로그인」** — designer **생략** |

### action 코드 (확정)

| action | HTTP | Path | actor | target |
|--------|------|------|-------|--------|
| `auth.sign_in` | POST | `/api/auth/sign-in` | **성공(200)만:** **user.id** | **성공(200)만:** **user.id** |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | API | 유효한 active user | `POST /api/auth/sign-in` 성공 | HTTP **200** · 응답 헤더 **`x-request-id`** 존재 · `activity_logs` 1건: `action=auth.sign_in`, `http_status=200`, `http_path=/api/auth/sign-in`, `actor_user_id=target_user_id=해당 user` |
| 2 | API | 존재하는 active user | **잘못된 비밀번호**로 sign-in | HTTP **401** · `activity_logs` **행 없음** · password metadata **없음** |
| 3 | API | **inactive** user | sign-in 시도 | HTTP **403** · `activity_logs` **행 없음** |
| 4 | API | — | email 형식 오류 body로 sign-in | HTTP **400** · `activity_logs` **행 없음** |
| 5 | API | admin 세션 | AC #1 직후 `GET /api/activity-logs?action=auth.sign_in` | 해당 user sign-in 성공 행 **포함** |
| 6 | API | user A 세션 | AC #1(A 로그인) 후 `GET /api/activity-logs` | 모든 row `actor_user_id=A` **OR** `target_user_id=A` · A의 `auth.sign_in` 200 행 **표시** |
| 7 | API | user B 세션 | `GET /api/activity-logs` | user A sign-in 행 **미포함** (B≠actor, B≠target) |
| 8 | Playwright | admin | `/dashboard/logs`에서 AC #1 user sign-in 행 확인 | 활동 열 **「로그인」** · `auth.sign_in` 코드 **미노출** |
| 9 | API | — | sign-in **성공(200)** 응답 | `metadata`에 password·token 필드 **없음** |
| 10 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 통과 |

**회귀:** plan 01 sign-in UX · plan 07 public sign-in · plan 08 기존 mutation 로깅 · 로그아웃(`nav-user` 등) 동작 **변경 없음**.

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE → FE → 검증**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **BE — types** | `ActivityAction`에 `'auth.sign_in'` 추가 |
| B | **BE — sign-in Route** | **성공(200)만** `finishWithActivityLog` · `x-request-id` · 실패는 plain `NextResponse.json` |
| C | **BE — conventions** | `.cursor/rules/core-conventions.mdc` 로그인 In(성공만) · 로그아웃 Out 유지 |
| D | **FE — labels** | `labels.ts` — `'auth.sign_in': '로그인'` |
| E | **E2E/API** | `e2e/auth/sign-in.api.spec.ts` — AC #1~#4, #6~#7, #9 (실패 분기는 log **없음** 검증) |
| F | **검증** | Playwright AC #8 · API · tsc · lint · build |

### Out of Scope

| 항목 | 비고 |
|------|------|
| `POST /api/auth/sign-out` 신설 | 로그아웃 API **Out** |
| `auth.sign_out` | action **Out** |
| 로그아웃 UI/FE 변경 | `service.signOut()` · `nav-user` **그대로** |
| 연쇄/내부 `signOut()` 로깅 | sign-in cleanup 등 **Out** |
| DB schema·RLS 변경 | plan 08 테이블 재사용 |
| designer UI 구조 변경 | labels 1줄만 |
| READ 로깅 | Out |
| plan 08 본문 대규모 개정 | plan 45 + README 링크로 **정책 확장** 참조 |

---

## 활동 감사 로그 (기록 연동)

> `core-conventions.mdc` §활동 감사 로그 · 참조 [plan 08](./08_activity-audit-log-plan.md)

### 기록 연동 — `POST /api/auth/sign-in`

**파일:** `src/app/api/auth/sign-in/route.ts`  
**action:** `auth.sign_in`  
**target_type:** `auth`  
**http_method:** `POST`  
**http_path:** `/api/auth/sign-in`

| # | 조건 | http_status | activity log | 비고 |
|---|------|-------------|--------------|------|
| 1 | Zod validation fail | 400 | **없음** | plain `NextResponse.json` |
| 2 | `profile_status_for_email` RPC error | 500 | **없음** | plain `NextResponse.json` |
| 3 | inactive (sign-in **전**) | 403 | **없음** | plain `NextResponse.json` |
| 4 | `signInWithPassword` error | 401 | **없음** | plain `NextResponse.json` |
| 5 | `getUser()` null | 401 | **없음** | plain `NextResponse.json` |
| 6 | profile select error (+ 내부 signOut) | 500 | **없음** | plain `NextResponse.json` |
| 7 | profile inactive/missing (+ 내부 signOut) | 403 | **없음** | plain `NextResponse.json` |
| 8 | success | 200 | **1건 append** | `finishWithActivityLog` · `x-request-id` |
| 9 | catch | 500 | **없음** | plain `NextResponse.json` |

**성공(200) 기록 필드:**

| actor_user_id | actor_email | target_user_id | target_label | metadata |
|---------------|-------------|----------------|--------------|----------|
| **user.id** | user email | **user.id** | `fetchUserTargetLabel(user.id)` | `{}` 또는 `{ must_change: true }` (초기 PW 시) |

**구현 패턴:** 성공 분기에서만 `requestId = createRequestId()` → `finishWithActivityLog` → `x-request-id` 헤더. 실패 분기는 activity log **없음**. log insert 실패 시 **sign-in 응답 변경 없음** (catch + server log).

**참조 구현:** `src/app/api/auth/forgot-password/request/route.ts`

---

## plan 08 · core-conventions 동기화

| 문서 | 구현 시 변경 |
|------|-------------|
| **`.cursor/rules/core-conventions.mdc`** | §활동 감사 로그 기록 범위 표: **로그인 → ✅ In (성공 200만)** (`POST /api/auth/sign-in`). **로그아웃 → ❌ Out 유지** |
| **plan 08** | Out 표「로그인」→ **[plan 45](./45_auth-session-audit-log-plan.md)로 정책 확장** 참조 1줄 추가 (본문 대규모 개정 불필요) |
| **plan 25** | `ACTION_LABELS` — `auth.sign_in: '로그인'` (FE labels.ts) |

---

## API / Service Layer

### 변경 파일

| 파일 | 변경 |
|------|------|
| `src/app/api/auth/sign-in/route.ts` | **성공(200)만** activity log 연동 |
| `src/features/activity-logs/api/types.ts` | `'auth.sign_in'` union 추가 |
| `src/features/activity-logs/labels.ts` | `'auth.sign_in': '로그인'` |
| `.cursor/rules/core-conventions.mdc` | 로그인 In 반영 |

**CUD UI 없음** → `mutations.ts` **불필요**.  
**조회 API 변경 없음** — 기존 `GET /api/activity-logs` · RLS 그대로.

### metadata allowlist (sign-in 추가)

| 키 | 용도 |
|----|------|
| `must_change` | 200 success · 초기 PW(`12341234a`) 로그인 시 `true` **[INFERRED]** |
| `attempted_target` | ~~pre-auth 실패 시 email~~ — **실패 분기 Out으로 미사용** |

`log.server.ts` METADATA_ALLOWLIST에 `must_change` boolean 추가 **필요 시** (backend-dev 판단).

---

## UI 요구사항

**designer 생략** — UI 구조 변경 없음.

| 항목 | 내용 |
|------|------|
| **라벨** | `ACTION_LABELS['auth.sign_in']` = **「로그인」** |
| **표시** | plan 25 5컬럼(시간·행위자·활동·대상·결과) — admin 활동 유형 필터에 자동 포함 |
| **expand** | 2xx success · metadata `{}` → flat · 4xx/5xx → expand (`error_code`, `message`, `attempted_target`) |

---

## E2E 범위

경로: `e2e/auth/sign-in.api.spec.ts` (**신규**)

| AC | 내용 |
|----|------|
| #1 | sign-in API 성공 → activity log 행 + `x-request-id` |
| #2, #3, #4 | sign-in API 실패 → `activity_logs` **행 없음** |
| #5, #6, #7 | `GET /api/activity-logs` scope |
| #9 | 성공 metadata 민감 필드 없음 |
| #8 | `e2e/activity-logs/logs-display.spec.ts` 또는 동 파일 Playwright UI 1건 |

- `storageState` 재사용 spec과 **분리** — sign-in API spec은 빈 context 또는 전용 user
- 셀렉터: `getByRole` · `getByPlaceholder` · `getByTestId` only

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/app/api/auth/sign-in/route.ts` | **핵심** |
| `src/features/activity-logs/api/types.ts` | union |
| `src/features/activity-logs/labels.ts` | 라벨 1줄 |
| `src/features/activity-logs/api/log.server.ts` | `must_change` allowlist (필요 시) |
| `.cursor/rules/core-conventions.mdc` | 정책 표 |
| `e2e/auth/sign-in.api.spec.ts` | **신규** |

**패턴:** `forgot-password/request/route.ts` · plan 08 `jsonWithActivityLog` · `ANONYMOUS_ACTOR` · `buildErrorMetadata`

---

## 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | 성공 분기 log 누락 | success return만 `finishWithActivityLog` · API spec AC #1 |
| 2 | metadata password 유출 | allowlist · `SENSITIVE_FIELD_PATTERN` · AC #9 |
| 3 | 실패 분기에 log 잔존 | plain `NextResponse.json` · AC #2~#4 **행 없음** 검증 |
| 4 | `ActivityAction` ↔ labels 불일치 | `Record<ActivityAction, string>` tsc 게이트 |

---

## 추정

| 항목 | 값 |
|------|-----|
| 복잡도 | **Low–Medium** (BE 중심 · 성공 1분기만 log) |
| BE | ~20–30분 |
| FE | ~10–15분 (labels only) |
| E2E/API | ~30–40분 |
| **합계** | **~1.5–2.5시간** |

---

## 구현 순서

1. **backend-dev** — sign-in route 성공(200)만 log · conventions
2. **frontend-dev** — `labels.ts` only
3. **verifier** — API spec · Playwright AC #8 · tsc · lint · build

**designer:** **생략**

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-26 | 최초 작성 · deep-interview·battle-plan 확정 반영 · Status Approved | planner |
| 2026-08-27 | 로그인 activity log **성공(200)만** 기록 — 실패(400/401/403/500) Out · AC·기록 연동 표·conventions 동기화 | backend-dev |
