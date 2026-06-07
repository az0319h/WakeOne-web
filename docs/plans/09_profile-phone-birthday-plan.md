# 프로필 연락처·생일 기획서

> Date: 2026-06-07  
> Status: Approved  
> Author: planner  
> **SQL:** `11` · `supabase/sql/11_profiles_phone_birthday.sql` (구현 시)  
> **선행:** [03](./03_user-lifecycle-profile-plan.md), [05](./05_profile-completion-plan.md), [06](./06_users-profile-modal-plan.md), [08](./08_activity-audit-log-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **03** | `/dashboard/profile` 세로 섹션(Profile·Account·Security) **유지** |
| **05** | 본인 PATCH `phone`·admin PUT 조직 필드 — **admin 타인 연락처 Out 유지** · 본 plan에서 phone 검증 강화·`birthday` 추가 |
| **06** | Users Dialog read-only 조회 · 테이블 **생일 컬럼 Out 유지** · Dialog에 생일·하이픈 연락처 **In** |
| **08** | CUD mutation Route **전 HTTP 분기** `recordActivityLog` — 기존 `profile.update` / `user.update` 재사용 |

---

## 한 줄 요약

연락처는 **11자리 숫자만** DB 저장·**`010-0000-0000` 하이픈 표시**로 통일하고, **생일(`date`)** 필드를 프로필(Calendar)과 admin Users Sheet에 추가한다. admin은 **생일만** 대리 설정 가능하며 연락처는 본인만 수정한다.

---

## 정책 확정안 (deep-interview · battle-plan)

| 항목 | 확정 |
|------|------|
| **연락처 필수** | **선택(nullable)** — 비우면 NULL |
| **연락처 저장** | DB·API: **숫자 11자리만** (`^\d{11}$`) · 값 있을 때만 검증 |
| **연락처 표시** | UI 전역 **`010-0000-0000` 하이픈 포맷** (테이블·Dialog·프로필) |
| **기존 잘못된 phone** | **그대로 표시** · 다음 저장 시 검증 · **일괄 NULL 마이그레이션 Out** |
| **admin 연락처** | 타 user **수정 Out** (plan 05 유지) · `PUT` body에 `phone` → **400 `forbidden_field`** |
| **생일 필수** | **선택(nullable)** |
| **생일 저장** | `profiles.birthday` **`date`** (타임존 없음, 날짜만) |
| **생일 연도 범위** | Calendar **1900-01-01 ~ 오늘** (미래 날짜 선택 불가) |
| **생일 권한** | **본인** `PATCH /api/profile` + **admin** `PUT /api/users/[id]` |
| **생일 UI** | shadcn **Calendar** + Popover DatePicker |
| **Users 테이블** | 생일 **컬럼 Out** · 연락처 셀은 하이픈 포맷 **In** |
| **activity log** | 신규 action **없음** — `profile.update` / `user.update` · `changed_fields`에 `phone`·`birthday` |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | 일반 user, `/dashboard/profile` Account | 연락처 `01012345678` 입력·저장 | 「프로필이 저장되었습니다.」 토스트 · 재방문 시 **`010-1234-5678`** 표시 |
| 2 | Playwright | 일반 user | 연락처 `010-123` 또는 10자리 등 저장 시도 | 클라이언트 또는 API **400** · 「입력값이 올바르지 않습니다.」(또는 동등) · 미저장 |
| 3 | Playwright | 일반 user | 연락처 비우고 저장 | `phone` NULL · 표시 「미설정」 또는 `—` |
| 4 | Playwright | 일반 user | 생일 Calendar에서 **어제** 선택·저장 | 프로필 Account에 **`yyyy년 M월 d일`**(또는 동등 로케일) 표시 · 재방문 유지 |
| 5 | Playwright | 일반 user | 생일 **미설정(clear)** 후 저장 | `birthday` NULL · 「미설정」 |
| 6 | Playwright | admin, Users **active** user B | 수정 Sheet에서 생일 설정·저장 | 「사용자 정보가 저장되었습니다.」 토스트 · B Dialog에 생일 read-only 반영 |
| 7 | Playwright | admin, user B | B 행 아바타 → Dialog | **생일** read-only 표시 · **연락처 하이픈** 형식 · 입력 필드 없음 |
| 8 | Playwright | admin, `/dashboard/users` | 테이블 확인 | **생일 컬럼 없음** · 연락처 열 **하이픈** 표시(값 있을 때) |
| 9 | Playwright | user 로그인 | 본인 프로필 PATCH 저장 성공 후 `/dashboard/logs` | 최신 행 Action **`profile.update`** · Status **2xx** · 행 확장 시 `changed_fields`에 **`phone` 또는 `birthday`** |
| 10 | Playwright | admin | B 생일 PUT 저장 성공 후 `/dashboard/logs` | **`user.update`** · `changed_fields`에 **`birthday`** |
| 11 | Playwright | admin | `PUT /api/users/[id]` body에 `phone` 포함 (또는 Sheet 우회) | **400** · `forbidden_field` · `/dashboard/logs`에 실패 행 기록 |
| 12 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 05 admin Sheet에 **이름·연락처 필드 없음** · plan 06 Dialog 가드(inactive·본인 행) · plan 08 기존 6 Route 로깅 패턴 **유지**.

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE → FE**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **DB `11`** | `birthday date` · `profiles_phone_format` CHECK (`NOT VALID` 권장) |
| B | **BE** | `PATCH /api/profile` — phone regex + `birthday` date Zod · select·`changed_fields` |
| C | **BE** | `PUT /api/users/[id]` — `birthday` only (인사) · `phone` DISALLOWED 유지 |
| D | **BE** | `session.server` · `GET /api/users` · `service.server` — `birthday` select |
| E | **FE util** | `src/lib/phone.ts` — `formatPhoneDisplay` · `parsePhoneDigits` · `PHONE_REGEX` |
| F | **FE profile** | `profile-form` phone mask · Birthday DatePicker(Calendar) |
| G | **FE users** | `UserFormSheet` / `user-edit-form-fields` admin 생일 · `user-profile-modal` read-only |
| H | **FE display** | `columns.tsx` phone 하이픈 · Dialog 생일·연락처 포맷 |
| I | **Activity** | 기존 Route `changed_fields`·validation 분기 확장 (신규 action 없음) |
| J | **검증** | Playwright AC #1~#11 · tsc · lint · build |

### Out of Scope

| 항목 | 비고 |
|------|------|
| admin 타 user **연락처** 대리 수정 | plan 05 Out **유지** |
| Users 테이블 **생일 컬럼** | 인터뷰 확정 Out |
| 기존 invalid `phone` **일괄 NULL** 마이그레이션 | 다음 저장 시만 검증 |
| 연락처·생일 **필수화** | nullable 유지 |
| `timestamptz`·timezone 보정 | `date`만 |
| 신규 activity **action** 코드 | `profile.update` / `user.update` 재사용 |
| 생일 알림·캘린더 연동·export | 후속 plan |
| plan 05/06 Out 항목 | 이미지 업로드·닉네임·목록 소속 컬럼 등 |

---

## DB (`supabase/sql/11_profiles_phone_birthday.sql`)

```sql
-- Plan: 09_profile-phone-birthday-plan.md
-- Date: 2026-06-07
-- Status: Approved

alter table public.profiles
  add column if not exists birthday date;

comment on column public.profiles.birthday is '생일 (날짜만, nullable)';

-- 기존 invalid phone 행이 있을 수 있으므로 NOT VALID로 추가 후 운영에서 정리
alter table public.profiles
  add constraint profiles_phone_format check (
    phone is null or phone ~ '^\d{11}$'
  ) not valid;

-- invalid row 정리 후 (선택): alter table public.profiles validate constraint profiles_phone_format;
```

| 컬럼/제약 | 규칙 |
|-----------|------|
| `birthday` | `date` nullable · 앱에서 1900-01-01 ≤ date ≤ 오늘 |
| `phone` CHECK | `null` 또는 정확히 11자리 숫자 · **1차 검증은 Zod(app)** · DB는 defense-in-depth |

---

## API

### `PATCH /api/profile` (본인)

```ts
z.object({
  first_name: z.string().max(100),
  last_name: z.string().max(100),
  phone: z
    .string()
    .regex(/^\d{11}$/, '연락처는 11자리 숫자만 입력할 수 있습니다.')
    .nullable()
    .optional(),
  food_restrictions: z.string().max(200).nullable().optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    // superRefine: 1900-01-01 ~ 오늘 (서버 date 기준)
});
```

- `PROFILE_SELECT_COLUMNS`에 `birthday` 추가
- `ADMIN_ONLY_PATCH_FIELDS`에 `birthday` **포함하지 않음** (본인 편집 허용)
- `changed_fields`: 요청 body에 포함된 `first_name` | `last_name` | `phone` | `food_restrictions` | `birthday`

### `PUT /api/users/[id]` (admin)

```ts
// updateUserSchema에 추가
birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
// 동일 date 범위 superRefine
```

- `DISALLOWED_PUT_FIELDS`: `first_name`, `last_name`, `phone`, `food_restrictions` — **유지**
- body에 `phone` 포함 시 **400** `forbidden_field` (기존 동작)
- inactive 대상 **400** 유지 (plan 03)

### GET select 확장

- `session.server.ts` · `GET /api/users` · `service.server.ts` — `birthday` 추가

---

## UI 요구사항

### `/dashboard/profile` — Account 섹션

| 필드 | UI |
|------|-----|
| **연락처** | `type="tel"` · 입력 시 **숫자만** · max 11 · 표시/placeholder `010-0000-0000` · submit 시 digits only |
| **생일** | `Popover` + `Calendar` `mode="single"` · `disabled: { after: today }` · fromYear **1900** · clear → NULL |
| **기존 invalid phone** | 폼 초기값: digits 추출 가능하면 마스크 적용, 아니면 raw → 저장 시 검증 에러 |

**패턴 참조:** `src/components/ui/table/data-table-date-filter.tsx` (Popover + Calendar)

**컴포넌트 분리:** `BirthdayField` 별도 파일 권장 — `AppField` render props 내 `useState` 금지 (core-conventions)

### admin — `UserFormSheet`

- cascade 조직 필드·아바타·역할 **유지**
- **생일** DatePicker 추가 (nullable · clear)
- **연락처 필드 없음** (plan 05 AC #6 회귀)

### Users — 표시

| 위치 | 변경 |
|------|------|
| **테이블 `phone` cell** | `formatPhoneDisplay(phone)` · null → `—` |
| **테이블 생일** | **컬럼 추가 없음** |
| **프로필 Dialog** | `ReadOnlyField` 생일 · 연락처 하이픈 · 미설정 「미설정」 muted |

### `src/lib/phone.ts` (신규)

```ts
export const PHONE_REGEX = /^\d{11}$/;
export function parsePhoneDigits(input: string): string; // 숫자만 추출, max 11
export function formatPhoneDisplay(phone: string | null): string | null; // 010-0000-0000
```

---

## 활동 감사 로그 (plan 08 · CUD In)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

### 기록 연동

| Route | HTTP | action | 변경 사항 |
|-------|------|--------|----------|
| `src/app/api/profile/route.ts` | PATCH | `profile.update` | phone/birthday validation·`changed_fields` 확장 · **전 분기** 유지 |
| `src/app/api/users/[id]/route.ts` | PUT | `user.update` | `birthday` in `changed_fields` · `phone` forbidden 400 로깅 유지 |

### return 분기 매트릭스 (`PATCH /api/profile`)

| 분기 | http_status | metadata `error_code` (실패 시) |
|------|-------------|-----------------------------------|
| unauthenticated | 401 | `unauthenticated` |
| forbidden admin field | 403 | `forbidden_field` |
| Zod validation (phone/birthday) | 400 | `validation` |
| DB error | 400 | `validation` |
| success | 200 | `changed_fields` (비어 있으면 `{}`) |
| catch | 500 | `internal_error` |

### return 분기 매트릭스 (`PUT /api/users/[id]` — birthday 관련)

| 분기 | http_status | metadata |
|------|-------------|----------|
| `phone` in body | 400 | `forbidden_field` |
| birthday Zod fail | 400 | `validation` |
| inactive user | 400 | `inactive_user` |
| success with birthday | 200 | `changed_fields: ['birthday', ...]` |

**민감 데이터:** metadata에 phone·생일 **값 자체 저장 금지** — `changed_fields` 필드명만.

---

## 영향 파일 & 패턴

| 파일 | 이유 |
|------|------|
| `supabase/sql/11_profiles_phone_birthday.sql` | 스키마 |
| `src/app/api/profile/route.ts` | 본인 PATCH |
| `src/app/api/users/[id]/route.ts` | admin PUT |
| `src/app/api/users/route.ts` | GET select |
| `src/features/auth/api/session.server.ts` | RSC 프로필 select |
| `src/features/users/api/service.server.ts` | Users list |
| `src/features/auth/api/types.ts` · `users/api/types.ts` | `birthday` 타입 |
| `src/features/auth/components/profile-form.tsx` | phone·birthday 폼 |
| `src/features/users/components/user-form-sheet.tsx` · `user-edit-form-fields.tsx` | admin 생일 |
| `src/features/users/components/user-profile-modal.tsx` | read-only |
| `src/features/users/components/users-table/columns.tsx` | phone 표시 |
| `src/features/users/schemas/user.ts` | `userUpdateSchema` |
| `src/lib/phone.ts` | 포맷 유틸 (신규) |

**패턴:** React Query `mutations.ts` `onSettled` invalidate · `recordActivityLog` (plan 08) · `useAppForm` + Zod

---

## 리스크 & 완화책

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | phone CHECK migration이 기존 invalid row로 실패 | `NOT VALID` · app Zod 1차 · 필요 시 `VALIDATE`는 데이터 정리 후 |
| 2 | HIGH | phone 마스크 state ↔ API digits 불일치 | `lib/phone.ts` 단일 소스 · submit 직전 `parsePhoneDigits` |
| 3 | MED | Calendar «오늘» 경계 timezone | `date` string만 저장 · disabled `after: new Date()` 로컬 |
| 4 | MED | TanStack Form + Popover 상태 | `BirthdayField` 컴포넌트 분리 |
| 5 | LOW | GET select 누락 | session·users route·service 일괄 갱신 체크리스트 |

---

## 구현 추정

- **범위:** ~15–18 파일 · ~350–500 LOC  
- **복잡도:** Medium  
- **예상:** ~90–120분 (BE+SQL → FE → verifier)

---

## 열린 질문

없음 (인터뷰·battle-plan에서 확정).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-07 | 최초 작성 (Approved) | planner |
