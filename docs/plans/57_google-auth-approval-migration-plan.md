# Google 로그인 전용 승인 마이그레이션 기획서

> Date: 2026-10-02
> Status: Approved
> Author: planner
> **SQL:** 구현 단계에서 `supabase/sql/` 최대 번호 확인 후 신규 migration 작성
> **선행:** [01](./01_supabase-auth-login-plan.md), [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [11](./11_password-policy-set-password-removal-plan.md), [17](./17_user-management-add-flow-plan.md), [19](./19_user-single-name-plan.md), [20](./20_contract-reminder-email-plan.md), [32](./32_wallet-kbcard-sync-plan.md), [36](./36_password-reset-otp-plan.md), [41](./41_user-my-contracts-plan.md), [44](./44_force-initial-password-change-plan.md), [45](./45_auth-session-audit-log-plan.md), [47](./47_contract-import-notifications-plan.md), [52](./52_google-tasks-plan.md)

## 한 줄 요약

WakeOne 인증을 이메일/비밀번호에서 **Google 로그인 전용**으로 전환하고, 신규 Google 사용자는 자동 승인 없이 `pending_approval`로 생성한 뒤 관리자 `수락`/`거절`을 통해서만 active 접근을 허용한다. 기존 사용자 `user_id`와 `profiles.full_name` 기반 외부 매칭은 보존한다.

---

## 선행 plan 참조 / 충돌·보존 관계

| Plan | 관계 |
|------|------|
| **01** | 기존 Supabase 이메일/비밀번호 로그인 기반을 **대체**한다. `/auth/sign-in`은 Google 로그인 CTA 중심으로 전환하고 password sign-in route는 제거/폐기 대상이다. |
| **07** | dashboard/API guard를 확장한다. 기존 `inactive` 차단에서 **`status='active'`만 통과** 정책으로 정렬한다. |
| **08** | 관리자 승인/거절 등 CUD는 Route 전 HTTP 분기 activity log 대상이다. OAuth callback에서 profile 생성/상태 변경이 발생하는 분기도 CUD로 다룬다. |
| **11** | set-password 제거 방향은 유지하되, 이번 plan에서 **비밀번호 정책 전체가 폐기/정리 대상**이 된다. |
| **17** | 사용자 추가 흐름의 초기 비밀번호 생성 정책을 supersede한다. Google 전용 전환 후 신규 사용자는 password 없이 Google OAuth로만 유입된다. |
| **19** | `profiles.full_name`은 업무 기준 이름이므로 Google display name/email로 자동 덮어쓰지 않는다. 관리자 승인 시 확정한다. |
| **20** | 계약서 독촉 수신자 이름 매칭은 active profile만 대상으로 제한해야 한다. |
| **32** | wallet sync 이름 index는 active profile만 대상으로 제한해야 한다. pending/rejected가 같은 이름이어도 매칭 금지. |
| **36** | forgot-password OTP는 Google 로그인 전용 전환으로 제거/폐기 대상이다. |
| **41** | `/dashboard/my-contracts` 이름 매칭과 접근 판단은 active 사용자만 대상으로 유지한다. |
| **44** | force initial password change, `12341234a`, must-change 쿠키 흐름은 제거/폐기 대상이다. |
| **45** | 로그인 감사 로그는 Google OAuth 성공 기준으로 재정의한다. 로그아웃은 계속 Out. |
| **47** | contract import 작성자 알림 이름 매칭은 active user만 대상으로 제한한다. |
| **52** | Google Tasks OAuth는 **Tasks 전용 연결 OAuth**였고, 이번 plan은 **WakeOne 로그인 OAuth 전환**이다. 서로 목적이 다르며 기존 Tasks 연결은 보존·회귀 검증 대상이다. |

**중복 금지:** Google Tasks 연결 테이블을 로그인 세션의 source of truth로 사용하지 않는다. 로그인 Google 계정과 Tasks 연결 Google 계정의 동일성 강제는 1차 Out이다.

---

## 목표와 완료 기준

### 목표

- WakeOne 로그인 수단을 Google OAuth 전용으로 전환한다.
- 이메일/비밀번호 로그인, 비밀번호 찾기, 초기 비밀번호 강제 변경 등 password 기반 기능을 제거/정리한다.
- 기존 active 사용자는 기존 `auth.users.id` / `profiles.user_id` 보존을 최우선으로 dev에서 검증한다.
- 신규 Google 사용자는 자동 승인 없이 `pending_approval` 상태로 생성한다.
- pending/rejected 사용자는 OAuth callback 직후 session signOut 후 `/auth/sign-in?...`으로 redirect하고 로그인 페이지 toast로 안내한다.
- dashboard/API는 `status='active'` profile만 접근 가능하게 한다.
- admin Users에서 pending 사용자는 `수락` / `거절`만 노출한다.
- wallet, contracts, reminders, import, my-contracts, notifications 등 이름 기반 외부 매칭은 active 사용자만 대상으로 제한한다.

### 완료 기준

- 기존 active 사용자의 Google 로그인 dev 검증에서 기존 `user_id`가 보존되거나, 보존되지 않으면 구현 진행을 BLOCKER로 중단한다.
- 신규 Google 사용자가 pending으로 생성되고 dashboard/API 접근이 차단된다.
- pending/rejected는 callback 후 signOut + sign-in redirect + toast 안내로 처리된다.
- admin은 pending 사용자를 수락/거절할 수 있고, 수락 후에만 active dashboard/API 접근이 가능하다.
- password 관련 UI/API/쿠키/초기 비밀번호 정책이 제거된다.
- 외부 이름 매칭 쿼리가 active-only 조건을 가진다.
- Google Tasks 기존 연결·조회가 로그인 OAuth 전환 후에도 회귀하지 않는다.
- `bunx playwright test`, typecheck, lint, build가 통과한다.

---

## 범위 In/Out

### In Scope

| 영역 | 내용 |
|------|------|
| Auth UI | `/auth/sign-in`을 Google 로그인 전용 CTA 중심으로 전환 |
| OAuth | Supabase Auth Google Provider 로그인/callback 처리 |
| User lifecycle | `profiles.status`에 `pending_approval`, `rejected` 추가 |
| Pending 처리 | 신규 Google 사용자는 pending 생성 후 session signOut + sign-in redirect + toast |
| Rejected 처리 | rejected 사용자는 callback 후 session signOut + sign-in redirect + toast |
| Guard | middleware, `requireSession`, `requireDashboardSession`, API guard를 active-only로 정렬 |
| Admin approval | Users pending 행 `수락` / `거절` 액션과 API |
| Profile 확정 | 관리자 수락 시 `profiles.full_name`, 업무/알림 email, role, 조직 필드 확정 |
| Password cleanup | password sign-in, forgot-password, force-password-change, 초기 비밀번호 정책 제거/정리 |
| Matching 보존 | wallet/contracts/reminders/import/my-contracts/notifications active-only 매칭 |
| Activity log | OAuth pending 생성, approve/reject 등 CUD 전 분기 기록 |
| Tests | Playwright/API AC, activity log 검증, Google Tasks 회귀 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| Google Tasks CUD 또는 scope 재설계 | plan 52/54 범위 유지 |
| 로그인 Google 계정과 Tasks 연결 Google 계정 동일성 강제 | 1차 Out |
| 도메인 기반 자동 승인 | 신규 Google 사용자는 도메인과 무관하게 pending |
| pending/rejected dashboard 전용 화면 | 사용하지 않음. auth sign-in redirect + toast 처리 |
| 공개 self-service 승인 요청 수정 UI | pending 사용자는 관리자 승인 대기만 |
| 외부 API 운영 계약 최종 확정 | dev 구현·검증 후 main release 전 조율 |
| 기존 업무 `full_name` 자동 동기화 | Google display name으로 덮어쓰기 금지 |
| 승인/거절 이메일 알림 | 이번 plan에서 **금지**. 필요 시 후속 별도 plan에서 allowlist/dry-run 설계 후 진행 |
| 개발/E2E 검증 중 실사용자 이메일 발송 | 금지. auth migration 검증은 toast/화면 상태/API/DB로 수행 |
| 기존 계약서 독촉·식대 잔액 이메일 로직 변경 | Out. 이번 구현에서 해당 발송 로직을 변경하거나 트리거하지 않음 |

---

## 정책 확정안

| 항목 | 확정 |
|------|------|
| 로그인 방식 | Google OAuth 전용 |
| 이메일/비밀번호 로그인 | 제거/폐기 |
| 기존 admin | `wakeone.ops@gmail.com`도 Google로만 로그인 |
| 신규 Google 사용자 | 자동 승인 없음, 기본 `system_role='user'`, `status='pending_approval'` |
| pending 처리 | callback 직후 session signOut → `/auth/sign-in?authStatus=pending_approval` redirect → toast |
| pending toast | `관리자 승인 대기 중입니다. 승인 완료 후 로그인할 수 있습니다.` |
| rejected 처리 | callback 직후 session signOut → `/auth/sign-in?authStatus=rejected` redirect → toast |
| rejected toast | `가입 요청이 거절되었습니다. 관리자에게 문의해 주세요.` |
| dashboard/API 접근 | `status='active'`만 허용 |
| Google profile 정보 | 참고용. `profiles.full_name`, 업무/알림 email 자동 덮어쓰기 금지 |
| 업무 프로필 확정 | 관리자 수락 시 확정 |
| 기존 user_id | 보존 최우선. 새 user_id가 생기면 기존 사용자로 취급 금지 |
| dev 검증 | 기존 사용자 Google mapping은 dev에서 BLOCKER로 검증 후 main release |
| Presence | 신규 pending dashboard 없음. pending/rejected는 dashboard 밖 auth redirect이므로 `DashboardPresenceTrack` 영향 없음 |
| 이메일 발송 | Google OAuth 승인 플로우는 이메일 발송 없이 toast/화면 상태로 처리 |
| 승인/거절 알림 | email Out. admin 수락/거절은 UI 상태·toast·activity log로만 확인 |

---

## 이메일 발송 안전 제약

이번 auth migration은 개발·E2E·검증·승인 플로우 어느 경로에서도 실사용자 또는 타인에게 이메일을 보내지 않는다.

| 항목 | 정책 |
|------|------|
| Google OAuth 신규 유입 | pending 생성 후 signOut + sign-in redirect + toast. 이메일 발송 없음 |
| pending/rejected 안내 | 로그인 페이지 toast/화면 상태로 처리. 이메일 발송 없음 |
| approve/reject | admin UI toast, 목록 상태, activity log로 확인. 이메일 알림 발송 금지 |
| password reset | forgot-password 제거 범위에 포함. 비밀번호 재설정 이메일 호출 금지 |
| force password change | 제거 범위에 포함. 임시 비밀번호/강제 변경 안내 이메일 없음 |
| 사용자 추가 | 임시 비밀번호 생성·전달 제거. 이메일 초대/임시 비밀번호 메일 없음 |
| 개발/E2E/검증 | SMTP, mail send helper, 외부 이메일 API 호출 금지. 필요 시 mock/dry-run만 후속 plan에서 설계 |
| 기존 운영 이메일 | 계약서 독촉·식대 잔액 이메일 기능 자체는 Out. 이번 구현에서 해당 발송 로직을 변경하거나 트리거하지 않음 |

향후 승인/거절 이메일 알림이 필요해도 본 plan에 포함하지 않는다. 별도 plan에서 수신자 allowlist, dry-run, test mailbox, 운영 발송 게이트를 먼저 설계한 뒤 진행한다.

---

## 데이터/DB 변경

### `profiles.status`

기존:

```sql
check (status in ('active', 'inactive'))
```

신규 후보:

```sql
check (status in ('active', 'inactive', 'pending_approval', 'rejected'))
```

의미:

| status | 의미 | dashboard/API | 외부 이름 매칭 |
|--------|------|---------------|----------------|
| `active` | 승인 완료·정상 이용 | 허용 | 포함 |
| `inactive` | 비활성화 | 차단 | 제외 |
| `pending_approval` | Google 신규 가입 승인 대기 | 차단 | 제외 |
| `rejected` | 가입 요청 거절 | 차단 | 제외 |

### Google 참고 정보

구현 단계에서 `profiles` 컬럼 추가 또는 별도 approval request 테이블 중 선택한다.

필요 데이터:

- `google_email`
- `google_display_name`
- `approval_requested_at`
- `approved_at`
- `approved_by`
- `rejected_at`
- `rejected_by`
- `rejection_reason` 또는 metadata

### Trigger/RPC

- `handle_new_user()`와 `ensure_profile_for_user()`는 현재 `full_name=email`을 생성한다.
- Google 신규 유입에서 이 값이 외부 이름 매칭 키가 되면 안 된다.
- OAuth 신규 사용자 profile 생성 시 `status='pending_approval'`로 생성하고, active 전까지 외부 매칭 쿼리에서 제외되게 한다.
- `profiles.full_name`은 승인 시 관리자가 확정한다.

### 기존 user_id 보존

- 기존 active 사용자 Google 로그인 시 Supabase가 기존 `auth.users.id`에 Google identity를 붙이는지 dev에서 확인한다.
- Google email이 기존 `profiles.email` / auth email과 같아도 새 `auth.users.id`가 생기면 기존 사용자로 취급하지 않는다.
- 새 `user_id` 발생 시 wallet, notifications, activity_logs, Google Tasks connections, contracts 이력이 단절되므로 BLOCKER로 처리한다.

---

## Auth flow

1. 사용자가 `/auth/sign-in`에서 Google 로그인 CTA를 클릭한다.
2. Supabase Google OAuth로 이동한다.
3. OAuth callback 후 server가 `supabase.auth.getUser()`로 세션 user를 확인한다.
4. 기존 active profile과 같은 `user_id`로 확인되면:
   - Google 로그인 성공 처리
   - `auth.sign_in` 성공 로그 기록
   - `/dashboard/overview` 또는 안전한 redirectTo로 이동
5. 신규 Google user라면:
   - `profiles` 또는 approval request를 `pending_approval`로 생성
   - Google email/display name은 참고 정보로 저장
   - session signOut
   - `/auth/sign-in?authStatus=pending_approval` redirect
   - sign-in 페이지에서 pending toast 표시
6. rejected user라면:
   - session signOut
   - `/auth/sign-in?authStatus=rejected` redirect
   - sign-in 페이지에서 rejected toast 표시
7. inactive user라면:
   - 기존 비활성 안내 정책 유지 또는 `accountDisabled=1` redirect
8. middleware/layout/API guard는 active profile만 통과시킨다.

---

## Admin approval flow

### Users 목록

- pending 행은 `수락` / `거절`만 표시한다.
- pending 행에는 기존 `수정`, `비활성화`, `활성화` 액션을 표시하지 않는다.
- active 전환 후 기존 수정/비활성화 액션을 사용할 수 있다.

### 수락

수락 시 관리자가 확정할 항목:

- `profiles.full_name`
- 업무/알림 email (`profiles.email`) 확정값
- `system_role`
- 소속/직급/연락처/생일 등 기존 Users 필수 업무 정보

성공 시:

- `status='active'`
- 승인자/승인 시각 기록
- Users 목록 새로고침 없이 갱신
- activity log `user.approve` 성공 기록

### 거절

거절 시:

- 확인 Dialog 또는 거절 Dialog에서 확정
- `status='rejected'`
- 거절자/거절 시각/사유 기록
- 재로그인 시 rejected toast 안내
- activity log `user.reject` 성공 기록

---

## 비밀번호 기능 제거/정리 범위

Google 로그인 전용 전환에 따라 아래를 제거 또는 폐기한다.

| 대상 | 정리 내용 |
|------|----------|
| 이메일/비밀번호 로그인 폼 | `/auth/sign-in`에서 제거, Google CTA로 대체 |
| `POST /api/auth/sign-in` password route | 제거 또는 폐기. Google OAuth callback으로 대체 |
| forgot-password 페이지 | `/auth/forgot-password/**` 제거 |
| forgot-password API | `/api/auth/forgot-password/request`, `/verify` 제거. 비밀번호 재설정 이메일 호출 금지 |
| force-password-change 페이지 | `/auth/force-password-change/**` 제거 |
| force-password-change API | `/api/auth/force-password-change` 제거 |
| 초기 비밀번호 | `12341234a` 정책 제거 |
| must-change cookie | `must_change_initial_password` 관련 helper·middleware 제거 |
| 사용자 추가 | 임시 비밀번호 생성/전달 제거. 초대/임시 비밀번호 이메일 발송 금지 |
| password_set_at | invite status 판단 기준 재정의. Google-only에서는 password acceptance 지표로 사용하지 않음 |
| 비밀번호 변경 UI | Google-only 전환 후 제거 또는 숨김 |

---

## 외부 API/이름 매칭 보존 전략

`profiles.full_name`은 외부 데이터 매칭의 안정 키다. Google display name/email은 자동 반영하지 않는다.

active-only 보강 대상:

| 도메인 | 보존 전략 |
|--------|----------|
| wallet sync | `profiles` 이름 index를 `status='active'`만 대상으로 생성 |
| wallet balance email | 잔액 알림 가능 대상은 active 사용자만 |
| contracts reminders | `author_name` ↔ `profiles.full_name` 매칭 시 active profile만 |
| contract import notifications | 작성자 알림 fan-out은 active user만 |
| my-contracts | page/API 접근과 이름 scope 모두 active user 기준 |
| notifications | user target/recipient helper가 profile을 조회할 때 active 조건 필요 여부 검토 |
| activity logs display | 과거 로그 표시용 join은 기록 보존 목적이므로 active-only 필터를 무조건 적용하지 않음. 신규 대상 산정과 구분 |

AC에서 pending/rejected와 같은 이름의 사용자가 있어도 wallet/contracts/reminders/import/my-contracts/notifications 매칭 대상이 되지 않음을 검증한다.

---

## Google Tasks plan 52와의 관계

plan 52는 WakeOne 이메일/비밀번호 로그인 유지 상태에서 **Tasks 전용 Google OAuth**를 추가한 기획이다. 본 plan은 WakeOne 로그인 자체를 Google OAuth로 전환한다.

정책:

- 기존 `google_tasks_connections.user_id`는 유지한다.
- 로그인 OAuth와 Tasks OAuth는 1차에서 별도 연결로 유지한다.
- 기존 Tasks 연결이 로그인 전환 때문에 삭제되거나 다른 user_id로 이동하면 안 된다.
- 기존 active 사용자의 `user_id`가 보존되어야 Tasks 연결도 보존된다.
- 로그인 Google 계정과 Tasks 연결 Google 계정 동일성 강제는 Out이다.
- 회귀 AC로 기존 연결 user가 로그인 전환 후 `/dashboard/tasks`에서 연결 상태와 task 조회를 유지하는지 확인한다.

---

## 활동 감사 로그

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md) 패턴 재사용

### action 코드

| action | 설명 |
|--------|------|
| `auth.sign_in` | Google OAuth active 사용자 로그인 성공. plan 45 정책을 Google 기준으로 유지 |
| `user.approval_request` | 신규 Google 사용자 pending profile/request 생성 |
| `user.approve` | admin이 pending 사용자를 active로 수락 |
| `user.reject` | admin이 pending 사용자를 rejected로 거절 |

### 기록 연동 매트릭스

#### Google OAuth callback

| Route | action | 분기 | HTTP/Redirect | 기록 |
|-------|--------|------|---------------|------|
| `GET /api/auth/google/callback` 또는 Supabase callback handler | `auth.sign_in` | 기존 active user success | 302 dashboard | 성공 1건 |
| 동일 | `user.approval_request` | 신규 Google user pending 생성 success | 302 sign-in pending toast | 성공 1건 |
| 동일 | `user.approval_request` | pending 생성 validation/state 문제 | 4xx 또는 sign-in error redirect | 실패 1건 |
| 동일 | `user.approval_request` | DB/profile 생성 실패 | 5xx 또는 sign-in error redirect | 실패 1건 |
| 동일 | 없음 | 기존 pending/rejected 차단 후 signOut redirect | 302 sign-in toast | 상태 변경 없음, 신규 CUD 없음 |

#### Admin approve

| Route | action | 분기 | HTTP | 기록 |
|-------|--------|------|------|------|
| `POST /api/users/[id]/approval/approve` | `user.approve` | 401 unauthenticated | 401 | 실패 1건 |
| 동일 | `user.approve` | 403 non-admin | 403 | 실패 1건 |
| 동일 | `user.approve` | 400 validation | 400 | 실패 1건 |
| 동일 | `user.approve` | 404 target not found | 404 | 실패 1건 |
| 동일 | `user.approve` | 409 target not pending | 409 | 실패 1건 |
| 동일 | `user.approve` | success active 전환 | 200 | 성공 1건 |
| 동일 | `user.approve` | catch/internal | 500 | 실패 1건 |

#### Admin reject

| Route | action | 분기 | HTTP | 기록 |
|-------|--------|------|------|------|
| `POST /api/users/[id]/approval/reject` | `user.reject` | 401 unauthenticated | 401 | 실패 1건 |
| 동일 | `user.reject` | 403 non-admin | 403 | 실패 1건 |
| 동일 | `user.reject` | 400 validation | 400 | 실패 1건 |
| 동일 | `user.reject` | 404 target not found | 404 | 실패 1건 |
| 동일 | `user.reject` | 409 target not pending | 409 | 실패 1건 |
| 동일 | `user.reject` | success rejected 전환 | 200 | 성공 1건 |
| 동일 | `user.reject` | catch/internal | 500 | 실패 1건 |

### metadata allowlist

- `error_code`
- `message`
- `attempted_target`
- `google_email`
- `previous_status`
- `new_status`
- `changed_fields`
- `approval_source`

금지:

- Google access token
- Google refresh token
- Supabase token
- password
- 임시 비밀번호

---

## UI 요구사항

### `/auth/sign-in`

- Google 로그인 CTA 중심으로 표시한다.
- 이메일/비밀번호 입력, 비밀번호 찾기 링크는 제거한다.
- query `authStatus=pending_approval`이면 toast:
  - `관리자 승인 대기 중입니다. 승인 완료 후 로그인할 수 있습니다.`
- query `authStatus=rejected`이면 toast:
  - `가입 요청이 거절되었습니다. 관리자에게 문의해 주세요.`
- 로그인 페이지 SEO/브랜딩은 plan 46 톤을 유지한다.

### Users admin

- 상태 badge에 `승인 대기`, `거절됨`을 추가한다.
- pending 행 action은 `수락`, `거절`만 표시한다.
- `수락` UI는 업무 프로필 필수값을 입력/확정할 수 있어야 한다.
- `거절` UI는 확인 Dialog 또는 사유 입력 Dialog를 사용한다.
- 위험/되돌릴 수 없는 상태 변경은 `AlertModal` 패턴을 따른다.

### Dashboard / Presence

- pending/rejected 전용 dashboard 페이지를 만들지 않는다.
- callback에서 signOut 후 auth route로 돌려보내므로 `DashboardPresenceTrack`에 pending/rejected가 참여하지 않는다.
- 신규 `/dashboard/*` 페이지가 없으므로 presence 추가 구현 없음.

---

## 영향 파일 & 패턴

### 예상 영향 파일

| 파일/영역 | 변경 이유 |
|-----------|-----------|
| `src/features/auth/components/user-auth-form.tsx` | 이메일/비밀번호 폼 제거, Google CTA로 대체 |
| `src/app/api/auth/sign-in/route.ts` | password sign-in route 제거/폐기 |
| `src/app/auth/forgot-password/**` | 제거 |
| `src/app/api/auth/forgot-password/**` | 제거 |
| `src/app/auth/force-password-change/**` | 제거 |
| `src/app/api/auth/force-password-change/route.ts` | 제거 |
| `src/lib/auth/initial-password.ts` | 제거 |
| `src/lib/auth/must-change-cookie.ts` | 제거 |
| `src/features/auth/api/session.server.ts` | active-only guard, password_set_at 의존 제거 |
| `src/lib/supabase/middleware.ts` | `SessionProfileFlags.status` 확장 및 active-only 처리 |
| `middleware.ts` | Google auth callback/public path, active-only redirect 정책 |
| `supabase/sql/05_profiles_status_lifecycle.sql` 후속 migration | status CHECK 확장 |
| `supabase/sql/21_profiles_full_name_triggers.sql` 후속 migration | Google 신규 user profile 생성 정책 수정 |
| `src/features/users/api/types.ts` | `ProfileStatus` 확장 |
| `src/features/users/api/service.server.ts` | pending/rejected listing, invite_status 재정의 |
| `src/features/users/components/users-table/*` | pending row actions, status badge |
| `src/app/api/users/[id]/**` 또는 신규 approval route | approve/reject API |
| `src/features/activity-logs/api/types.ts` | 신규 action |
| `src/features/activity-logs/labels.ts` | 신규 라벨 |
| `src/features/wallet/api/service.server.ts` | active-only name index |
| `src/features/contracts/api/service.server.ts` | my-contracts/reminder/import matching active-only 점검 |
| `src/features/notifications/api/fan-out.server.ts` | active-only recipient helper 점검 |
| `src/features/google-tasks/**` | 기존 connection 회귀 검증 |

### 따라야 할 패턴

- plan 07 `requireSession` / `requireDashboardSession` defense in depth
- plan 08 `recordActivityLog` 전 분기 기록
- plan 14 `AlertModal`
- plan 17 Users mutation `onSettled` invalidate
- plan 19 `full_name` 관리자 확정 정책
- plan 40 filter shell / data body loading
- plan 52 `tasks_user` proxy 회귀 보존

---

## 테스트/AC

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Dev BLOCKER | 기존 active 사용자 `wakeone.ops@gmail.com` 또는 테스트 active user가 존재 | 동일 Google email로 로그인 | 기존 `profiles.user_id`가 유지된다. 새 `auth.users.id`가 생기면 구현 진행 BLOCKER |
| AC-02 | Playwright/API | 신규 Google 계정 | 최초 Google OAuth 완료 | profile/request가 `status='pending_approval'`, 기본 role user/member로 생성된다 |
| AC-03 | Playwright | AC-02 신규 계정 | callback 완료 | session signOut 후 `/auth/sign-in?authStatus=pending_approval`로 이동하고 toast `관리자 승인 대기 중입니다. 승인 완료 후 로그인할 수 있습니다.` 표시 |
| AC-04 | Playwright | rejected 사용자 | Google 로그인 완료 | session signOut 후 `/auth/sign-in?authStatus=rejected`로 이동하고 toast `가입 요청이 거절되었습니다. 관리자에게 문의해 주세요.` 표시 |
| AC-05 | Playwright | pending 사용자 | `/dashboard/overview` 직접 접근 | dashboard shell 미노출, active-only guard로 auth sign-in 안내 흐름 처리 |
| AC-06 | API | pending/rejected 세션 또는 쿠키 상태 | `/api/notifications` 등 보호 API 호출 | HTTP 403 `{ success:false }` 및 active-only 메시지 |
| AC-07 | Playwright | admin | `/dashboard/users`에서 pending 행 확인 | action은 `수락`, `거절`만 보이고 수정/비활성화/활성화는 보이지 않는다 |
| AC-08 | Playwright/API | admin, pending user | 필수 업무 프로필 입력 후 `수락` | status active, 업무 `full_name` 반영, 목록 갱신, `user.approve` 성공 log |
| AC-09 | API/로그 | admin, pending user | approve validation 실패 payload 제출 | 400 응답과 `user.approve` 실패 log 1건, token/password metadata 없음 |
| AC-10 | Playwright/API | admin, pending user | `거절` 확정 | status rejected, 목록 갱신, `user.reject` 성공 log |
| AC-11 | API/로그 | admin, pending user | reject 권한 없는 user가 요청 | 403 응답과 `user.reject` 실패 log 1건 |
| AC-12 | Playwright | 미로그인 | `/auth/sign-in` 로드 | 이메일/비밀번호 input, 비밀번호 찾기 링크가 없고 Google 로그인 CTA가 보인다 |
| AC-13 | API/grep | 구현 후 | auth password routes/pages 검색 | password sign-in route, forgot-password, force-password-change, must-change cookie, 초기 비밀번호 정책이 제거/폐기되어 production path에서 접근되지 않는다 |
| AC-14 | API/DB | pending/rejected와 active가 같은 `full_name`을 가짐 | wallet sync 실행 | active user만 matched, pending/rejected는 unmatched 또는 제외 |
| AC-15 | API/DB | pending/rejected와 active가 같은 `full_name`을 가짐 | contracts reminders/import/my-contracts/notifications matching 실행 | active user만 대상이 된다 |
| AC-16 | Playwright/API | 기존 Google Tasks 연결 user | Google 로그인 전환 후 `/dashboard/tasks` 접근 | 기존 `google_tasks_connections.user_id` 기반 연결 상태와 task 조회가 유지된다 |
| AC-17 | Playwright/API | 로그인 Google 계정과 Tasks 연결 Google 계정이 다름 | `/dashboard/tasks` 조회 | 1차 정책상 기존 Tasks 연결은 유지되고 로그인 OAuth와 충돌하지 않는다 |
| AC-18 | Playwright | pending/rejected 처리 | OAuth callback 후 | pending/rejected 전용 `/dashboard/*` 페이지가 없고 `DashboardPresenceTrack`에 참여하지 않는다 |
| AC-19 | API/로그 | Google active 로그인 성공 | activity logs 조회 | `auth.sign_in` 성공 로그가 있고 password/token metadata가 없다 |
| AC-20 | grep/test | auth migration 구현 후 | auth migration 경로에서 mail send 함수·SMTP 호출 검색 및 테스트 | Google OAuth callback, pending/rejected 처리, approve/reject API에서 mail send helper·SMTP·외부 이메일 API 호출이 없다 |
| AC-21 | API/grep | password cleanup 후 | forgot-password/force-password-change 관련 route/helper 검색 | 비밀번호 재설정 이메일, 임시 비밀번호 이메일, must-change 안내 이메일 호출 경로가 production path에 없다 |
| AC-22 | API/회귀 | 계약서 독촉·식대 잔액 이메일 기능이 기존 상태로 존재 | auth migration 테스트/승인 플로우 실행 | 기존 이메일 발송 로직을 변경하거나 트리거하지 않는다 |
| AC-23 | CLI | 구현 완료 | `bunx playwright test`, typecheck, lint, build | 모두 통과 |

---

## 위험/롤백

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 기존 사용자가 새 `auth.users.id`로 분리되어 이력이 단절 | AC-01 dev BLOCKER. 보존 실패 시 main release 금지 |
| HIGH | Google display name/email이 `full_name`을 덮어써 wallet/contracts 매칭 오염 | trigger/RPC 수정, active-only matching, `full_name` 관리자 확정 |
| HIGH | pending/rejected가 dashboard/API를 통과 | middleware + layout + API guard 모두 active-only, AC-05/06 |
| HIGH | password 기능 일부 잔존으로 우회 로그인 가능 | route/page grep AC, middleware public path 정리 |
| MED | Google Tasks OAuth와 로그인 OAuth 혼동 | plan 52 관계 명시, 회귀 AC-16/17 |
| MED | 승인/거절 log 분기 누락 | return 분기 매트릭스 기반 API spec |
| MED | dev/main 외부 API 차이 | dev에서 외부 API 매칭 확인 후 main release |
| HIGH | 개발/E2E 중 실사용자에게 이메일 발송 | 이메일 발송 금지 섹션, mail send grep/test AC-20~22, 승인/거절 email Out |

Rollback:

- main 반영 전 dev에서 user_id 보존 실패 시 구현을 중단한다.
- password 제거 변경은 auth migration PR 단위로 되돌릴 수 있게 분리한다.
- DB status 확장은 additive라 즉시 롤백보다 guard/UI를 이전 active/inactive 정책으로 되돌리는 편이 안전하다.
- Google Provider 운영 문제가 생기면 main release 전 이메일/비밀번호 로그인 제거를 보류한다.
- `profiles.full_name` 오염 방지 및 active-only matching 변경은 롤백하지 않는 편이 안전하다.

---

## 구현 순서 제안

1. dev 환경 Google Provider 설정 및 기존 active user identity 연결 검증
2. DB migration: status 확장, Google 참고 필드/approval metadata, trigger/RPC 수정
3. Auth flow: Google sign-in CTA, OAuth callback, pending/rejected signOut redirect + toast
4. Guard 정렬: middleware, session.server, dashboard layout, API active-only
5. Admin approval: Users pending 표시, approve/reject API, activity log
6. Password cleanup: sign-in password route/UI, forgot-password, force-password-change, 초기 비밀번호/must-change 제거
7. Email safety hardening: auth migration 경로 mail send/SMTP 호출 없음 grep·테스트
8. External matching hardening: wallet/contracts/reminders/import/my-contracts/notifications active-only
9. Google Tasks 회귀 확인
10. Playwright/API specs, typecheck, lint, build
11. dev 외부 API 검증 후 main release 판단

**Checkpoint:** 1단계 dev identity 연결 검증 실패 시 이후 구현·main release 진행 금지.

---

## 열린 질문

| 항목 | 상태 |
|------|------|
| 기존 active user Google identity 연결 방식 | dev 검증 BLOCKER |
| approval metadata 저장 위치 | 구현 단계에서 `profiles` 확장 vs 별도 테이블 확정 |
| 수락 시 필수 업무 필드 최종 목록 | 기존 Users 필수값 기준으로 시작, designer/backend 단계에서 확정 가능 |
| rejected 재신청 허용 여부 | 1차는 rejected 유지, 재신청 UI Out |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-02 | 최초 작성 (Approved) — Google 로그인 전용 전환, 신규 Google 사용자 승인 대기, password 기능 제거, 외부 이름 매칭 active-only 보존 | planner |
| 2026-10-02 | 이메일 발송 안전 제약 보강 — auth migration 개발/E2E/승인 흐름 이메일 발송 금지, password reset 이메일 호출 금지, 기존 운영 이메일 기능 Out 명시 | planner |
