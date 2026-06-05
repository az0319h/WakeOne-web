# 라우팅·인증 인가 방어 강화 기획서

> Date: 2026-06-05  
> Status: Completed  
> Author: planner  
> **선행:** [01_supabase-auth-login-plan.md](./01_supabase-auth-login-plan.md) (middleware AC #4~#5 · Out: API 전역 인증) · [02~06](./README.md) Users·프로필·RBAC (Completed)

## 한 줄 요약

**비로그인은 `/dashboard/*` 어디든 접근 불가** → sign-in. **로그인한 사용자는 대시보드 전 페이지 접근 가능** (`/dashboard/users`만 admin 예외). **middleware + dashboard layout 이중 가드**, **`/api/*` 세션 필수**(products mock 포함), **`redirectTo` 내부 path allowlist**로 plan 01 Out 항목을 마무리한다.

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | 미로그인 | `/dashboard/overview` 주소창 직접 입력 | URL `/auth/sign-in`, 쿼리 `redirectTo=/dashboard/overview` |
| 2 | Playwright | 미로그인 | `/dashboard/product` 직접 입력 | `/auth/sign-in` redirect (dashboard 하위 **전 경로** 동일) |
| 3 | Playwright | `system_role=user` 로그인 | `/dashboard/users` 직접 입력 | `/dashboard/overview?accessDenied=users` (기존 동작 유지) |
| 4 | Playwright | 로그인·password 설정 완료 | `/auth/sign-in` 직접 입력 | `/dashboard/overview` redirect |
| 5 | Playwright | 미로그인 | `/dashboard/kanban` 이동 | **사이드바·헤더 등 dashboard 셸 미노출** — sign-in 페이지만 표시 |
| 6 | Playwright | inactive 계정 | `/dashboard/overview` | `/auth/sign-in?accountDisabled=1` |
| 7 | Playwright | password 미설정 계정 | `/dashboard/overview` | `/auth/set-password` |
| 8 | Playwright | 유효 계정 sign-in 성공 | `redirectTo=//evil.com` 쿼리 후 로그인 | **`/dashboard/overview`(또는 allowlist 내부 path)** — 외부 URL 이동 **없음** |
| 9 | API (curl) | 미인증(쿠키 없음) | `GET /api/products` | HTTP **401**, `{ success: false, message: '인증이 필요합니다.' }` |
| 10 | CLI | — | `npm run build` | 통과 |

**회귀 (명시):** plan 01 AC #4~#7 · plan 02~06 Users·profile API·inactive·set-password 흐름 **유지**.

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **Middleware** | `/dashboard/*` 미로그인 → sign-in + `redirectTo`; inactive·password 미설정 기존 분기 유지; **`/dashboard/users` admin RBAC** 중앙 설정과 연동 |
| B | **Defense in depth** | `dashboard/layout.tsx` — middleware와 **동일 정책**으로 미로그인·inactive·password 미설정 redirect (셸 노출 방지) |
| C | **공통 가드 헬퍼** | `requireSession()` (API·RSC), `requireDashboardSession()` (layout), `requireAdminPage()` / admin path registry — redirect·JSON 응답 **일관** |
| D | **API `/api/*`** | **전 Route Handler** 세션 필수 — `/api/products`, `/api/products/[id]` 포함; 기존 `/api/users`, `/api/profile` 패턴 **`requireSession`으로 정렬** |
| E | **redirectTo allowlist** | sign-in 성공 후 **내부 path만** 허용 (`/dashboard/*` 기본, `/`·`/auth/set-password` 등 필요 최소 추가); `//`, `http:` 등 **거부** |
| F | **Admin 경로 중앙화** | admin-only path 목록 **1곳** 정의 → middleware + (필요 시) page 가드 공유 — 현재 **`/dashboard/users`만** |
| G | **검증** | Playwright AC #1~#8 · curl AC #9 · build |

### Out of Scope

| 항목 | 비고 |
|------|------|
| 세션 만료·토큰 refresh **UX** | 후속 |
| 비밀번호 변경 후 **타 기기 세션 무효화** | plan 03 password route는 유지; 전역 정책은 후속 |
| sign-in **rate limit** | 인프라/Vercel — 후속 |
| CSRF **구현** | Supabase SSR cookie + SameSite — **문서화만** 후속 |
| nav RBAC **UX 변경** | client-side 숨김 유지; 보안은 서버 가드 |
| RLS 스키마 변경 | DB 2차 방어 **회귀 확인**만 |
| Playwright CI 스위트 | verifier MCP 스모크 (plan 01과 동일) |

---

## 선행 plan 참조

| plan | 관계 |
|------|------|
| **01** | middleware dashboard/auth 양방향 가드 **확장** — Out 「API Route Handler 전역 인증」→ **본 plan In** |
| **02~06** | `requireAdminSession`, Users·profile API·inactive·set-password — **재사용·회귀** |
| **07** | 신규 — defense in depth + API 전역 + redirectTo |

---

## 정책 확정 (사용자 답변 반영)

| 항목 | 확정 |
|------|------|
| Dashboard 접근 | **비로그인 → `/dashboard/*` 전부 불가** → `/auth/sign-in?redirectTo={pathname}` |
| 로그인 후 dashboard | **모든 `/dashboard/*` 페이지 접근 가능** (데모·starter 페이지 포함) |
| Admin 예외 | **`/dashboard/users`만** admin — 일반 user → `/dashboard/overview?accessDenied=users` (**기존 동작**) |
| Admin 경로 관리 | **중앙 registry 1곳** (2-A) — 신규 admin URL 추가 시 한 곳만 수정 |
| API | **`/api/*` 세션 필수** — products mock 포함 (3: 대시보드 가드만이 아님, API·redirectTo **함께 In**) |
| redirectTo | **allowlist** — 상대 path·`/dashboard/*` 우선; 외부·protocol-relative **차단** |
| Layout | **middleware + layout 이중 가드** (defense in depth) |

---

## 재현 시나리오 (verifier·수동)

| # | 시나리오 | 재현 | 목표 |
|---|---------|------|------|
| R1 | 미로그인 overview | 시크릿 → `/dashboard/overview` | sign-in + redirectTo |
| R2 | 미로그인 users | 시크릿 → `/dashboard/users` | sign-in (로그인 전 admin URL도 차단) |
| R3 | user → users | user 로그인 → `/dashboard/users` | overview + accessDenied |
| R4 | 로그인 auth | 로그인 → `/auth/sign-in` | overview |
| R5 | layout 셸 | 미로그인 → 임의 dashboard URL | **셸 없음** (AC-5) |
| R6 | API products | `curl -i /api/products` | 401 |
| R7 | API users | `curl -i /api/users` | 401 (기존 유지) |
| R8 | open redirect | sign-in `?redirectTo=//evil.com` | overview fallback |
| R9 | inactive | inactive → dashboard | accountDisabled |
| R10 | set-password | pending → dashboard | set-password |

---

## A) Backend — API·공통 가드

### `requireSession()` (신규 · `session.server.ts` 또는 `auth-guard.server.ts`)

- `supabase.auth.getUser()` — 없으면 **401** JSON `{ success: false, message: '인증이 필요합니다.' }`
- profile 조회 — `inactive` → **403** 「비활성화된 계정입니다」
- `password_set_at === null` → **403** 또는 401 + 메시지 (dashboard와 정책 **일치**)
- 성공 시 `{ userId, profile }` 반환

### `requireAdminSession()` (기존)

- **유지** — users API admin 전용; 내부적으로 `requireSession` + `system_role === 'admin'` 공유 가능

### Admin path registry (신규 · 예: `src/config/admin-routes.ts`)

```ts
export const ADMIN_DASHBOARD_PATHS = ['/dashboard/users'] as const;
// pathname match helper: isAdminDashboardPath(pathname)
```

- `middleware.ts` — hardcoded users 분기 → registry 사용
- `requireAdminPage()` — RSC redirect (users page와 중복 제거 가능)

### API 적용

| Route | 변경 |
|-------|------|
| `GET/POST /api/products` | `requireSession` 선행 |
| `GET/PUT/DELETE /api/products/[id]` | 동일 |
| `/api/profile`, `/api/profile/password` | 인라인 auth → **`requireSession` 정렬** (동작 동일) |
| `/api/users`, `/api/users/[id]` | `requireAdminSession` 유지 |

### Middleware API 분기

- `pathname.startsWith('/api/')` → `updateSession` + **미인증 401 JSON** (dashboard redirect와 분리)
- public API 예외: **없음** (Out — webhook 등 후속 시 registry에 `PUBLIC_API_PATHS` 추가)

### 영향 파일 (BE)

| 파일 | 변경 |
|------|------|
| `src/features/auth/api/session.server.ts` | `requireSession`, `requireDashboardSession` |
| `src/features/auth/api/admin.server.ts` | `requireSession` 재사용 |
| `src/config/admin-routes.ts` (신규) | admin path registry |
| `src/lib/auth/safe-redirect.ts` (신규) | `sanitizeRedirectTo(input, fallback)` |
| `middleware.ts` | API 401, admin registry, redirectTo는 sign-in URL 생성만 |
| `src/app/api/products/**` | requireSession |
| `src/app/api/profile/**` | requireSession 정렬 |

---

## B) Frontend — layout·sign-in

### `dashboard/layout.tsx`

- `requireDashboardSession()` 호출 — 미로그인 → `redirect('/auth/sign-in?redirectTo=…')`
- inactive · password 미설정 → middleware와 **동일 destination**
- profile null 시 **NavAccessProvider에 null 전달하지 않고 redirect** (셸 미렌더)

### `user-auth-form.tsx`

- `redirectTo` → `sanitizeRedirectTo(searchParams.get('redirectTo'), '/dashboard/overview')`
- `router.push(safePath)` only

### `users/page.tsx` (선택 리팩터)

- `requireAdminPage()` 또는 registry 기반 가드 — middleware **이중** (회귀)

### 영향 파일 (FE)

| 파일 | 변경 |
|------|------|
| `src/app/dashboard/layout.tsx` | defense in depth |
| `src/features/auth/components/user-auth-form.tsx` | sanitize redirectTo |
| `src/app/dashboard/users/page.tsx` | 공통 admin 가드 (선택) |

---

## C) Designer

- **UI 변경 최소** — sign-in·accessDenied 토스트·overview 리다이렉트 **기존 패턴 유지**
- 확인: 미로그인 시 dashboard **레이아웃(사이드바) 플래시 없음** (AC-5)
- redirect 실패 시 fallback은 overview — **별도 에러 UI 불필요**

---

## 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | middleware·layout **이중 redirect** 불일치 | `requireDashboardSession` 단일 헬퍼 + middleware 동일 상수 |
| 2 | API 401 vs dashboard redirect 혼동 | `/api/*`는 **항상 JSON 401**, HTML redirect 금지 |
| 3 | products mock 401 후 데모 페이지 깨짐 | dashboard product 페이지가 API 호출 시 **로그인 세션 전제** — AC-9로 확인 |
| 4 | allowlist 과도 제한 | 기본 `/dashboard/overview` + 요청 path가 allowlist면 유지 |

---

## 추정

| 항목 | 값 |
|------|-----|
| 복잡도 | Medium |
| 파일 | ~10–12 |
| BE | ~1–2h |
| FE | ~1h |
| verifier | ~30m |

---

## 열린 질문

| # | 항목 | 기본값 |
|---|------|--------|
| 1 | allowlist에 `/auth/set-password` 포함 여부 | password pending은 middleware가 처리 — sign-in redirectTo에서는 **`/dashboard/*`만** |
| 2 | API password 미설정 시 403 vs 401 | dashboard와 동일 메시지 — **403** `[TBD]` 구현 시 확정 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-05 | 최초 작성 · Approved (사용자 범위 확정) | planner |
