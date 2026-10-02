# Google 가입 승인 admin 인앱 알림 · 활동 로그 302 결과 라벨 기획서

> Date: 2026-10-02
> Status: Completed
> Author: planner
> **SQL:** `57` · `supabase/sql/57_notifications_user_approval_request_admin_type.sql` (구현 시)
> **선행:** [08](./08_activity-audit-log-plan.md), [25](./25_activity-logs-ui-improvement-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [45](./45_auth-session-audit-log-plan.md), [47](./47_contract-import-notifications-plan.md), [57](./57_google-auth-approval-migration-plan.md), [58](./58_approval-birthday-optional-user-add-removal-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **08** | `activity_logs` append-only · `recordActivityLog` · `/dashboard/logs` — 본 plan은 **표시 라벨만** 확장 (302/303) |
| **25** | `getResultLabel` · `getResultBadgeClass` · 5컬럼 결과 Badge — **직접 확장** |
| **27** | `notifications` · Realtime · `fan-out.server.ts` · 알림 INSERT activity log **Out** |
| **45** | `auth.sign_in` — Google callback active login 시 `httpStatus: 302` 기록 (plan 57 확장) |
| **47** | admin bulk fan-out · `listActiveAdminUserIds()` · try/catch · HTTP 불변 — **동일 패턴 재사용** |
| **57** | Google OAuth · `pending_approval` · `approval_request_log_needed` · **이메일 승인/거절 알림 Out** — **인앱 admin 알림 In** |
| **58** | 사용자 추가 제거 · 승인 Sheet — CTA는 Users pending 필터로 연결 |

**중복 금지:** 승인/거절 **결과** admin 알림 Out (plan 57 유지 — UI·toast·activity log). 이메일 발송 Out. 신규 dashboard 페이지 Out. notification INSERT activity log Out.

**Dashboard Presence:** 신규 `/dashboard/*` 페이지 **없음** — `dashboard/layout` `DashboardPresenceTrack` 상속 **N/A**.

---

## 한 줄 요약

활동 로그 결과 열에서 OAuth redirect(302/303)를 **「리다이렉트」**로 표시하고 green Badge를 적용한다. Google OAuth **최초** `pending_approval` 생성 시(`approval_request_log_needed`) **active admin 전원**에게 `user.approval_request_admin` 인앱 알림을 fan-out한다.

---

## deep-interview 확정 (2026-10-02)

| # | 질문 | 답 |
|---|------|-----|
| Q1 | activity log 302/303 결과 라벨 | **전역** — 302/303 → **「리다이렉트」** (성공과 동일 green Badge) |
| Q2 | admin 알림 수신자 | `system_role=admin` + `status=active` **전원** — `listActiveAdminUserIds()` 재사용 |
| Q3 | 알림 타이밍·CTA·본문 | **최초 pending 1회만** (`approval_request_log_needed`와 동일) · CTA → `/dashboard/users?status=pending_approval` · 본문 Google email + display name(있으면) |

---

## 정책 확정안

### A. 활동 로그 결과 라벨 (FE 전역)

| `http_status` | 결과 Badge 문구 | Badge 스타일 |
|---------------|-----------------|--------------|
| 200–299 | 성공 | green (기존) |
| **302, 303** | **리다이렉트** | **green (성공과 동일)** |
| 401 | 로그인 필요 | amber |
| 403 | 권한 없음 | amber |
| 400 | 입력 오류 | amber |
| 404 | 대상 없음 | amber |
| 기타 4xx | 실패 | amber |
| 5xx | 서버 오류 | red |

**구현 위치:** `src/features/activity-logs/labels.ts` — `getResultLabel()` · `getResultBadgeClass()` **만** 수정. 테이블·expand는 기존 plan 25 구조 유지.

**영향 행:** `auth.sign_in` (active Google login, 302) · `user.approval_request` (최초 pending, 302) — **DB/http_status 변경 Out**.

### B. Google pending admin 인앱 알림

| 항목 | 확정 |
|------|------|
| **트리거** | `GET /api/auth/google/callback` · `profileResult.status === 'pending_approval'` **AND** `approval_request_log_needed === true` |
| **Fan-out 시점** | `user.approval_request` activity log 기록 **직후** (동일 requestId 컨텍스트) |
| **재로그인** | `approval_request_log_needed === false` → activity log **스킵** · admin 알림 **스킵** |
| **수신자** | `listActiveAdminUserIds()` — active admin **전원** (0명이면 no-op) |
| **type** | `user.approval_request_admin` |
| **title** | `Google 가입 승인 요청` |
| **body** | `{google_email}` · `{google_display_name}` (display name 있을 때만 「 · {name}」 접미) |
| **body 예** | `user@example.com · 홍길동` / display name 없으면 `user@example.com` |
| **CTA label** | `승인 대기 목록` |
| **CTA route** | `/dashboard/users?status=pending_approval` |
| **metadata allowlist** | `kind`, `target_user_id`, `google_email`, `google_display_name` (nullable) |
| **민감 데이터 금지** | OAuth token · refresh token · password metadata **저장 금지** |
| **Fan-out 실패** | try/catch · **callback HTTP redirect 불변** (302 sign-in redirect 유지) |
| **알림 INSERT log** | **Out** — plan 27/47 원칙 |
| **이메일** | **Out** — plan 57 |

### C. 승인/거절 결과 알림

| 항목 | 정책 |
|------|------|
| admin에게 approve/reject **결과** in-app | **Out** (plan 57 — UI·toast·`user.approve`/`user.reject` log) |
| pending 사용자에게 approve/reject in-app | **Out** |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Unit/FE | — | `getResultLabel(302)` · `getResultLabel(303)` 호출 | **「리다이렉트」** 반환 |
| 2 | Unit/FE | — | `getResultBadgeClass(302)` 호출 | green success 클래스 (200–299와 동일) |
| 3 | Playwright | admin, activity log에 `auth.sign_in` **302** 행 존재 | `/dashboard/logs` 진입 · 해당 행 확인 | 결과 열 **「리다이렉트」** · **「알 수 없음」** 아님 · green Badge |
| 4 | Playwright | admin, `user.approval_request` **302** 행 존재 | `/dashboard/logs` 진입 · 해당 행 확인 | 결과 열 **「리다이렉트」** · green Badge |
| 5 | Playwright | active admin A · Google 계정 B(미등록) | B로 Google OAuth **최초** 가입 시도 → pending redirect | admin A 벨 unread **+1** · Popover 제목 **「Google 가입 승인 요청」** · body에 B **Google email** 포함 |
| 6 | Playwright | AC #5 직후 | admin A Popover 알림 CTA **「승인 대기 목록」** 클릭 | `/dashboard/users?status=pending_approval` 이동 · 목록에 B(pending) **표시** |
| 7 | Playwright | AC #5와 동일 pending user B | B가 Google OAuth **재로그인** (pending toast) | admin A 벨 unread count **변화 없음** (중복 알림 없음) |
| 8 | Playwright | active admin 2명(A,C) · 신규 Google user D | D **최초** pending 가입 | A·C **각각** unread +1 (fan-out 2건) |
| 9 | API/DB | AC #5 직후 | `notifications` where `type=user.approval_request_admin` · `metadata.target_user_id=B` | admin recipient **각 1건** · `title`/`body` 정책 일치 · token 필드 **없음** |
| 10 | API | admin A | `GET /api/notifications` | AC #5 알림 1건+ · `metadata.google_email` = B email |
| 11 | API/로그 | AC #5 | Google callback 처리 | `activity_logs` **`user.approval_request`** 1건 · `http_status=302` · **알림 INSERT 별도 log 행 없음** |
| 12 | API/로그 | active user Google login 성공 | callback | `auth.sign_in` · `http_status=302` · fan-out **없음** |
| 13 | Playwright | admin | `/dashboard/notifications`에서 AC #5 알림 카드 | CTA **「승인 대기 목록」** · 클릭 시 Users pending 필터 |
| 14 | CLI | 구현 완료 | `bunx playwright test e2e/activity-logs/` · `e2e/google-auth/` · `e2e/notifications/` (관련 spec) · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 57 pending/rejected redirect · plan 25 5컬럼 · plan 27 read mutation · plan 47 contract import fan-out · active admin 0명 시 silent no-op.

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **FE labels** | `labels.ts` — 302/303 → 「리다이렉트」+ green Badge |
| B | **SQL `57`** | `notifications.type` CHECK에 `user.approval_request_admin` 추가 |
| C | **BE types** | `NotificationType` · `NotificationMetadata` 확장 |
| D | **BE fan-out** | `insertUserApprovalRequestAdminNotifications()` in `fan-out.server.ts` |
| E | **BE callback** | `google/callback/route.ts` — `approval_request_log_needed` 분기 직후 try/catch fan-out |
| F | **FE helpers** | `notification-helpers.ts` — CTA `view-pending-users` → `/dashboard/users?status=pending_approval` |
| G | **E2E** | `e2e/activity-logs/` · `e2e/google-auth/` · `e2e/notifications/` spec 추가/확장 |
| H | **검증** | AC #1–#14 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| `http_status` DB 값 변경 (302→200 등) | Out — 표시만 수정 |
| 301/307/308 redirect 라벨 | Out — v1은 302/303만 |
| 승인/거절 **결과** admin·user 알림 | Out |
| 이메일·push·SMS | Out (plan 57) |
| 신규 dashboard 페이지 | Out — Presence N/A |
| notification INSERT activity log | Out |
| pending user 수신 알림 | Out |
| Realtime 채널 변경 | Out — 기존 postgres_changes INSERT 유지 |

---

## 활동 감사 로그

**신규 mutation Route 없음.** 기존 Google callback 분기 유지:

| Route | action | 기록 조건 | http_status |
|-------|--------|-----------|-------------|
| `GET /api/auth/google/callback` | `auth.sign_in` | active login 성공 redirect | 302 |
| `GET /api/auth/google/callback` | `user.approval_request` | `approval_request_log_needed` | 302 |
| `GET /api/auth/google/callback` | `user.approval_request` | OAuth 오류 분기 | 400/500 |

**알림 fan-out:** service_role INSERT only · **activity log Out** (plan 27/47).

**AC:** #11 — `user.approval_request` 302 행 존재 · 알림 INSERT log 행 **없음** 확인.

---

## UI 요구사항 (designer / FE)

### 활동 로그

- 변경: `labels.ts` 결과 매핑만 — **Designer gate 생략** (plan 25 preview-2 유지)
- `/dashboard/logs` 5컬럼·expand **구조 변경 없음**

### 인앱 알림

- 기존 `NotificationCenter` · `/dashboard/notifications` 카드 패턴 재사용
- `user.approval_request_admin` 타입 분기:
  - title: `Google 가입 승인 요청`
  - body: Google email + optional display name
  - CTA: **「승인 대기 목록」** → `/dashboard/users?status=pending_approval`
- admin Combobox 뷰어(plan 27)에서 동일 카드 표시

---

## API / DB 요구사항

### SQL `57_notifications_user_approval_request_admin_type.sql`

```sql
-- notifications.type CHECK 확장
-- 'user.approval_request_admin' 추가 (기존 타입 전부 유지)
```

### Fan-out 함수 (신규)

```ts
insertUserApprovalRequestAdminNotifications(input: {
  targetUserId: string;
  googleEmail: string;
  googleDisplayName: string | null;
}): Promise<void>
```

- `listActiveAdminUserIds()` → batch insert (plan 47 `FAN_OUT_BATCH_SIZE` 패턴)
- rows: `{ recipient_user_id, type: 'user.approval_request_admin', title, body, metadata }`

### Callback 연동

```
pending_approval && approval_request_log_needed:
  1. recordActivityLog(user.approval_request, 302)
  2. try { insertUserApprovalRequestAdminNotifications(...) } catch { console.error; /* HTTP 불변 */ }
  3. signOut + redirect sign-in pending toast
```

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/features/activity-logs/labels.ts` | 302/303 result label + badge |
| `src/features/notifications/api/types.ts` | `user.approval_request_admin` |
| `src/features/notifications/api/fan-out.server.ts` | fan-out helper |
| `src/features/notifications/components/notification-helpers.ts` | CTA route |
| `src/app/api/auth/google/callback/route.ts` | fan-out 호출 |
| `supabase/sql/57_*.sql` | type CHECK |
| `e2e/activity-logs/*.spec.ts` | 302 label AC |
| `e2e/google-auth/*.spec.ts` | pending admin notif AC |
| `e2e/notifications/*.spec.ts` | CTA AC |

**패턴:** plan 47 `insertContractImportAdminNotifications` · plan 55 wallet admin fan-out.

---

## 리스크 & 완화책

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | fan-out 실패가 OAuth redirect 깨짐 | try/catch · HTTP 응답 불변 (plan 47) |
| 2 | MED | active admin 0명 — 알림 유실 | silent no-op · pending user·activity log로 추적 가능 |
| 3 | MED | 302를 green 처리해 실패 오인 | v1 OAuth 성공 redirect만 302 사용 · expand에 http_status 숫자 유지 |
| 4 | LOW | display name 특수문자 body | trim · metadata allowlist · XSS는 React text node |

---

## 추정

| 항목 | 값 |
|------|-----|
| 범위 | ~8 파일 · SQL 1 · ~150 LOC |
| 복잡도 | **Medium** |
| 예상 | ~45–60분 |
| 체크포인트 | labels + SQL 적용 후 E2E 1차 |

---

## 열린 질문

없음 (deep-interview 확정).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-02 | 최초 작성 (Approved) | planner |
