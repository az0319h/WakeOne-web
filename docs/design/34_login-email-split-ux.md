# 로그인 이메일 분리 입력 UX — Designer 산출물

> Plan: [34_login-email-split-ux-plan.md](../plans/34_login-email-split-ux-plan.md)  
> Date: 2026-08-06  
> Status: Approved for FE implementation

---

## 설계 결정 (TBD 확정)

| 항목 | 결정 | 근거 |
|------|------|------|
| 로컬 파트 label | **「아이디」** | `@wakecorp.com` 사용자는 로컬 파트만 입력 · 부제 copy와 일치 |
| Desktop 이메일 행 | **한 줄** (`local` + `@` + `domain`) | `max-w-md` 폼 폭에서 가독·스캔 최적 · 이메일 mental model |
| Mobile 이메일 행 | **한 줄 유지** (390px) | AC-10 · `min-w-0` + domain trigger `truncate` |
| Combobox trigger 스타일 | `demo-form` `ComboboxField` 패턴 | `variant='outline'` · `w-full` · `font-normal` — 필터용 dashed Button(**Out**) |
| `@` 표시 | 로컬 Input과 Combobox **사이 고정 span** | plan 권장 · `@`는 UI에만, 값에는 미포함 |
| 도메인 기본값 | `wakecorp.com` | plan AC-1 |
| activity log UI | **변경 없음** | 로그인 Out |

---

## D1 — Desktop · 기본 도메인 (`wakecorp.com`)

```text
╭─ preview — zsh ─────────────────────────────────────╮
│ ~/WakeOne-web                                      │
│ $ bun run preview                                  │
│ ✓ preview ready                                    │
│                                                    │
│  ╭─ /auth/sign-in · Desktop (≥1024px) ───────────╮  │
│  │                                                │  │
│  │  ┌─────────────────────┬──────────────────┐   │  │
│  │  │ WakeOne (sidebar)   │      로그인       │   │  │
│  │  │ grid pattern        │                  │   │  │
│  │  │ quote…              │  아이디(이메일 앞  │   │  │
│  │  │                     │  부분)과 도메인,   │   │  │
│  │  │                     │  비밀번호로…      │   │  │
│  │  │                     │                  │   │  │
│  │  │                     │  아이디          │   │  │
│  │  │                     │  ┌──────┐ @ ┌──────────────┐ │  │
│  │  │                     │  │ 홍길동│   │ wakecorp.com ▼│ │  │
│  │  │                     │  └──────┘   └──────────────┘ │  │
│  │  │                     │                  │   │  │
│  │  │                     │  비밀번호        │   │  │
│  │  │                     │  ┌──────────────────────┐ │   │  │
│  │  │                     │  │ ••••••••             │ │   │  │
│  │  │                     │  └──────────────────────┘ │   │  │
│  │  │                     │                  │   │  │
│  │  │                     │  ┌──────────────────────┐ │   │  │
│  │  │                     │  │       로그인         │ │   │  │
│  │  │                     │  └──────────────────────┘ │   │  │
│  │  │                     │  이용약관 · 개인정보…   │   │  │
│  │  └─────────────────────┴──────────────────┘   │  │
│  ╰────────────────────────────────────────────────╯  │
│                                                    │
│ → ~/WakeOne-web                                    │
╰────────────────────────────────────────────────────╯
```

**요약:** 2-column 유지 · 우측 `max-w-md` · 이메일 3분할 한 줄 · Combobox trigger 닫힘 · `wakecorp.com` 표시.

---

## D2 — Desktop · free text / Combobox open

```text
╭─ preview — zsh ─────────────────────────────────────╮
│ ~/WakeOne-web                                      │
│ $ bun run preview                                  │
│ ✓ preview ready                                    │
│                                                    │
│  ╭─ /auth/sign-in · Desktop · 도메인 직접입력 ────╮  │
│  │                                                │  │
│  │  … (좌측 sidebar 동일) …                       │  │
│  │                                                │  │
│  │  아이디                                        │  │
│  │  ┌──────┐ @ ┌──────────────────┐               │  │
│  │  │ 홍길동│   │ example.co.kr  ▼ │ ← trigger    │  │
│  │  └──────┘   └──────────────────┘               │  │
│  │              ╭─ Popover ─────────────╮        │  │
│  │              │ 🔍 도메인 검색…        │        │  │
│  │              │ ─────────────────────  │        │  │
│  │              │ ✓ wakecorp.com         │        │  │
│  │              │   gmail.com            │        │  │
│  │              │   naver.com            │        │  │
│  │              │ ─────────────────────  │        │  │
│  │              │ 「example.co.kr」 사용  │ ← free │  │
│  │              ╰────────────────────────╯        │  │
│  │                                                │  │
│  │  비밀번호 … · [ 로그인 ]                       │  │
│  ╰────────────────────────────────────────────────╯  │
│                                                    │
│ → ~/WakeOne-web                                    │
╰────────────────────────────────────────────────────╯
```

**요약:** `CommandInput`에 `example.co.kr` 입력 · preset 목록 + **「{입력값} 사용」** CommandItem · 확정 시 trigger에 `@` 없이 `example.co.kr`.

---

## D3 — Mobile · 기본 도메인 (~390px)

```text
╭─ preview — zsh ─────────────────────────────────────╮
│ ~/WakeOne-web                                      │
│ $ bun run preview                                  │
│ ✓ preview ready · viewport 390×844                 │
│                                                    │
│  ╭─ /auth/sign-in · Mobile ───────────────────────╮  │
│  │                                                │  │
│  │              로그인                            │  │
│  │   아이디(이메일 앞부분)과 도메인,              │  │
│  │   비밀번호로 로그인하세요.                     │  │
│  │                                                │  │
│  │   아이디                                       │  │
│  │   ┌─────┐ @ ┌─────────────┐                    │  │
│  │   │홍길동│   │wakecorp.com▼│                    │  │
│  │   └─────┘   └─────────────┘                    │  │
│  │   (flex min-w-0 · domain truncate)             │  │
│  │                                                │  │
│  │   비밀번호                                     │  │
│  │   ┌────────────────────────────┐               │  │
│  │   │ ••••••••                   │               │  │
│  │   └────────────────────────────┘               │  │
│  │                                                │  │
│  │   ┌────────────────────────────┐               │  │
│  │   │         로그인             │  ← visible    │  │
│  │   └────────────────────────────┘               │  │
│  │   이용약관 …                                   │  │
│  ╰────────────────────────────────────────────────╯  │
│                                                    │
│ → ~/WakeOne-web                                    │
╰────────────────────────────────────────────────────╯
```

**요약:** sidebar **hidden** (`lg:flex`) · 단일 column · 이메일 행 **한 줄 유지** · CTA viewport 내 visible (AC-10).

---

## D4 — Mobile · free text (~390px)

```text
╭─ preview — zsh ─────────────────────────────────────╮
│ ~/WakeOne-web                                      │
│ $ bun run preview                                  │
│ ✓ preview ready · viewport 390×844                 │
│                                                    │
│  ╭─ /auth/sign-in · Mobile · free text ───────────╮  │
│  │                                                │  │
│  │              로그인                            │  │
│  │   … (부제 동일) …                              │  │
│  │                                                │  │
│  │   아이디                                       │  │
│  │   ┌─────┐ @ ┌─────────────┐                    │  │
│  │   │홍길동│   │example.co.…▼│ ← truncated      │  │
│  │   └─────┘   └─────────────┘                    │  │
│  │                                                │  │
│  │   (Popover full-width · align start ·          │  │
│  │    PopoverContent min(w-[var(--radix-popover-  │  │
│  │    trigger-width)], 280px))                    │  │
│  │                                                │  │
│  │   비밀번호 …                                   │  │
│  │   [ 로그인 ]                                   │  │
│  ╰────────────────────────────────────────────────╯  │
│                                                    │
│ → ~/WakeOne-web                                    │
╰────────────────────────────────────────────────────╯
```

**요약:** D2와 동일 정보 구조 · trigger 긴 도메인 `truncate` · Popover는 trigger 폭 기준 full-width.

---

## 컴포넌트 트리

```
/auth/sign-in/page.tsx                    (변경 없음 · RSC)
└── SignInViewPage                        sign-in-view.tsx
    ├── [lg+] Left brand column           (기존 유지)
    └── Right form column                 max-w-sm sm:max-w-md
        ├── h1 「로그인」
        ├── p  부제 (copy 변경)
        ├── UserAuthForm                  user-auth-form.tsx
        │   └── Suspense fallback         text 「로딩 중…」(기존 유지 · dashboard Spinner Out)
        │       └── UserAuthFormFields
        │           form.AppForm
        │           └── form.Form space-y-2
        │               ├── EmailRowFieldSet          ← 신규 래퍼 (fieldset 또는 div)
        │               │   ├── FieldLabel 「아이디」
        │               │   └── div.flex.items-end.gap-2
        │               │       ├── form.AppField name='localPart'
        │               │       │   └── Input type='text'
        │               │       │       autoComplete='username'
        │               │       │       placeholder='이름'
        │               │       │       spellCheck={false}
        │               │       │       onChange: @ strip/block
        │               │       ├── span.text-muted-foreground 「@」(aria-hidden)
        │               │       └── form.AppField name='domain'
        │               │           └── LoginDomainCombobox  ← 신규
        │               ├── form.AppField name='password'    (기존 유지)
        │               └── Button type='submit' isLoading   「로그인」 w-full
        └── Terms links                   (기존 유지)
```

### 신규 파일

| 파일 | 역할 |
|------|------|
| `src/features/auth/constants/login-domain-options.ts` | `DEFAULT_LOGIN_DOMAIN`, `LOGIN_DOMAIN_PRESETS` |
| `src/features/auth/schemas/sign-in-form.ts` | Zod · localPart/domain · 조합 email refine |
| `src/features/auth/components/login-domain-combobox.tsx` | Popover+Command free text Combobox |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `user-auth-form.tsx` | 2필드 · schema import · submit `{local}@{domain}` |
| `sign-in-view.tsx` | 부제 copy |

---

## LoginDomainCombobox 상세

### Props

```ts
interface LoginDomainComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  isTouched: boolean;
  isValid: boolean;
  disabled?: boolean;
}
```

### UI · 동작

| 항목 | spec |
|------|------|
| Trigger | `Button variant='outline' role='combobox' aria-expanded` · `className='h-9 min-w-[8.5rem] shrink-0 justify-between font-normal'` · `data-testid='login-domain-combobox'` · `aria-label='이메일 도메인'` |
| Trigger 텍스트 | `value` 그대로 (`@` **미표시**) · `truncate` + `min-w-0` |
| Preset | `wakecorp.com`, `gmail.com`, `naver.com` — `CommandGroup heading='자주 쓰는 도메인'` |
| Free text | `CommandInput placeholder='도메인 검색 또는 입력…'` · 입력값 trim · `@` strip · 공백 strip |
| Free text 확정 | (1) preset `CommandItem` 선택 · (2) 입력값과 일치하는 **「{domain} 사용」** Item · (3) Enter 시 현재 입력값 확정 |
| Empty | preset 필터 0건 + 입력 있음 → 「{입력} 사용」만 표시 |
| Check icon | 선택된 preset에 `Icons.check` (wallet/log 패턴) |
| PopoverContent | `className='w-[var(--radix-popover-trigger-width)] p-0'` · `align='start'` |
| 내부 state | `open`, `search` — **컴포넌트 내부** (`AppField` render props `useState` 금지) |

### 참고 패턴

- Trigger/full-width: `src/components/forms/demo-form.tsx` `ComboboxField`
- Popover/Command 구조: `wallet-user-combobox.tsx` · `log-user-combobox.tsx`
- `shouldFilter={true}` (preset만 소량 · 클라이언트 필터 OK)

---

## 레이아웃 · Tailwind

### Email row (desktop + mobile 공통)

```tsx
<div className='flex items-end gap-2'>
  <div className='min-w-0 flex-1'>
    {/* localPart Input — h-9 */}
  </div>
  <span
    className='text-muted-foreground pb-2 text-sm select-none'
    aria-hidden='true'
  >
    @
  </span>
  <div className='min-w-0 shrink-0 sm:min-w-[9rem] md:min-w-[10.5rem]'>
    {/* LoginDomainCombobox */}
  </div>
</div>
```

### sign-in-view copy

| 위치 | 변경 후 |
|------|---------|
| 부제 `<p>` | `아이디(이메일 앞부분)과 도메인, 비밀번호로 로그인하세요.` |

---

## 폼 · 검증 (`docs/forms.md`)

### Schema (`sign-in-form.ts`)

```ts
// 필드
localPart: z.string().trim().min(1, '이메일을 입력해 주세요.')
  .refine((v) => !v.includes('@'), '아이디에 @를 포함할 수 없습니다.')
domain: z.string().trim().min(1, '도메인을 선택하거나 입력해 주세요.')
  .refine((v) => !v.includes('@'), '…')

// onSubmit superRefine 또는 조합 함수
const combined = `${localPart.trim()}@${domain.trim()}`;
z.string().email({ message: '올바른 이메일 주소를 입력해 주세요.' }).parse(combined);
```

### Input `@` 차단 (이중)

1. **onChange:** `@` 포함 문자 제거 (paste 포함 · `preventDefault` on paste **금지**)
2. **schema refine:** 잔여 `@` 필드 에러

### Submit

```ts
signInWithEmail({ email: combinedEmail, password })
```

- 성공 → `form.reset()` (빈 localPart · domain=`DEFAULT_LOGIN_DOMAIN` · password '')
- 실패 → reset **금지**

### defaultValues

```ts
{ localPart: '', domain: 'wakecorp.com', password: '' }
```

---

## 로딩 UI

| 구분 | spec |
|------|------|
| Auth page | dashboard `PageLoadingSpinner` **해당 없음** |
| `UserAuthForm` Suspense | 기존 `로딩 중…` 텍스트 유지 |
| Combobox Read | 서버 fetch **없음** — `PageLoadingSpinner` **불필요** |
| Submit | `Button isLoading={isPending}` (기존) |

---

## 접근성 · E2E

| 항목 | spec |
|------|------|
| Heading | `h1` 「로그인」(기존) |
| Local input | `id='localPart'` · label `htmlFor` · `autoComplete='username'` |
| Domain combobox | `role='combobox'` · `aria-expanded` · `aria-label='이메일 도메인'` · `data-testid='login-domain-combobox'` |
| `@` span | `aria-hidden='true'` |
| Keyboard | Popover/Command 기본 키보드(nav shadcn) · Tab order: local → domain → password → submit |
| E2E 셀렉터 | `getByRole` · `getByPlaceholder` · `getByTestId` only |

---

## 품질 검토 (Step 5)

| 영역 | 결과 |
|------|------|
| 접근성 | label/`aria-label`/`role='combobox'` 확보 · `@` decorative hidden |
| 키보드 | shadcn Command 키보드 nav · focus-visible Button/Input 기본 |
| 모바일 390px | 한 줄 + truncate · CTA full-width · `min-h-screen` center 유지 |
| 에러 | `FieldError` inline · 조합 email 실패 시 form/domain 필드 중 **하나**에 메시지 (FE: domain 또는 form-level `FormErrors`) |
| 로딩 | auth 범위 · Spinner 신규 없음 |
| convention | `Icons.*` · `cn()` · `src/components/ui/` 미수정 · AppField 내부 useState 금지 → 별도 Combobox |
| activity log UI | 변경 없음 |

---

## Frontend-dev Handoff

### 구현 순서

1. `login-domain-options.ts` · `sign-in-form.ts`
2. `login-domain-combobox.tsx` (단독 Story 없음 · sign-in에서 통합)
3. `user-auth-form.tsx` refactor
4. `sign-in-view.tsx` copy
5. `e2e/auth/sign-in-email-split.spec.ts` + `e2e/users/list.spec.ts` 회귀

### 핵심 AC 매핑

| AC | 구현 포인트 |
|----|-------------|
| 1 | default domain `wakecorp.com` · testid |
| 2 | localPart onChange `@` strip |
| 3–5, 8 | Zod + signInWithEmail |
| 6–7 | Combobox preset / free text |
| 9 | success `form.reset()` |
| 10 | mobile flex `min-w-0` · button visible |

### shadcn 추가 설치

**없음** — Popover · Command · Button · Input 이미 설치됨.

### Backend-dev

**해당 없음** — FE-only · `signInWithEmail` API 변경 없음.

---

## 수정 이력

| 날짜 | 내용 |
|------|------|
| 2026-08-06 | D1–D4 목업 · 컴포넌트 트리 · FE handoff 초안 |
