# 로그인 이메일 분리 입력 UX 기획서

> Date: 2026-08-06  
> Status: Approved  
> Author: planner  
> **선행:** [01_supabase-auth-login-plan.md](./01_supabase-auth-login-plan.md) (Completed · UX 확장)  
> **예정 slug:** `34_login-email-split-ux-plan.md`

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **01** | **확장(UX 수정)** — `signInWithPassword`·middleware·profiles 흐름 **유지**. sign-in 폼 입력 UI만 로컬 파트 + 도메인 Combobox로 분리 |
| **07** | auth guard — **변경 없음** (로그인 성공 후 redirect 동일) |
| **02** | 초대·프로필 email 필드 — **Out** (sign-in만 In) |
| **08** | activity log — **본 plan Out** (로그인·로그아웃 기록 없음) |

---

## 한 줄 요약

`/auth/sign-in` 로그인 폼의 이메일 입력을 **로컬 파트 Input + 도메인 Combobox(free text)** 로 분리하고, submit 시 `{local}@{domain}` 조합 후 기존 `signInWithEmail`·`normalizeEmail` 경로로 인증한다. **BE/SQL 변경 없음.**

---

## 목표 & 완료 기준

- `@wakecorp.com` 사용자가 **로컬 파트만** 입력해도 로그인 가능 (도메인 기본값 `wakecorp.com`)
- 도메인은 **Combobox + free text** (preset: `wakecorp.com`, `gmail.com`, `naver.com`)
- 로컬 파트 **`@` 입력 차단**, trim 후 **1자 이상**, submit 시 **조합 email 1회** `z.string().email()` 검증
- 기존 plan 01 AC(유효 자격 증명 → dashboard, 실패 토스트, 한국어 UI) **회귀 없음**
- designer **desktop+mobile 목업 2안** (기본 도메인 / 직접입력·free text) 산출
- Playwright spec green · tsc · lint · build 통과

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **sign-in 폼** | `user-auth-form.tsx` — `localPart` + `domain` 필드, submit 시 email 조합 |
| 2 | **도메인 Combobox** | shadcn `Popover` + `Command` + `CommandInput` (free text), preset 3종 + 임의 도메인 |
| 3 | **검증** | `useAppForm` + Zod (`docs/forms.md`); `@` 차단은 Input `onChange` 또는 schema refine |
| 4 | **sign-in 뷰** | `sign-in-view.tsx` — 안내 문구·레이아웃(2-column 유지, mobile stack) 조정 |
| 5 | **상수** | `src/features/auth/constants/login-domain-options.ts` (preset 목록) |
| 6 | **스키마** | `src/features/auth/schemas/sign-in-form.ts` (조합 refine) |
| 7 | **E2E** | `e2e/auth/sign-in-email-split.spec.ts` 신규; 기존 sign-in placeholder 의존 spec **회귀 수정** |
| 8 | **designer** | desktop+mobile 목업 2안 (plan AC #D1~#D4) |

### Out of Scope

| 항목 | 비고 |
|------|------|
| BE Route Handler · SQL · RLS | Out |
| `signInWithEmail` / Supabase Auth API 변경 | Out — 조합된 전체 email만 전달 |
| activity log `recordActivityLog` | Out — 로그인 |
| 초대·Users·프로필 등 **다른 email 입력 UI** | Out |
| `E2E_USER_EMAIL` / `E2E_ADMIN_EMAIL` env 형식 변경 | Out — 전체 주소 유지; auth setup은 Supabase API 직접 호출 |
| 도메인 선택 **localStorage 기억** | Out (후속) |
| OAuth · sign-up | plan 01 Out 유지 |

---

## 활동 감사 로그

**activity log 해당 없음** — 본 plan은 로그인(Read+Auth) UI만 변경. 신규 mutation·`recordActivityLog` 연동 없음.

---

## UI 요구사항

### 필드 구성

| 필드 | 컴포넌트 | 기본값 | 비고 |
|------|----------|--------|------|
| **로컬 파트** | `Input` `type="text"` | `''` | label 「이메일」 또는 「아이디」; placeholder 예: `이름` · `autoComplete="username"` |
| **도메인** | Combobox (free text) | `wakecorp.com` | `@` 접두사 **UI에 표시하지 않음** (조합은 submit 시) |
| **비밀번호** | 기존 `Input` | — | 변경 최소 |

### 레이아웃

- **Desktop (lg+):** plan 01 2-column 유지. 우측 폼 영역에서 로컬 파트 + 도메인을 **한 행(flex)** 또는 **스택** — designer 목업 #D1/#D2에서 확정.
- **Mobile:** 세로 스택; CTA 「로그인」 버튼 항상 도달 가능 (기존 sign-in 패턴).
- **시각 구분:** 로컬 파트와 도메인 사이 `@` **고정 텍스트** 표시 권장 (읽기 전용 span, designer 목업 반영).

### 도메인 Combobox (shadcn)

- **Preset:** `wakecorp.com`, `gmail.com`, `naver.com`
- **Free text:** `CommandInput`에 `@` 없이 `example.co.kr` 형태 입력 → 선택/확정 시 `domain` 값 저장
- **패턴 참고:** `wallet-user-combobox.tsx`, `log-user-combobox.tsx`, `demo-form.tsx` `ComboboxField`
- **`useAppForm`:** `AppField` render props 내부 `useState` 금지 → 도메인 Combobox는 **별도 컴포넌트** (`LoginDomainCombobox`)로 분리
- **a11y:** trigger `role="combobox"`, `data-testid="login-domain-combobox"`

### 폼·검증 (`docs/forms.md`)

```ts
// submit 직전 또는 onSubmit schema refine
const combinedEmail = `${localPart.trim()}@${domain.trim()}`;
z.string().email({ message: '올바른 이메일 주소를 입력해 주세요.' }).parse(combinedEmail);
```

- 로컬 파트: trim 후 `.min(1, '이메일을 입력해 주세요.')`; `@` 포함 시 필드 에러 또는 입력 차단
- 성공 시 `form.reset()` — plan 01·convention 유지 (빈 defaultValues)
- 실패 시 reset **금지**

### sign-in-view copy

- 부제: 「이메일과 비밀번호로 로그인하세요.」→ 「**아이디(이메일 앞부분)** 과 도메인, 비밀번호로 로그인하세요.」(designer·FE 협의 가능, AC는 **2필드 노출** 기준)

---

## Designer UI 미리보기 (필수 산출)

designer 단계에서 **구현 전** 아래 목업을 제공하고, FE는 목업과 **필드 배치·@ 구분·Combobox trigger 스타일**을 맞춘다.

| # | 산출 | 내용 |
|---|------|------|
| **D1** | Desktop 목업 **A** | 기본 도메인 `wakecorp.com` 선택 상태 · 로컬 파트 Input + `@` + Combobox trigger |
| **D2** | Desktop 목업 **B** | Combobox open 또는 free text 확정 상태 (예: `custom-domain.co.kr`) |
| **D3** | Mobile 목업 **A** | #D1과 동일 상태 · viewport ~390px |
| **D4** | Mobile 목업 **B** | #D2와 동일 상태 · viewport ~390px |

**전달 형식:** Figma 링크 또는 `docs/design/` 정적 이미지·md 와이어 (프로젝트 designer 관례 따름).

---

## API / DB 요구사항

**해당 없음** — FE-only. `signInWithEmail({ email: combined, password })` 호출만 유지.

---

## 영향 파일 (예상)

### 신규

| 경로 | 이유 |
|------|------|
| `src/features/auth/constants/login-domain-options.ts` | preset 도메인 목록 |
| `src/features/auth/schemas/sign-in-form.ts` | Zod + 조합 refine |
| `src/features/auth/components/login-domain-combobox.tsx` | Combobox + free text |
| `e2e/auth/sign-in-email-split.spec.ts` | sign-in UX E2E |

### 수정

| 경로 | 이유 |
|------|------|
| `src/features/auth/components/user-auth-form.tsx` | 2필드 폼·조합 submit |
| `src/features/auth/components/sign-in-view.tsx` | 안내 copy·필드 영역 레이아웃 |
| `e2e/users/list.spec.ts` | placeholder `이메일을 입력하세요` → 분리 필드 셀렉터로 **회귀 수정** (해당 테스트만) |

### 변경 없음 (명시)

| 경로 | 비고 |
|------|------|
| `src/features/auth/api/service.ts` | `normalizeEmail` + `signInWithPassword` 그대로 |
| `middleware.ts` | Out |
| `e2e/auth.setup.ts`, `e2e/helpers/supabase-auth-storage.ts` | API 직접 로그인 — env 전체 email 유지 |

---

## E2E spec 범위

**파일:** `e2e/auth/sign-in-email-split.spec.ts`

**셀렉터:** `getByRole` · `getByPlaceholder` · `getByTestId` **만** (CSS class 금지)

**인증:** sign-in 플로우 spec은 `storageState` **미사용** (미로그인). 자격 증명은 `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` env — **전체 email 파싱**하여 local+domain 입력 (`@` split).

**회귀:** `e2e/users/list.spec.ts` 내 sign-in UI 의존 테스트 — placeholder 변경 시 함께 green.

---

## Acceptance Criteria (Given-When-Then)

### 기능 AC

| # | Given | When | Then |
|---|-------|------|------|
| 1 | 미로그인 사용자가 `/auth/sign-in`에 있을 때 | 페이지 로드 완료 | `getByRole('heading', { name: '로그인' })` 표시 · 로컬 파트 입력 필드 표시 · `getByTestId('login-domain-combobox')` 표시 · Combobox trigger에 **`wakecorp.com`** 표시 |
| 2 | AC-1 상태 | 로컬 파트에 `@` 입력 시도 | `@` 문자가 값에 **포함되지 않음** (차단 또는 제거) |
| 3 | AC-1 상태 · 로컬 파트 비움 | 「로그인」 클릭 | 이메일(로컬 파트) 필수 에러 표시 · URL `/auth/sign-in` 유지 · dashboard redirect **없음** |
| 4 | AC-1 상태 · `E2E_USER_EMAIL`을 `@` 기준 split한 local/domain · 올바른 `E2E_USER_PASSWORD` | 「로그인」 클릭 | 「로그인되었습니다.」 토스트 · URL `/dashboard/overview` (또는 `redirectTo` 없을 때) |
| 5 | AC-1 상태 · 로컬 파트 `not-a-valid-local` · 도메인 `wakecorp.com` · 임의 비밀번호 | 「로그인」 클릭 | 자격 증명 실패 토스트(plan 01 `INVALID_CREDENTIALS` 한국어) · `/auth/sign-in` 유지 |
| 6 | AC-1 상태 | 도메인 Combobox에서 `gmail.com` 선택 | trigger에 **`gmail.com`** 표시 |
| 7 | AC-1 상태 | Combobox `CommandInput`에 `example.co.kr` 입력 후 확정 | trigger(또는 필드 값)에 **`example.co.kr`** 반영 |
| 8 | AC-1 상태 · 로컬 파트 `ab` · 도메인 `not..valid` | 「로그인」 클릭 | 「올바른 이메일 주소를 입력해 주세요.」에러 표시 · sign-in **실패** · dashboard redirect 없음 |
| 9 | AC-4 로그인 성공 직후 | (내부) 폼 state 확인 | 로컬 파트·비밀번호 **초기화** (defaultValues) |
| 10 | `viewport` width 390px · AC-1 | 페이지 로드 | 로컬 파트·도메인·비밀번호·「로그인」 버튼 **모두 viewport 내 스크롤 없이 접근 가능** (버튼 `getByRole('button', { name: '로그인' })` visible) |

### Designer 미리보기 AC

| # | Given | When | Then |
|---|-------|------|------|
| D1 | designer 산출 완료 | desktop 목업 A 검토 | 로컬 Input + `@` + Combobox(`wakecorp.com`) + 비밀번호 + CTA 배치가 **한 화면에 명시** |
| D2 | designer 산출 완료 | desktop 목업 B 검토 | free text 도메인(또는 Combobox open) 상태가 **목업 B에 명시** |
| D3 | designer 산출 완료 | mobile 목업 A 검토 | #D1과 동일 정보 구조 · **~390px** 폭 |
| D4 | designer 산출 완료 | mobile 목업 B 검토 | #D2와 동일 정보 구조 · **~390px** 폭 |

### CLI / 회귀 AC

| # | Given | When | Then |
|---|-------|------|------|
| 11 | 구현·spec 작성 완료 | `bunx playwright test e2e/auth/sign-in-email-split.spec.ts` | **전부 green** |
| 12 | AC-11 green | `bunx playwright test e2e/users/list.spec.ts` (sign-in 의존 케이스 포함) | **green** (placeholder 회귀 없음) |
| 13 | 구현 완료 | `bunx tsc --noEmit` · lint · build | **통과** |

---

## 리스크 & 완화

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | Combobox free text 도메인에 `@`·공백 포함 | trim + `@` strip refine · AC-8 |
| 2 | MED | 기존 E2E `getByPlaceholder('이메일을 입력하세요')` 깨짐 | list.spec.ts 회귀 수정 · AC-12 |
| 3 | MED | `AppField` 내부 Combobox state → convention 위반 | `LoginDomainCombobox` 별도 컴포넌트 · `docs/forms.md` |
| 4 | LOW | mobile 한 행 배치 overflow | designer D3/D4 선행 · AC-10 |
| 5 | LOW | preset 외 도메인 실제 계정 없음 | AC-5·6·7은 UI·검증만; 실제 로그인은 env 계정 |

---

## 열린 질문

- [TBD] 로컬 파트 label 「이메일」 vs 「아이디」 — designer 목업에서 확정
- [TBD] desktop 필드 배치: 한 줄(`local @ domain`) vs 두 줄 — designer D1/D2에서 확정

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-06 | 최초 작성 · deep-interview 확정 반영 · Status Approved | planner |
