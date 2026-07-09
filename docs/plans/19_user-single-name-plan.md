# 사용자 이름 단일 필드 전환 기획서

> Date: 2026-07-09
> Status: Approved
> Author: planner
> **SQL:** `23` · `supabase/sql/23_profiles_full_name.sql` (구현 시)
> **선행:** [05](./05_profile-completion-plan.md), [06](./06_users-profile-modal-plan.md), [08](./08_activity-audit-log-plan.md), [17](./17_user-management-add-flow-plan.md) (모두 Approved/Completed)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **05** | 본인 PATCH 허용 필드에 `first_name`·`last_name` 포함, `ADMIN_ONLY_PATCH_FIELDS`(조직·아바타·역할) 패턴 확립 — 본 plan은 이름을 **동일한 관리자 전용 방어 패턴**으로 이동 |
| **06** | Users 프로필 조회 Dialog에 이름 표시(`first_name`+`last_name`) — 본 plan에서 `full_name` 단일 값으로 교체 |
| **17** | `POST /api/users` 필수값(이메일·소속·부서·직급·직책·시스템역할·생일)에 **이름 누락** — 본 plan에서 이름을 필수값으로 추가 (17의 갭 해소). `PUT /api/users/[id]`의 `DISALLOWED_PUT_FIELDS`가 현재 이름 수정을 **차단 중** — 본 plan에서 관리자 수정 허용으로 전환 |
| **08** | `user.create`·`user.update`·`profile.update` action·전 HTTP 분기 로깅 패턴 — 본 plan은 신규 action 추가 없이 `metadata.changed_fields`에 `full_name` 포함 |

**충돌 없음:** 04(재활성화)·07(라우트 가드)·09~16(계약서·비품 등)은 이름 필드 자체를 변경하지 않으며, 표시용으로 `first_name`/`last_name`을 조합해 쓰는 부수 기능(생일 배너·간식 정산·비품 대장 작성자명)만 영향을 받는다 (§영향 파일 참고).

---

## 한 줄 요약

`profiles.first_name`/`last_name` 2필드를 `full_name` 단일 필드로 통일한다. 관리자는 사용자 추가 시 이름을 **필수 입력**하고 Users 관리에서 다른 사용자의 이름을 **수정할 수 있다**. 일반(및 본인) 사용자는 자신의 프로필에서 이름을 **읽기 전용으로만** 확인하며, `PATCH /api/profile`로 이름 변경을 시도하면 **거부**된다.

---

## 정책 확정안

| 항목 | 확정 |
|------|------|
| **필드 통일** | `first_name`·`last_name` → `full_name` 단일 컬럼. 기존 두 컬럼은 **nullable로 전환**(deprecated), 앱 레이어는 더 이상 읽지도 쓰지도 않음 |
| **관리자 사용자 추가** | `POST /api/users` — `full_name` **필수**(trim 후 1~100자) |
| **관리자 사용자 수정** | `PUT /api/users/[id]` — `full_name` **수정 허용**(선택적 업데이트, 값 제공 시 1~100자 검증) |
| **본인 프로필** | `/dashboard/profile`에서 이름 **read-only 표시**로 전환 (기존 `FormTextField` 2개 제거) |
| **본인 PATCH 방어** | `PATCH /api/profile` — `full_name`을 관리자 전용 차단 필드 목록으로 이동. 본인이 전송 시 **403 `forbidden_field`** (기존 `avatar_url`·`affiliation` 등과 동일 패턴, admin 계정 본인도 예외 없음) |
| **표시 로직** | `getProfileDisplayName`·`formatActorDisplayName`·아바타 이니셜 등 전 헬퍼가 `full_name` 단일 값을 사용하도록 변경. 이름 미설정 시 이메일로 fallback(기존 패턴 유지) |
| **DB 마이그레이션** | `full_name` 컬럼 추가 → `first_name || ' ' || last_name` trim 결과로 backfill(빈 값이면 email fallback) → `full_name NOT NULL` 설정 → `first_name`/`last_name` `NOT NULL` 해제(구현팀이 완전 제거 여부는 후속 plan에서 결정 가능하나, 본 plan에서는 **앱 레이어 참조 제거 + 컬럼 nullable 전환**까지 완료) |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin, `/dashboard/users` 사용자 추가 Sheet 오픈 | 이름을 비우고 나머지 필수값(이메일·소속·부서·직급·직책·시스템역할·생일) 입력 후 제출 | 이름 필드에 오류가 표시되고 사용자는 생성되지 않는다 |
| 2 | Playwright | admin, 사용자 추가 Sheet | 이름 `홍길동` 포함 전체 필수값 입력 후 제출 | 성공 토스트 · Users 목록에 이름 `홍길동`으로 신규 사용자가 새로고침 없이 표시된다 |
| 3 | Playwright | 일반 user, `/dashboard/profile` | Profile/Account 섹션 확인 | 이름이 **읽기 전용 텍스트**로 표시되고, 이름을 입력할 수 있는 필드(input)가 **없다** |
| 4 | API | 일반 user 로그인 세션 | `PATCH /api/profile`에 `full_name` 필드를 포함해 요청 | **403** 응답, `message`에 「해당 필드는 수정할 수 없습니다.」류 문구, DB의 `full_name` **변경되지 않음** |
| 5 | API | admin 로그인 세션(관리자 본인 계정 포함) | `PATCH /api/profile`에 `full_name` 포함 요청 | 동일하게 **403** — 관리자도 본인 PATCH 경로로는 이름 변경 불가 |
| 6 | Playwright | admin, Users 목록에서 active user B(현재 이름 `김철수`) | B 아바타 클릭 → 「조직 정보 수정」 → 이름을 `김철수2`로 변경 후 저장 | 성공 토스트 · Users 목록·프로필 Dialog에 `김철수2` 반영 (새로고침 없음) |
| 7 | Playwright | admin, Users 목록 | 이름 컬럼·프로필 Dialog 헤더·아바타 이니셜 확인 | 모두 `full_name` 기준으로 정상 표시(이니셜은 성/이름 대신 `full_name` 앞 1~2글자 또는 기존 규칙 유지) |
| 8 | API/DB | 마이그레이션 적용 후 기존(마이그레이션 전 생성) 사용자 | `GET /api/users` 또는 `/dashboard/profile` 조회 | `full_name`이 과거 `first_name`+`last_name` 조합(trim) 값으로 정상 표시된다 (데이터 손실 없음) |
| 9 | Playwright | admin, 생일 배너(`birthday-celebrants`)·간식 정산(`office-snacks`)·비품 대장(`asset-ledger`) 중 이름 표시 화면 | 화면 진입 | 사용자 이름이 `full_name` 기준으로 정상 표시된다 (회귀 확인, 빈 이름·undefined 깨짐 없음) |
| 10 | API/로그 | admin | 사용자 추가(AC #2) 성공 | `activity_logs`에 `user.create` 1건, `metadata`에 비밀번호 등 민감정보 없음 |
| 11 | API/로그 | admin | 사용자 이름 수정(AC #6) 성공 | `activity_logs`에 `user.update` 1건, `metadata.changed_fields`에 `full_name` 포함 |
| 12 | API/로그 | 일반 user | AC #4의 거부된 PATCH 시도 | `activity_logs`에 `profile.update` 실패 로그 1건, `metadata.error_code = 'forbidden_field'`, `changed_fields`에 `full_name` 포함, 비밀번호류 값 없음 |
| 13 | CLI | 구현 완료 후 | `bunx playwright test` | 본 plan AC 기반 spec 모두 통과 |
| 14 | CLI | 구현 완료 후 | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 (`first_name`/`last_name` 참조 잔존 시 타입 에러로 드러나야 함) |

---

## 범위 (In / Out)

### In Scope (구현 순서: **DB → BE → FE → 검증**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | DB | SQL `23` — `full_name` 추가·backfill·`NOT NULL`, `first_name`/`last_name` `NOT NULL` 해제 |
| B | BE — 생성 | `POST /api/users` `createUserSchema`에 `full_name` 필수(1~100자) 추가, insert 반영 |
| C | BE — 수정 | `PUT /api/users/[id]` `DISALLOWED_PUT_FIELDS`에서 이름 제거, `updateUserSchema`에 `full_name` optional(1~100자) 추가 |
| D | BE — 본인 방어 | `PATCH /api/profile` — `PROFILE_PATCH_FIELDS`에서 이름 제거, `ADMIN_ONLY_PATCH_FIELDS`에 `full_name` 추가(admin 본인 포함 차단) |
| E | BE — select/타입 | `session.server.ts`·`users/api/service.server.ts`(GET select)·`AuthProfile`·`User` 타입을 `full_name` 기준으로 변경 |
| F | BE — 표시 헬퍼 | `getProfileDisplayName`·`formatActorDisplayName`·`fetchUserTargetLabel`(log.server.ts) `full_name` 기준 재작성 |
| G | BE — 부수 기능 select | `birthday-celebrants`·`office-snacks`·`asset-ledger`의 `first_name, last_name` select·표시 로직을 `full_name`으로 교체 |
| H | FE — 프로필(본인) | `profile-edit-sheet.tsx`에서 이름 입력 필드 제거, `profile-account-read-only.tsx`(또는 read-only 블록)에 이름 read-only 표시 추가, `profileSchema`에서 이름 필드 제거 |
| I | FE — Users 추가/수정 | `user-edit-form-fields.tsx`에 이름 `FormTextField` 추가(생성 필수, 수정 선택), `schemas/user.ts`(`createUserSchema`·`userUpdateSchema`) 반영 |
| J | FE — 표시 | `columns.tsx`·`user-profile-modal.tsx`·`profile-display.tsx`(`getInitials`·`ProfileAvatar`)를 `full_name` 기준으로 교체 |
| K | 전역 grep | `src/`·`supabase/sql/` 전체에서 `first_name`\|`last_name` 잔존 참조 재확인(§영향 파일의 목록은 기획 시점 스냅샷 — 구현 시 재grep 필수) |
| L | 검증 | Playwright AC #1~#9 · API/로그 AC #10~#12 · tsc·lint·build (AC #13~#14) |

### Out of Scope

| 항목 | 비고 |
|------|------|
| 성·이름 분리 UI(영문 성명 등) 재도입 | 단일 필드로 확정, 후속 요구 시 별도 plan |
| `first_name`/`last_name` 컬럼 완전 DROP | 본 plan은 nullable 전환까지. 완전 제거는 데이터 검증 기간을 둔 후속 plan에서 결정 |
| 신규 activity log action 코드 추가 | `user.create`·`user.update`·`profile.update` 기존 action 재사용(§활동 감사 로그) |
| 계약서 관리(`contract-management`) 내 서명자명 등 별도 자유입력 텍스트 필드 | `profiles.full_name`과 무관한 자유 텍스트는 본 plan 대상 아님 |
| 이름 중복·특수문자 정책(닉네임 금칙어 등) | 최대 100자 제한만 적용, 별도 정책 없음 |
| 마이그레이션 후 기존 빈 이름(`first_name=''`) 계정에 대한 관리자 알림/강제 입력 유도 | 관리자가 Users 수정에서 임의 시점에 채우는 것으로 충분 |
| `src/constants/mock-api-users.ts` 등 in-memory 데모 mock | 데모·mock API 경로 Out — 본 plan 범위 아님 |
| E2E·검증 중 생성된 원격 목 데이터 정리 | 전역 verifier Step 7 (`e2e-remote-cleanup`)에서 처리 — 본 plan AC·영향 파일에 포함하지 않음 |

---

## DB (`supabase/sql/23_profiles_full_name.sql`)

```sql
-- Plan: 19_user-single-name-plan.md
-- Date: 2026-07-09
-- Status: Approved

alter table public.profiles
  add column if not exists full_name text;

update public.profiles
set full_name = trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
where full_name is null;

update public.profiles
set full_name = email
where full_name is null or btrim(full_name) = '';

alter table public.profiles
  add constraint profiles_full_name_length check (char_length(full_name) <= 100);

alter table public.profiles
  alter column full_name set not null;

alter table public.profiles
  alter column first_name drop not null,
  alter column last_name drop not null;

comment on column public.profiles.full_name is '사용자 이름(단일 필드). first_name/last_name은 deprecated — 앱 레이어 미참조, 후속 plan에서 DROP 검토';
comment on column public.profiles.first_name is 'deprecated — full_name으로 대체. 앱 레이어 참조 금지';
comment on column public.profiles.last_name is 'deprecated — full_name으로 대체. 앱 레이어 참조 금지';
```

- `handle_new_user()`·`ensure_profile_for_user()`(SQL `02`/`04`) — 신규 계정 자동 생성 시 `first_name`/`last_name` insert 인자를 제거하거나 빈 문자열 유지(nullable이므로 무해). `full_name`은 관리자 생성 플로우(`POST /api/users`)에서 별도 `update`로 채워지므로 트리거 자체는 수정 필수는 아니나, 트리거가 `first_name`/`last_name`에 값을 강제하지 않도록 확인.
- RLS는 plan 01 정책(본인 또는 admin) 그대로 — 컬럼 추가만으로 정책 변경 불필요.

---

## API

### `POST /api/users` (admin·생성) — `createUserSchema`

```ts
z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
  full_name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100),
  affiliation: z.enum(AFFILIATIONS),
  department: z.string().trim().min(1).max(100),
  rank: z.string().trim().min(1).max(50),
  job_title: z.string().trim().min(1).max(50),
  system_role: z.enum(['admin', 'user']),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
```

- 생성 시 `profiles.update({ ...payload, full_name })`에 `full_name` 포함.
- 실패(400 validation) 시 `validation_errors`에 `full_name` 필드명 포함 가능(값은 미포함 — 기존 allowlist 패턴).

### `PUT /api/users/[id]` (admin·수정) — `updateUserSchema`

```ts
z.object({
  full_name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100).optional(),
  avatar_url: z.string().url().max(2048).nullable().optional(),
  affiliation: z.enum(AFFILIATIONS).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  rank: z.string().max(50).nullable().optional(),
  job_title: z.string().max(50).nullable().optional(),
  system_role: z.enum(['admin', 'user']).optional(),
  birthday: birthdaySchema
});
```

- `DISALLOWED_PUT_FIELDS`에서 이름 관련 항목 제거(`phone`·`food_restrictions`는 계속 차단 — 본 plan 범위 아님).
- `metadata.changed_fields`에 `full_name` 자연 포함(기존 `Object.keys(updates)` 로직 재사용).

### `PATCH /api/profile` (본인)

```ts
const PROFILE_PATCH_FIELDS = ['phone', 'food_restrictions', 'birthday'] as const; // full_name 제거

const ADMIN_ONLY_PATCH_FIELDS = [
  'full_name',
  'avatar_url',
  'affiliation',
  'department',
  'rank',
  'job_title',
  'system_role'
] as const;

const patchProfileSchema = z.object({
  phone: z.string().regex(/^\d{11}$/, '...').nullable().optional(),
  food_restrictions: z.string().max(200).nullable().optional(),
  birthday: birthdaySchema
}); // first_name/last_name 필드 제거
```

- 본인이 `full_name`을 body에 포함하면 기존 `forbiddenFields` 분기(403, `error_code: 'forbidden_field'`, `changed_fields: ['full_name']`)로 처리 — **admin 계정도 예외 없음** (AC #5).
- 응답 message는 기존 문구(「해당 필드는 수정할 수 없습니다.」) 재사용.

---

## UI

### `/dashboard/users` — 사용자 추가/수정 Sheet

- `UserCreateFormFields`: 최상단에 이름 `FormTextField`(필수, placeholder `이름`) 추가.
- `UserEditFormFields`: 이름 `FormTextField`(선택, 기존 값 prefill) 추가 — 아바타 URL 필드 앞 또는 뒤 배치(디자인 톤 유지, `designer` 산출물에서 최종 위치 확정 가능).
- Sheet `SheetDescription`(수정 모드) 문구에 "이름" 추가: 「이름·아바타 URL·소속·부서·직급·직책·시스템 역할·생일을 수정합니다.」

### `/dashboard/profile` — 본인 프로필

- `profile-edit-sheet.tsx`: 이름 `FormTextField` 2개(이름/성) **제거**. `profileSchema`도 `first_name`/`last_name` 제거.
- Account 섹션(또는 read-only 블록)에 이름 `ReadOnlyField` 추가 — plan 05의 조직 필드 read-only와 동일 패턴("미설정" muted 규칙 재사용, 단 관리자가 이름을 필수로 넣으므로 실제 미설정 케이스는 마이그레이션 이전 레거시 빈 값에만 해당).

### Users 목록/프로필 모달/아바타

- `columns.tsx`: `name` 컬럼 `accessorFn`을 `row.full_name`으로 변경, 셀 표시도 단일 값.
- `user-profile-modal.tsx`: `fullName` 계산을 `user.full_name`으로 단순화, `aria-label`도 동일.
- `profile-display.tsx`: `ProfileNameFields`를 `{ full_name: string; email: string }`로 변경, `getInitials`는 `full_name`을 공백 기준 분리해 앞 1~2글자 이니셜 추출(또는 첫 글자만 — FE 구현 선택, AC #7 기준만 충족하면 됨).

---

## 활동 감사 로그 (CUD In — 신규 action 없음)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md) 패턴 재사용

| Route | action | 변경 | return 분기 |
|-------|--------|------|-------------|
| `POST /api/users` | `user.create`(기존) | body에 `full_name` 포함, 실패 시 `validation_errors`에 `full_name` 필드명 가능 | 401·403·400 validation·400 duplicate·201·500 (기존 매트릭스 동일, 신규 분기 없음) |
| `PUT /api/users/[id]` | `user.update`(기존) | `metadata.changed_fields`에 `full_name` 자연 포함 | 401·403·400·404·200·500 (동일) |
| `PATCH /api/profile` | `profile.update`(기존) | 본인이 `full_name` 시도 시 **403 `forbidden_field`**, `changed_fields: ['full_name']` | 401·403(신규 forbidden 케이스 포함)·400·200·500 |

- 신규 action 코드 추가하지 않음 — 기존 3개 action 재사용.
- `metadata`에 이름 **값 자체**는 저장하지 않음(민감 정보는 아니나 기존 allowlist 관례상 `changed_fields`는 필드명만).
- AC #10~#12로 검증(API 기반, UI E2E 아님 — core-conventions 원칙 준수).

---

## 영향 파일 & 패턴 (기획 시점 grep 스냅샷 — 구현 시 재확인 필수)

| 경로 | 작업 |
|------|------|
| `supabase/sql/23_profiles_full_name.sql` | **신규** |
| `supabase/sql/02_auth_user_auto_profile.sql`, `04_profiles_only_cleanup.sql` | 참고만(트리거 수정은 선택, nullable 전환으로 무해) |
| `src/app/api/users/route.ts` | `createUserSchema`에 `full_name` 필수, insert 반영 |
| `src/app/api/users/[id]/route.ts` | `DISALLOWED_PUT_FIELDS`·`updateUserSchema`에 `full_name` |
| `src/app/api/profile/route.ts` | `PROFILE_PATCH_FIELDS`·`ADMIN_ONLY_PATCH_FIELDS`·`patchProfileSchema`·`profileTargetLabel` |
| `src/features/auth/api/session.server.ts` | `PROFILE_COLUMNS` select |
| `src/features/auth/api/types.ts` | `AuthProfile.full_name` (first_name/last_name 제거) |
| `src/features/auth/schemas/profile.ts` | `profileSchema`에서 이름 필드 제거 |
| `src/features/auth/lib/display-name.ts` | `getProfileDisplayName` → `full_name` 기준 |
| `src/features/auth/components/profile-edit-sheet.tsx` | 이름 입력 제거 |
| `src/features/auth/components/profile-account-read-only.tsx` | 이름 read-only 추가 |
| `src/features/auth/components/profile-display.tsx` | `ProfileNameFields`·`getInitials`·`ProfileAvatar` |
| `src/features/users/api/types.ts` | `User.full_name`, `CreateUserPayload.full_name`, `UserUpdatePayload.full_name?` |
| `src/features/users/api/service.server.ts` | GET select·매핑·검색(`search` ilike 대상 `full_name`) |
| `src/features/users/schemas/user.ts` | `createUserSchema`·`userUpdateSchema`에 `full_name` |
| `src/features/users/components/user-edit-form-fields.tsx` | 이름 `FormTextField` 추가(생성 필수/수정 선택) |
| `src/features/users/components/user-form-sheet.tsx` | `defaultValues`·payload에 `full_name` |
| `src/features/users/components/users-table/columns.tsx` | `name` 컬럼 `full_name` 기준 |
| `src/features/users/components/user-profile-modal.tsx` | `fullName`·`aria-label` |
| `src/features/activity-logs/api/log.server.ts` | `formatActorDisplayName`·`fetchUserTargetLabel` select·조합 로직 |
| `src/features/birthday-celebrants/api/types.ts`, `api/service.server.ts` | select·정렬(`localeCompare`) `full_name` 기준으로 단순화 |
| `src/features/birthday-celebrants/components/birthday-celebrants-banner.tsx`, `birthday-celebration-slide.tsx` | prop `firstName`/`lastName` → `fullName` (컴포넌트 내부 표시 로직 조정) |
| `src/features/office-snacks/api/service.server.ts` | select·`fullName` 조합 로직 단순화 |
| `src/features/asset-ledger/api/service.server.ts` | `toDisplayName` 호출부·select 컬럼 |
| `src/features/users/components/users-table/columns.tsx`(검색 meta) | 검색 placeholder·컬럼 라벨 텍스트는 유지, 데이터 접근자만 변경 |

**구현 시 필수:** `rg "first_name|last_name" src supabase/sql`로 재grep해 위 목록 외 잔존 참조(특히 `src/features/contract-management/**`, 신규 추가 파일)를 전부 확인하고 처리한다. 본 목록에 없는 파일에서 발견되면 동일 원칙(`full_name` 단일 값, read-only/관리자 전용 방어 구분)으로 처리한다.

---

## 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | HIGH — `first_name`/`last_name` 참조 30여 곳 중 누락 시 런타임 `undefined` 또는 깨진 표시 | AC #14(tsc)로 타입 불일치 강제 검출 · §영향 파일 grep 재확인을 backend-dev/frontend-dev 완료 조건에 포함 |
| 2 | HIGH — 마이그레이션 시점 빈 이름 계정(`first_name=''`) → `full_name` backfill이 빈 문자열이 될 위험 | SQL에서 backfill 후 빈 값이면 `email`로 2차 fallback(§DB) |
| 3 | MED — 관리자 본인이 PATCH로 이름 변경 시도 시 예외 처리 누락(본인도 admin 전용 필드 차단 대상) | AC #5로 admin 본인 케이스 명시 검증 |
| 4 | MED — 검색(`GET /api/users` search ilike)이 기존 `first_name.ilike,last_name.ilike` 조합 전제 | `full_name.ilike` 단일 조건으로 교체, AC #2(신규 생성 사용자 목록 노출) 회귀로 간접 확인 |
| 5 | LOW — 이니셜(Avatar Fallback) 로직이 성/이름 첫 글자 조합 전제 | `full_name` 공백 분리 또는 첫 글자만 사용하는 방식으로 FE 재구현(AC #7) |

---

## 추정

| 항목 | 값 |
|------|-----|
| 복잡도 | **Medium** (스키마 변경은 단순하나 참조 파일 수가 많음) |
| SQL | 1 파일 |
| BE | 3 Route(users POST/PUT, profile PATCH) + select/헬퍼 5곳 + 부수 기능 3곳 |
| FE | Users 폼 2곳, 본인 프로필 2곳, 표시 헬퍼 2곳 |
| verifier | Playwright ~9 AC + API/로그 3건 |
| 예상 시간 | **~2.5–3.5시간** |

---

## 열린 질문

| ID | 항목 | 결정 |
|----|------|------|
| Q1 | `first_name`/`last_name` 컬럼 완전 DROP 시점 | **Out** — nullable 전환만 본 plan, 완전 제거는 후속 plan(데이터 검증 기간 확보 후) |
| Q2 | 이니셜(Avatar Fallback) 추출 규칙 | FE 구현 선택 — `full_name` 공백 분리 앞 1~2글자 또는 첫 글자만(AC #7 충족 기준) |
| Q3 | 관리자 사용자 수정 Sheet 내 이름 필드 위치 | designer 산출물에서 최종 확정 — 아바타 URL 인접 배치 권장 |

---

## 구현 팀 전달 메모

### backend-dev

- SQL `23` 적용 후 `createUserSchema`(필수)·`updateUserSchema`(선택)·`patchProfileSchema`(제거) 3곳을 **한 번에** 맞춰야 타입 불일치가 안 생긴다.
- `PATCH /api/profile`의 `ADMIN_ONLY_PATCH_FIELDS`에 `full_name`을 추가할 때 기존 403 분기·`buildErrorMetadata('forbidden_field', ...)` 로직을 그대로 재사용한다(신규 분기 코드 추가 불필요).
- `log.server.ts`의 `formatActorDisplayName`·`fetchUserTargetLabel`을 가장 먼저 고쳐야 다른 Route의 activity log 표시가 깨지지 않는다.
- `rg "first_name|last_name" src supabase/sql` 재grep으로 §영향 파일 외 잔존 참조를 반드시 확인한다.

### frontend-dev

- `UserFormSheet`의 생성/수정 defaultValues·payload 매핑에서 `full_name` trim 처리(공백만 입력 방지)를 잊지 않는다.
- 본인 프로필 폼(`profile-edit-sheet.tsx`)에서 이름 필드 제거 시 `profileSchema`도 함께 수정해야 tsc 통과.
- CUD는 기존 `mutations.ts`(`createUserMutation`/`updateUserMutation`/`patchProfileMutation`)를 그대로 사용 — 신규 mutation 불필요.
- Users 목록 검색 placeholder("사용자 검색…")는 유지, 데이터 접근자만 `full_name`.

### verifier

- AC #4·#5(PATCH 거부)는 UI E2E가 아니라 API 요청으로 403·`error_code`를 직접 검증한다.
- AC #9(생일 배너·간식·비품 대장 회귀)는 각 화면에 실제 진입해 이름이 깨지지 않는지 스크린샷/스냅샷으로 확인한다.
- tsc(AC #14)가 `first_name`/`last_name` 잔존 참조를 잡아내는 핵심 게이트이므로 가장 먼저 실행한다.
- Playwright·API 검증으로 생성된 `@example.com` 등 원격 목 데이터는 **본 plan AC가 아님** — verifier Step 7(`e2e-remote-cleanup`)에서 검증 통과 후 자동 삭제한다.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-07-09 | 최초 작성(Approved) — `full_name` 단일 필드 전환, 관리자 필수 입력·수정 허용, 본인 read-only·PATCH 방어, activity log 기존 action 재사용 | planner |
| 2026-07-09 | mock·E2E 목 데이터 정리 — `mock-api-users.ts` 영향/리스크 제거, Out에 mock·원격 cleanup 위임 명시 | root |
