# 사용자 라이프사이클·프로필 UX 기획서

> Date: 2026-06-04  
> Status: Completed  
> Author: planner  
> **SQL:** `05` · `supabase/sql/05_profiles_status_lifecycle.sql` (원격 적용 완료)  
> **선행:** [01_supabase-auth-login-plan.md](./01_supabase-auth-login-plan.md), [02_user-invite-profiles-plan.md](./02_user-invite-profiles-plan.md)  
> **입력:** [tasks.md](../../tasks.md) §0~§4

## 한 줄 요약

초대 **이메일 중복 사전 차단**, Users **삭제→비활성화(소프트 딜리트)**·즉시 세션 종료·로그인 차단, 프로필 페이지를 **next-shadcn-dashboard-starter** 스타일로 재구성하고 **비밀번호 변경 Sheet**·로그아웃을 제공한다.

---

## 정책 확정안 (§0 · §B)

| 항목 | 확정 |
|------|------|
| **중복 이메일** | `profiles.email` 기준 **대소문자 무시** 중복 검사. **`status=active`·`inactive` 모두** 중복으로 간주 → 초대·메일·`createUser` **전** 400 차단. **재초대·재활성화 UI 없음** — 동일 이메일 재사용은 **추후 전용 plan**(인터뷰 확정: **A**). |
| **비활성 목록** | admin Users 테이블에 **비활성 사용자도 표시**, `status` 컬럼 또는 배지 **「비활성」**. 기본 목록은 전체(필터 UI는 Out, API는 `status` 필드 반환만). |
| **DB 플래그** | `profiles.status` `text` CHECK (`active` \| `inactive`) + `deactivated_at timestamptz` (비활성 시각, active면 NULL). |
| **Auth 연동** | 비활성 시 `auth.admin.signOut(userId, 'global')` + `auth.admin.updateUserById` **ban** (로그인 차단). **하드 `deleteUser` 금지**. |
| **Realtime (필수)** | admin이 user A를 비활성화하면 A의 **대시보드 클라이언트**가 `profiles` UPDATE를 **Realtime**으로 수신 → 즉시 `signOut` + `/auth/sign-in?accountDisabled=1` + 토스트. `signOut(global)`만으로는 **AC #4 대체 불가**. |
| **프로필 헤더** | `PageContainer` **pageHeaderAction 비움** — 로그아웃·비밀번호 변경 버튼을 **헤더에 두지 않음** (인터뷰 확정). |
| **본인 비활성화** | 로그인 admin의 **본인 행**만 Users 액션 메뉴에서 「비활성화」**UI 숨김**. **다른 user·다른 admin** 행에는 표시. API self-deactivate 400은 **방어용 유지**. |
| **비활성 행 편집** | `status=inactive` → admin **수정 불가(읽기 전용)**. 「수정」메뉴 UI 숨김, `PUT /api/users/[id]`도 inactive 대상 **400** (인터뷰 확정). |
| **프로필 레이아웃** | **세로 섹션 한 페이지**(Profile → Account → Security 스크롤). **Tabs Out** (인터뷰 확정). |
| **비밀번호 변경 후** | 성공 시 **전역 세션 무효화**(`signOut` scope global 또는 동등) → **재로그인 유도** · 현재 세션만 유지 **Out** (인터뷰 확정). |
| **이메일 유일성** | `profiles`에 `unique index on (lower(email))` **In** — 초대 선조회 + DB 레이스 방지 (인터뷰 확정). |
| **비밀번호 UI** | **Security 섹션**에서 「비밀번호 변경」→ **Sheet** (현재/새/확인). 로그아웃도 **Security 섹션** 버튼(헤더 아님). |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin, Users | 이미 존재하는 이메일(활성)로 초대 제출 | 400 · 「이미 등록된 이메일입니다」 토스트 · 메일 미발송 |
| 2 | Playwright | admin, 비활성 계정 이메일 존재 | 동일 이메일 초대 | AC #1과 동일(중복 차단) |
| 3 | Playwright | admin, 활성 user A | Users에서 A **삭제(비활성화)** 확인 | `profiles.status=inactive` · 성공 토스트 |
| 4 | Playwright | user A 로그인 세션 있음 | AC #3 직후 (**Realtime** 수신) | A는 **즉시 로그아웃**·대시보드 접근 불가 · 「비활성화된 계정입니다」 토스트 |
| 5 | Playwright | user A 비활성 | `/auth/sign-in` 재로그인 시도 | 실패 · **「비활성화된 계정입니다」** 토스트(또는 동등 메시지) |
| 6 | Playwright | admin | Users 목록 | 비활성 user **「비활성」** 배지 표시 |
| 6b | Playwright | admin 로그인 | 본인 행 액션 메뉴 | **비활성화 없음** · 다른 user/admin 행에는 **있음** |
| 6c | Playwright | admin, inactive user 행 | 액션 메뉴 | **수정 없음** · (active 행 대비) |
| 7 | Playwright | 로그인 user | `/dashboard/profile` **Security** · 비밀번호 Sheet | 변경 성공 토스트 · **자동 로그아웃** · **새 비밀번호로** `/auth/sign-in` 재로그인 성공 |
| 8 | Playwright | 로그인 user | 프로필 **Security** 섹션 **로그아웃** | `/auth/sign-in` 이동 · 세션 없음 |
| 9 | 수동 | — | 프로필 페이지 레이아웃 | 스타터와 **동등한 정보 구조** · **세로 섹션 3블록**(탭 없음) |
| 10 | CLI | — | `npx tsc --noEmit` | 통과 |
| 11 | CLI | — | `npm run lint:strict` | 통과 |
| 12 | CLI | — | `npm run build` | 통과 |

---

## 범위 (In / Out)

### In Scope (구현 순서)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | 초대 중복 | `invite.server.ts` · `POST /api/users` — `profiles` 이메일 선조회 |
| B | 소프트 딜리트 | SQL `05` · `07`(Realtime publication) · `DELETE` · `signOut(global)` · **Realtime 구독** · middleware·sign-in |
| C | 비밀번호 Sheet | `PATCH /api/profile/password` · 프로필 Sheet · Zod |
| D | 프로필 UX | 스타터 정렬 · `ProfileForm` · 로그아웃 · §C 연동 |
| E | 검증 | Playwright · tsc · lint · build · Vercel env 체크리스트 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| Clerk, org/membership, Edge Function 초대 | — |
| 첫 로그인 비밀번호 **강제** 변경 | 별도 plan |
| 비활성 계정 **재활성화** UI | 별도 plan |
| admin이 타 user `system_role` 변경 | plan 02 TBD 유지 |
| 이메일 본인 변경 | TBD |
| Realtime **이외**의 목록 자동 갱신(다른 admin 화면 동기화) | Users 테이블은 수동 새로고침·React Query invalidate로 충분 |

---

## A) 초대 — 동일 이메일 중복 방지

### 동작

1. `inviteUserWithTemporaryPassword` **최상단**에서 service_role로  
   `profiles.select('user_id').eq('email', normalizedEmail).maybeSingle()` (또는 `ilike` 정규화).
2. 행 존재 시 `throw new Error('이미 등록된 이메일입니다.')` — **createUser·SMTP 미호출**.
3. DB unique 위반(`profiles_email_lower_unique`)도 동일 메시지로 매핑.
4. `POST /api/users` catch → **400** + message.
5. FE: `inviteUser`는 이미 `apiClientWithMessage` — 토스트 유지.

### 영향 파일

- `src/features/users/api/invite.server.ts`
- `src/app/api/users/route.ts` (status code mapping 확인)

---

## B) 사용자 삭제 → 소프트 딜리트

### DB (`05_profiles_status_lifecycle.sql`)

```sql
-- profiles.status active|inactive, deactivated_at
-- 기존 행: status='active', deactivated_at NULL
-- RLS: inactive 본인 select는 가능하나 앱에서 차단; admin은 목록 조회 가능
```

- `is_system_admin()` 유지 · admin만 타인 `status` 변경(서비스 role 또는 정책).
- 목록 GET: `status`, `deactivated_at` select 추가.

### API `DELETE /api/users/[id]`

**현재:** `auth.admin.deleteUser(id)` → **제거**

**변경 순서:**

1. 자기 자신 비활성화 **금지** (400, API 방어). FE: 세션 user id === 행 id 이면 **비활성화 메뉴 미표시** (인터뷰 확정).
2. `profiles` → `status=inactive`, `deactivated_at=now()`.
3. `auth.admin.signOut(id, 'global')`.
4. `auth.admin.updateUserById(id, { ban_duration: '876000h' })` (또는 동등 ban — 로그인 API 차단).
5. 200 + 「사용자가 비활성화되었습니다」.

### API `PUT /api/users/[id]`

- 대상 `profiles.status === 'inactive'` → **400** 「비활성화된 사용자는 수정할 수 없습니다」 (active만 수정).

### 세션·접근 차단

| 계층 | 동작 |
|------|------|
| **middleware** | `updateSession`에서 `profiles.status` 로드. `inactive` + dashboard → sign-in 리다이렉트 `?accountDisabled=1` + 쿠키 정리는 `signOut` API 호출 또는 redirect 전 `supabase.auth.signOut` in middleware **불가** → **Route에서 global signOut은 DELETE 시 서버에서 이미 수행**; middleware는 **추가 요청** 시 세션 무효·프로필 inactive면 redirect |
| **sign-in** | `signIn` 성공 직후 `profiles.status` 확인 → inactive면 `signOut` + 에러 메시지 |
| **API** | `requireAdminSession`·`getSessionProfile` — inactive 본인은 403 |
| **토스트** | Realtime 비활성 수신 시 + `sign-in`에서 `accountDisabled` searchParam → sonner 「비활성화된 계정입니다」 |
| **Realtime** | `ProfileStatusRealtime` — `postgres_changes` on `profiles` `user_id=eq.{session}` · `status→inactive` 시 signOut·redirect |

### FE

- `deleteUser` → `apiClientWithMessage` (Supabase 메시지 노출).
- `cell-action` / AlertModal 카피: 「비활성화」 (삭제 아님). **본인 행**(`data.id === sessionUserId`)이면 비활성화 메뉴·모달 **렌더 생략**; 타 user·타 admin **active** 행은 표시.
- **inactive 행:** 「수정」메뉴 숨김 · 비활성화는 이미 inactive이므로 메뉴 최소화(또는 비활성화 항목만 없음).
- `columns`: `status` 배지.

### 영향 파일

- `supabase/sql/05_profiles_status_lifecycle.sql`
- `src/app/api/users/[id]/route.ts`
- `src/lib/supabase/middleware.ts` (`SessionProfileFlags.status`)
- `middleware.ts`
- `src/features/auth/api/service.ts` (sign-in 후 status 검사)
- `src/features/auth/api/session.server.ts`, `types.ts`
- `src/app/api/users/route.ts`, `service.server.ts`, `types.ts`, `columns.tsx`
- `src/features/users/api/service.ts`, `mutations.ts`
- `supabase/sql/07_profiles_realtime.sql`
- `src/features/auth/components/profile-status-realtime.tsx`
- `src/app/dashboard/layout.tsx`

---

## C) 비밀번호 변경 Sheet

### UX (인터뷰 확정)

- `/dashboard/profile` **헤더(`pageHeaderAction`)**: 액션 버튼 **없음** (로그아웃·비밀번호 변경 금지).
- 스타터 구조 **Security 섹션**:
  - **「비밀번호 변경」** → `Sheet` (현재/새/확인, Zod min 8·일치) → `PATCH /api/profile/password`
  - **「로그아웃」** → `signOut` (`service.ts`)
- Profile/Account 섹션: 기존 3필드 폼만.

### API `PATCH /api/profile/password`

- 본인 세션 필수 (`createClient` + `getUser`).
- 서버에서 **현재 비밀번호 검증**: 동일 이메일로 `signInWithPassword` 1회(또는 Supabase reauthenticate 패턴) 후 `updateUser({ password })`.
- 실패: generic 「비밀번호 변경에 실패했습니다」(현재 비밀번호 틀림 포함).
- 성공: 200 → **해당 user `auth.admin.signOut(userId, 'global')`**(service_role) 또는 클라이언트 `signOut` 후 응답. FE: 토스트 「비밀번호가 변경되었습니다. 다시 로그인해 주세요.」→ `/auth/sign-in` 리다이렉트.

### 영향 파일

- `src/app/api/profile/password/route.ts` (신규)
- `src/features/auth/components/profile-password-sheet.tsx` (신규)
- `src/features/auth/schemas/password.ts` (신규)
- `src/features/auth/api/profile.client.ts`

---

## D) 프로필 페이지 — 스타터 정렬

### 레퍼런스

[next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) — 정보 구조 참고: Profile / Account / Security. WakeOne 구현: **단일 페이지 + 세로 섹션 3개**(Tabs 미사용), 섹션 제목·`Separator`로 구분. 아바타·이메일 read-only. **보안(비밀번호 Sheet·로그아웃)은 Security 섹션만** — 헤더 액션 없음.

### WakeOne 매핑 (`profiles` only)

| UI | DB 필드 |
|----|---------|
| 이메일 (read-only) | `email` |
| 이름 / 성 | `first_name`, `last_name` |
| 연락처 | `phone` |
| 역할 (read-only, admin만 표시 optional) | `system_role` |
| 보안 (Security 섹션) | §C Sheet · 로그아웃 버튼 |

- **DB 추가 최소화:** §B `status` 외 필드 추가 없음. 아바타 URL 등은 Out.
- **헤더:** `pageTitle` / `pageDescription` 만 — `pageHeaderAction` **미설정**.

### 영향 파일

- `src/app/dashboard/profile/page.tsx`
- `src/features/auth/components/profile-form.tsx` (섹션 분리)
- `src/features/auth/components/profile-security-section.tsx` (신규 권장: Sheet·로그아웃)

---

## API / DB 요약

| 경로 | 메서드 | 동작 |
|------|--------|------|
| `/api/users` | POST | 중복 검사 후 초대 (A) |
| `/api/users` | GET | `status` 포함 목록 (B) |
| `/api/users/[id]` | DELETE | **비활성화** (B) |
| `/api/profile` | PATCH | 본인 3필드 (기존) |
| `/api/profile/password` | PATCH | 본인 비밀번호 (C) |

---

## RBAC · middleware 변경 요약

- `updateSession`: `select('password_set_at, system_role, status')`.
- `inactive` + `isDashboardPath` → redirect `/auth/sign-in?accountDisabled=1`.
- `inactive` + `isSignInPath` + authenticated → signOut + redirect.
- Users RBAC: 기존 admin만 (변경 없음).

---

## E) 검증 (verifier)

1. Supabase MCP 또는 CLI: `05` migration 적용.
2. Playwright AC #1~#9 (로컬 `.env` E2E admin/user).
3. `tsc` → `lint:strict` → `build`.
4. Vercel Production: `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_*`, `NEXT_PUBLIC_APP_URL` (plan 02 메모).

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | ban/signOut API 실패 시 비활성만 DB 반영 | 트랜잭션 순서·에러 시 롤백 또는 재시도 문서화 |
| HIGH | middleware에 `status` 미반영 시 비활성 user 대시보드 잔류 | AC #4·#5 필수 |
| MED | 비밀번호 변경 시 signInWithPassword 이중 호출 | 서버 전용·rate limit 인지 |
| MED | 이메일 대소문자 중복 | `lower(email)` unique index 또는 조회 시 normalize |
| LOW | 스타터와 픽셀 불일치 | AC #9 구조 동등·디자이너 체크리스트 |

---

## 열린 질문

- [x] `profiles.email`: **`lower(email)` UNIQUE 인덱스** — SQL `05` 적용 (인터뷰 2026-06-04). 적용 전 중복 이메일 있으면 migration 실패 → 수동 정리.
- [x] admin 본인 비활성화: **FE 숨김** + API 400 방어 (인터뷰 2026-06-04)

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-04 | 최초 작성 (tasks §0~§4 통합, Status Approved) | planner |
| 2026-06-04 | 인터뷰: 중복 이메일 **A**(재활성화 별도 plan), 프로필 **헤더 액션 없음**(Security에 로그아웃·비밀번호) | planner |
| 2026-06-04 | 인터뷰: admin **본인 행만** 비활성화 UI 숨김, 타 user/admin 행은 표시 | planner |
| 2026-06-04 | 인터뷰: **inactive 행 읽기 전용**(수정 UI·PUT 차단) | planner |
| 2026-06-04 | 인터뷰: 프로필 **세로 섹션 한 페이지**(Tabs Out) | planner |
| 2026-06-04 | 인터뷰: 비밀번호 변경 성공 → **전역 로그아웃·재로그인** | planner |
| 2026-06-04 | 인터뷰: `lower(email)` **UNIQUE 인덱스 In** | planner |
