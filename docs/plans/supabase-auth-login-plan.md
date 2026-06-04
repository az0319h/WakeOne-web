# Supabase Auth 로그인/로그아웃 기획서

> Date: 2026-06-04  
> Status: Approved (복원: 2026-06-04)  
> Author: planner  
> **기준 문서:** 인증 1차 범위는 이 파일만 사용. `auth-rbac-supabase-plan.md`는 삭제됨(레거시).

## 한 줄 요약

Supabase 이메일/비밀번호로 sign-in·로그아웃을 연동하고, **`auth.users` 생성 시 `profiles`를 자동 생성**(이메일만 채움, 이름 등은 빈 값)하여 로그인이 가능하도록 한다. **`/dashboard/*`는 미로그인 차단**, **`/auth/*`는 로그인 상태에서 진입 차단**한다.

---

## 구현 상태 (2026-06-04 `/run` 재구현)

| 구분 | 상태 | 비고 |
|------|------|------|
| 기획서 | **완료** | 이 문서 |
| SQL `02`, `03` | **완료** | repo + Supabase migration 적용됨 |
| `src/lib/supabase/*` | **완료** | client / server / middleware |
| `src/features/auth/api/*` | **완료** | service, session.server, types |
| `middleware.ts` | **완료** | origin + dashboard/auth 양방향 가드 |
| sign-in UI·토스트·로그아웃 | **완료** | 한국어, sonner, NavUser |
| sign-up 라우트 | **완료** | repo에 sign-up 페이지 없음 |
| `npm run build` | **검증 필요** | verifier 실행 |

---

## 목표 & 완료 기준

### 목표

- 기존 sign-in UI 셸(`sign-in-view`)에 Supabase Auth 실제 로그인/로그아웃 연결
- **신규 Auth 사용자** → DB에서 **`public.profiles` 자동 생성**
- 자동 프로필: **이메일만** 동기화, `first_name` / `last_name` = `''`
- 공개 sign-up 없음 (Dashboard·Admin API·SQL로 사용자 생성)
- 로그인 시점에 `profiles` row 존재 (트리거 + RPC 폴백)

### 완료 기준 (AC)

1. 유효한 이메일/비밀번호 sign-in 성공 → `/dashboard/overview`
2. **새 `auth.users` INSERT 시** `profiles` 자동 생성 → 해당 계정 **로그인 성공**
3. 자동 `profiles`: `email` = Auth 이메일, `first_name`/`last_name` = `''`, `system_role` = `'user'`
4. 미로그인 → `/dashboard/*` → `/auth/sign-in?redirectTo={pathname}`
5. **로그인 상태** → `/auth/*` → `/dashboard/overview` (쿼리 제거)
6. 사이드바 Account 로그아웃 → 세션 종료 → `/auth/sign-in`
7. `/auth/sign-up` 라우트·네비 링크 제거
8. `npm run build` 통과
9. (권장) verifier 6단계: Playwright MCP로 AC #1~#7 스모크 (`E2E_*` env)

### [폐기] 이전 정책

- ~~`profiles` 없으면 로그인 차단 + "계정이 아직 활성화되지 않았습니다" (`PROFILE_NOT_FOUND`)~~

---

## 범위 (In / Out)

### In Scope

- `@supabase/ssr`, `signInWithPassword`, `signOut`, SSR 쿠키 세션
- sign-in: 이메일 + 비밀번호 (`useAppForm` + Zod), **UI 문구 한국어**
- API/성공·실패 피드백: **sonner 토스트** (`src/lib/notify.ts`), 인라인 alert 박스 지양
- `auth.users` INSERT → `profiles` 자동 생성 (`02_auth_user_auto_profile.sql`)
- 로그인 후 `ensure_profile_for_user()` RPC 폴백 (레거시·트리거 누락)
- `03_fix_profiles_rls_recursion.sql` 적용 (profiles RLS 재귀 방지)
- `/dashboard/*` · `/auth/*` **양방향** `middleware.ts` 가드
- 사이드바 Footer: 이름 비어 있으면 **이메일**, 로그아웃
- env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`

### Out of Scope (후속)

- 공개 sign-up, OAuth(GitHub 버튼 제거)
- 관리자 초대 UI / Edge Function
- RBAC 메뉴 필터링 고도화
- 프로필 온보딩(필수 입력 강제)
- API Route Handler 전역 인증
- Playwright Test CI 스위트 (MCP 스모크는 verifier 6단계)

### 후속 정책 (참고)

- 초대 시 프로필 필드 **UPDATE로 보강**
- 초기 비밀번호: 난수, 8자+, 문자 1개+
- 로그인 ID: 이메일

---

## DB 요구사항

### 스키마 (기존)

`supabase/sql/01_auth_rbac_base.sql` — `profiles.user_id` → `auth.users.id` (PK, CASCADE)

### 마이그레이션 (필수 순서)

| 파일 | 내용 |
|------|------|
| `01_auth_rbac_base.sql` | 테이블·RLS 기본 (이미 repo에 있음) |
| `02_auth_user_auto_profile.sql` | `handle_new_user` 트리거, `ensure_profile_for_user` RPC, 백필 |
| `03_fix_profiles_rls_recursion.sql` | `is_system_admin()` + 정책 교체 |

Supabase MCP `apply_migration` 또는 SQL Editor로 **02 → 03** 순 적용.

### 자동 프로필 규칙

| 컬럼 | 값 |
|------|-----|
| `user_id` | `new.id` |
| `email` | `coalesce(new.email, '')` |
| `first_name`, `last_name` | `''` |
| `system_role` | default `'user'` |

### RLS 이슈 (해결됨)

`01`의 `profiles` 정책이 동일 테이블을 서브쿼리하면 **infinite recursion**. `03`에서 `public.is_system_admin()` (`security definer`)로 대체.

---

## 영향 파일 (목표 구현)

### Backend / Infra

| 경로 | 작업 |
|------|------|
| `package.json` | `@supabase/ssr` 의존성 |
| `src/lib/supabase/client.ts` | 브라우저 클라이언트 |
| `src/lib/supabase/server.ts` | Server Component / Route Handler |
| `src/lib/supabase/middleware.ts` | `updateSession()` + `getUser()` |
| `middleware.ts` | origin 유지 + dashboard/auth 세션 가드 |
| `src/features/auth/api/types.ts` | AuthProfile, 에러 코드 |
| `src/features/auth/api/service.ts` | signIn, signOut, getProfile, ensureProfile |
| `src/features/auth/api/session.server.ts` | RSC용 세션·프로필 |
| `supabase/sql/02_*.sql`, `03_*.sql` | DB |

### Frontend

| 경로 | 작업 |
|------|------|
| `src/features/auth/components/user-auth-form.tsx` | 이메일·비밀번호, Supabase signIn, 토스트 |
| `src/features/auth/components/sign-in-view.tsx` | sign-up 링크·GitHub 제거 |
| `src/features/auth/lib/display-name.ts` | 빈 이름 → 이메일 |
| `src/lib/notify.ts` | `notifySuccess` / `notifyError` (sonner) |
| `src/components/nav-user.tsx` | 로그아웃 `signOut` |
| `src/components/layout/app-sidebar.tsx` | 세션 프로필 주입 |
| `src/app/page.tsx` | 세션 있으면 dashboard redirect |
| `src/app/auth/page.tsx` | `/auth` → sign-in redirect |
| 삭제 | `src/app/auth/sign-up/**`, `sign-up-view.tsx`, `github-auth-button.tsx` (선택) |

### Route Guard (`middleware.ts` 목표)

| 경로 | 조건 | 동작 |
|------|------|------|
| `/dashboard/*` | 세션 없음 | `/auth/sign-in?redirectTo={pathname}` |
| `/auth/*` | 세션 있음 | `/dashboard/overview` (search 제거) |
| 그 외 | — | origin 검사만 통과 |

`updateSession` 후 리다이렉트 응답에 **세션 쿠키 복사** 필수.

---

## UI 요구사항

- **한국어** 사용자 문구
- Sign-in: 2-column 레이아웃 유지
- 로그인 실패: 토스트 (top-center, sonner 기본)
- Sidebar: `first_name` + `last_name` trim 후 비어 있으면 **email**

---

## API / 인증 흐름

### 사용자 생성 → 프로필

1. `auth.users` INSERT (Dashboard Add user 등)
2. 트리거 `on_auth_user_created` → `profiles` INSERT
3. (1회) 백필 SQL in `02`

### 로그인

1. `signInWithPassword({ email, password })`
2. `profiles` 조회 by `session.user.id`
3. 없으면 `ensure_profile_for_user()` RPC
4. `router.push(redirectTo ?? '/dashboard/overview')`

### 로그아웃

1. `signOut()`
2. `/auth/sign-in`

### 루트 `/`

- 세션 있음 → `/dashboard/overview`
- 없음 → `/auth/sign-in`

---

## 환경 변수

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000   # production origin

# verifier Playwright MCP (optional)
E2E_BASE_URL=http://localhost:3000
E2E_USER_EMAIL=
E2E_USER_PASSWORD=
# E2E_SKIP_BROWSER=1
```

Supabase Dashboard: **Email provider ON**, **self-signup OFF** 권장.

---

## 검증 (verifier) — 브라우저 AC 우선

| 순서 | 단계 |
|------|------|
| 1 | `npm run dev` 기동 |
| 2 | **Playwright MCP** — 이 문서 AC #1~#7 (**1차 게이트**, 실패 시 기획→`/planner`) |
| 3 | `npx tsc --noEmit` |
| 4 | `npm run lint:strict` |
| 5 | `npx react-doctor@latest --verbose --diff` |
| 6 | `npm run build` |

`/run` 완료 시 2단계 skip 불가. 상세: `.cursor/skills/playwright-mcp-verifier/SKILL.md`

---

## 리스크 & 완화

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | 기획·SQL만 있고 앱 미연동 | 이 문서 + `/run` 재구현 후 **반드시 git commit** |
| HIGH | 트리거 미적용 | MCP migration + 백필 |
| HIGH | RLS 재귀 | `03` 적용 |
| MED | 빈 프로필로 RBAC 오동작 | 후속 membership/초대 |
| LOW | `01`과 `03` 정책 중복 | `03`이 `01` 정책 replace |

---

## 열린 질문

- [TBD] 트리거만 vs 로그인 시 RPC 폴백 유지 기간
- [TBD] `middleware.ts`를 `src/middleware.ts`로 옮길지 (Next convention)

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-04 | 최초 작성 (이메일 로그인, profiles FK, sign-up 제거) | planner |
| 2026-06-04 | 정책 변경: profiles 차단 → **auth.users 시 profiles 자동 생성** | planner |
| 2026-06-04 | Route Guard: 로그인 시 `/auth/*` → dashboard | planner |
| 2026-06-04 | UX: 한국어·sonner 토스트·`notify.ts` | FE |
| 2026-06-04 | SQL `02`, `03` + MCP 적용 (세션 내 완료) | backend-dev |
| 2026-06-04 | **문서·SQL repo 복원** (Git 미커밋으로 소실 후 재작성) | agent |
| 2026-06-04 | `/run` — 앱 코드 전면 재구현 (Supabase Auth·미들웨어·UI) | FE+BE |
| 2026-06-04 | 로그인 시 `/auth/*` 차단: `auth/layout` 서버 redirect + nav Login 제거 + 로그아웃 full navigation | FE |
| 2026-06-04 | verifier: Playwright MCP를 **2단계 1차 게이트**로, 기획 AC 실패 시 `/planner` | 오케스트레이션 |
