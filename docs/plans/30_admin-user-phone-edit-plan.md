# 관리자 사용자 연락처 필수 입력·수정 기획서

> Date: 2026-08-03
> Status: Approved
> Author: planner
> **SQL:** 해당 없음 (`profiles.phone` 재사용 · plan 09 SQL `11`)
> **선행:** [05](./05_profile-completion-plan.md), [09](./09_profile-phone-birthday-plan.md), [17](./17_user-management-add-flow-plan.md), [21](./21_user-profile-slim-migration-plan.md), [22](./22_users-table-birthday-edit-init-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [29](./29_profile-name-live-display-plan.md), [08](./08_activity-audit-log-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **05** | admin Users Sheet에서 이름·연락처 대리 수정 **Out** (초기) — 본 plan에서 **연락처만 In**으로 역전 |
| **09** | 연락처 11자리·하이픈 UI·`lib/phone.ts` — **형식 규칙 재사용** · admin PUT `phone` forbidden **본 plan에서 supersede** |
| **17** | 사용자 추가 필수값(이름·이메일·소속·직급·역할·생일) — **연락처 필수 추가** |
| **21** | 본인 PATCH 폐지(403) **유지** · admin 연락처 Out **본 plan에서 supersede** |
| **22** | Users 테이블·수정 Sheet 생일 — **회귀 유지** · create/update payload에 `phone` 추가 |
| **27** | `user.update` 인앱 알림 fan-out — **`phone`을 monitored 필드에 추가** |
| **29** | `full_name` live 표시 · PUT `target_label` bugfix — **회귀** · phone Realtime **Out** |
| **08** | `user.create`·`user.update` 전 HTTP 분기 `recordActivityLog` — **패턴 재사용** |

### Policy supersede (plan 09 · plan 21)

| 선행 plan | 기존 정책 | plan 30 변경 |
|-----------|-----------|--------------|
| **plan 09** | 연락처 **nullable** · admin 타 user `phone` PUT **400 forbidden_field** | admin create/update에서 **필수** · PUT **허용** |
| **plan 21** | 「admin 타 user **연락처 Out 유지**」 · 본인 PATCH 폐지 후 전원 read-only | admin Users Sheet/API **대리 입력·수정 In** · 본인 self-edit **Out 유지** |

plan 09 AC #6(admin Sheet 생일만)·#11(PUT phone forbidden)은 본 plan AC로 **대체**한다.

---

## 한 줄 요약

일반 user는 프로필 self-edit이 불가(plan 21)하므로, admin이 Users **추가·수정** Sheet와 `POST`/`PUT` API에서 **연락처를 필수**로 입력·저장할 수 있게 한다. plan 09 형식(11자리·하이픈 UI)을 유지하고, 수정 시 plan 27 인앱 알림·plan 08 activity log를 연동한다.

---

## 정책 확정안 (deep-interview · battle-plan · go)

| 항목 | 확정 |
|------|------|
| **연락처 저장** | DB·API: **숫자 11자리만** (`^\d{11}$`) · plan 09 `PHONE_REGEX` 재사용 |
| **연락처 표시** | UI 전역 **`010-0000-0000` 하이픈** (`formatPhoneDisplay`) |
| **admin 추가** | Users 추가 Sheet · `POST /api/users` — **phone 필수** · 빈값 제출 차단 |
| **admin 수정** | Users 수정 Sheet · `PUT /api/users/[id]` — **phone 필수** · 클리어(NULL) **불가** |
| **nullable** | admin CUD 경로에서 **nullable Out** · DB 컬럼은 nullable 유지(legacy READ) |
| **본인 프로필** | `/dashboard/profile` 연락처 **read-only** · `PATCH /api/profile` **403 유지** |
| **이메일** | 생성만 · **수정 Out** (Supabase Auth 별도) |
| **아바타 URL** | 수정 Sheet만 · **추가 Sheet Out** |
| **인앱 알림** | plan 27 — `phone` → `MONITORED_USER_UPDATE_FIELDS` + `FIELD_LABELS` |
| **activity log** | `user.create`·`user.update` · `changed_fields`에 `phone` (**값 metadata 금지**) |
| **레거시 NULL/invalid phone** | 일괄 backfill SQL **Out** — admin 수정 시 검증·입력으로 정리 |
| **DB NOT NULL migration** | **Out** — 앱 레이어 필수만 |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin, `/dashboard/users` **사용자 추가** Sheet | 연락처를 비우고 제출 | 연락처 필드 오류가 표시되고 사용자는 **생성되지 않는다** |
| 2 | Playwright | admin, 사용자 추가 Sheet | `01012345678` 포함 전 필수값 입력·제출 | 「사용자가 추가되었습니다.」 토스트 · Users 목록 연락처 **`010-1234-5678`** 표시 |
| 3 | Playwright | admin, active user B | **수정** Sheet에서 연락처를 비우고 저장 | 연락처 필드 오류 · **저장되지 않는다** |
| 4 | Playwright | admin, user B (연락처 있음) | 수정 Sheet에서 `01098765432`로 변경·저장 | 「사용자 정보가 저장되었습니다.」 토스트 · 목록·Dialog **`010-9876-5432`** 반영 |
| 5 | Playwright | admin, user B `phone` NULL (legacy) | 수정 Sheet 오픈 → 연락처 입력·저장 | 저장 성공 · 하이픈 형식으로 표시 |
| 6 | Playwright/API | admin | 연락처 `010-123` 또는 10자리 등 잘못된 형식 제출 | 클라이언트 또는 API **400** · 「입력값이 올바르지 않습니다.」(또는 동등) · 미저장 |
| 7 | API | admin | `POST /api/users` body에 `phone` **누락** | **400** · `user.create` **실패** log 1건 · `x-request-id` 헤더 |
| 8 | API | admin | `PUT /api/users/[id]` body에 `phone` **누락** | **400** · `user.update` **실패** log 1건 |
| 9 | API/로그 | admin | AC #4 PUT 성공 | `/dashboard/logs`(또는 activity-logs API) Action **`user.update`** · Status **2xx** · `changed_fields`에 **`phone`** (값 없음) |
| 10 | Playwright/API | user B 로그인, admin이 B 연락처 변경 | B `/dashboard/notifications` 확인 | 제목 **「프로필 정보가 변경되었습니다」** · body **「연락처이(가) 관리자에 의해 변경되었습니다」** |
| 11 | Playwright | 일반 user, `/dashboard/profile` Account | 페이지 확인 | 연락처 **read-only** · **「수정」버튼 없음** (plan 21 회귀) |
| 12 | API | 일반 user 로그인 | `PATCH /api/profile`에 `phone` 포함 | **403** · `profile_edit_disabled` · DB 미변경 |
| 13 | CLI | 구현 완료 | `bunx playwright test` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 21 본인 PATCH 403 · plan 22 생일 컬럼·Sheet · plan 27 알림 fan-out · plan 08 전 Route 로깅 · plan 29 `full_name` live 표시.

---

## E2E AC 매핑

| AC | spec 파일 (신규/수정) | 비고 |
|----|----------------------|------|
| #1–#2, #6 | `e2e/users/list.spec.ts` (또는 `e2e/users/admin-phone.spec.ts` **신규**) | 추가 Sheet 필수·하이픈 |
| #3–#5, #4 | `e2e/users/list.spec.ts` 또는 `admin-phone.spec.ts` | 수정 Sheet 필수·변경 |
| #6–#9 | `e2e/users/add-flow.api.spec.ts` · `e2e/users/admin-phone.api.spec.ts` (신규 권장) | POST/PUT validation · activity log |
| #10 | `e2e/users/admin-phone.spec.ts` 또는 notifications spec | user B 알림 |
| #11–#12 | `e2e/users/profile.spec.ts` | read-only · PATCH 403 회귀 |
| #13 | verifier CLI 게이트 | 전체 spec green |

**activity log:** UI E2E 아님 — AC #7–#9는 API로 `x-request-id`·action·`changed_fields` 검증 (plan 08).

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE → FE types/schemas → FE Sheet → Notifications → E2E**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **BE** | `POST /api/users` — `phone` 필수 Zod · profiles update |
| B | **BE** | `PUT /api/users/[id]` — `DISALLOWED_PUT_FIELDS`에서 `phone` 제거 · `updateUserSchema` 필수 |
| C | **FE schemas/types** | `createUserSchema`·`userUpdateSchema`·`CreateUserPayload`·`UserUpdatePayload` |
| D | **FE Sheet** | `FormPhoneField` in create+edit · `user-form-sheet` payload/defaultValues · SheetDescription |
| E | **Notifications** | `MONITORED_USER_UPDATE_FIELDS` + `FIELD_LABELS.phone` |
| F | **E2E/API** | AC #1–#13 spec · `createUserPayload` 헬퍼에 `phone` 추가 |
| G | **검증** | Playwright · tsc · lint · build |

### Out of Scope

| 항목 | 비고 |
|------|------|
| admin **이메일** 수정 | 생성만 · Auth `admin.updateUser` 별도 plan |
| **아바타 URL** 추가 Sheet | 수정 Sheet만 (기존) |
| 본인 프로필 self-edit 복원 | plan 21 `PATCH /api/profile` 403 유지 |
| DB `profiles.phone NOT NULL` migration | 앱 레이어 필수만 |
| 레거시 invalid phone **일괄 backfill** SQL | admin 수정 시 검증으로 정리 |
| phone 변경 Realtime NavUser refresh | plan 29는 `full_name`/`avatar_url`만 |
| DELETE UI 변경 | activity log DELETE AC 해당 없음 |

---

## DB

**해당 없음** — `profiles.phone` (`text`, nullable) · plan 09 SQL `11` · CHECK `profiles_phone_format` (`^\d{11}$` or null) 재사용.

| 항목 | 규칙 |
|------|------|
| **저장** | admin create/update 시 **11자리 숫자만** |
| **NULL** | legacy 행 READ 시 `—` · admin **수정 시 NULL 제출 불가** (앱 검증) |
| **NOT NULL** | DB 제약 추가 **Out** |

---

## API

### `POST /api/users` (admin·생성)

```ts
phone: z
  .string()
  .regex(/^\d{11}$/, '연락처는 11자리 숫자만 입력할 수 있습니다.')
```

- `createUserSchema`에 **필수** (nullable/optional **금지**)
- profiles update에 `phone` 포함
- plan 09 `PHONE_REGEX`·`refineBirthday`와 동일 superRefine 패턴

### `PUT /api/users/[id]` (admin·수정)

```ts
phone: z
  .string()
  .regex(/^\d{11}$/, '연락처는 11자리 숫자만 입력할 수 있습니다.')
```

- `DISALLOWED_PUT_FIELDS`에서 **`phone` 제거** (`food_restrictions`·`department`·`job_title` 유지)
- **필수** — body 누락 시 400
- inactive 대상 **400** 유지 (plan 03)
- success `metadata.changed_fields`에 `phone` 자연 포함

### `PATCH /api/profile` (본인) — **변경 없음**

- 모든 user **403** `profile_edit_disabled` (plan 21)

---

## UI 요구사항

### `/dashboard/users` — admin Sheet

| 화면 | 변경 |
|------|------|
| **추가 Sheet** | `FormPhoneField` **필수** · placeholder `010-0000-0000` · submit digits only |
| **수정 Sheet** | 동일 · DB 값 prefill (`parsePhoneDigits`) · legacy NULL/invalid → 빈 필드 + 입력 필수 |
| **SheetDescription** | 「연락처」 문구 추가 (create/edit) |

**패턴:** `src/features/auth/components/phone-field.tsx` · `FormPhoneField` · `user-form-sheet` SheetFooter 고정 (core-conventions)

### 표시 (변경 최소)

| 위치 | 내용 |
|------|------|
| Users 테이블 `phone` cell | `formatPhoneDisplay` · null `—` (기존) |
| 프로필 Dialog · `/dashboard/profile` | read-only · 하이픈 (기존) |

---

## 활동 감사 로그 (plan 08 · CUD In)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

### 기록 연동

| Route | HTTP | action | 변경 사항 |
|-------|------|--------|----------|
| `src/app/api/users/route.ts` | POST | `user.create` | `phone` 필수 validation · 전 분기 `jsonWithActivityLog` 유지 |
| `src/app/api/users/[id]/route.ts` | PUT | `user.update` | `phone` 허용 · success `changed_fields`에 `phone` |

### return 분기 매트릭스 (`POST /api/users` — phone)

| 분기 | http_status | metadata `error_code` |
|------|-------------|------------------------|
| unauthenticated | 401 | `unauthenticated` |
| forbidden (non-admin) | 403 | `forbidden` |
| `phone` missing / invalid | 400 | `validation` |
| duplicate email | 400 | `duplicate_email` |
| success | 201 | `{}` |
| catch | 500 | `internal_error` |

### return 분기 매트릭스 (`PUT /api/users/[id]` — phone)

| 분기 | http_status | metadata |
|------|-------------|----------|
| unauthenticated / forbidden | 401 / 403 | 동일 |
| `phone` missing / invalid | 400 | `validation` |
| inactive user | 400 | `inactive_user` |
| not found | 404 | `not_found` |
| success (phone 포함) | 200 | `changed_fields: [..., 'phone', ...]` |
| catch | 500 | `internal_error` |

**민감 데이터:** metadata에 연락처 **값 저장 금지** — `changed_fields` 필드명만.

**삭제 확인 Dialog:** 본 plan DELETE UI 변경 **없음**.

---

## 인앱 알림 (plan 27)

| 항목 | 내용 |
|------|------|
| **트리거** | admin `PUT /api/users/[id]` 성공 · `changed_fields`에 `phone` |
| **필드 등록** | `MONITORED_USER_UPDATE_FIELDS`에 `'phone'` · `FIELD_LABELS.phone = '연락처'` |
| **title** | `USER_UPDATE_NOTIFICATION_TITLE` 유지 — 「프로필 정보가 변경되었습니다」 |
| **body** | 「연락처이(가) 관리자에 의해 변경되었습니다」 |
| **민감** | body에 **전화번호 값 미포함** (plan 27 패턴) |

---

## 영향 파일 & 패턴

| 파일 | 작업 |
|------|------|
| `src/app/api/users/route.ts` | `createUserSchema` + profiles update `phone` |
| `src/app/api/users/[id]/route.ts` | `DISALLOWED_PUT_FIELDS` · `updateUserSchema` |
| `src/features/users/schemas/user.ts` | create/update Zod `phone` 필수 |
| `src/features/users/api/types.ts` | `CreateUserPayload`·`UserUpdatePayload` |
| `src/features/users/components/user-edit-form-fields.tsx` | `FormPhoneField` create+edit |
| `src/features/users/components/user-form-sheet.tsx` | defaultValues · payload · description |
| `src/features/notifications/api/labels.ts` | monitored fields + label |
| `src/features/auth/components/phone-field.tsx` | 재사용 (변경 최소) |
| `src/lib/phone.ts` | 재사용 |
| `e2e/users/add-flow.api.spec.ts` | payload·validation AC |
| `e2e/users/list.spec.ts` | Sheet UI AC (또는 `admin-phone.spec.ts` 신규) |
| `e2e/users/profile.spec.ts` | 회귀 AC #11–#12 |

**패턴:** `mutations.ts` `onSettled` invalidate · API Route 경유 CUD · `recordActivityLog` (plan 08) · `insertUserUpdateNotification` (plan 27)

---

## 리스크 & 완화책

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | legacy user `phone` NULL — 수정 Sheet 저장 불가 | AC #5 · admin이 연락처 입력 후 저장 |
| 2 | HIGH | legacy invalid phone — prefill/검증 실패 | `parsePhoneDigits` prefill · invalid면 빈값 + 재입력 · AC #6 |
| 3 | MED | plan 09 AC #11(phone forbidden) spec red | plan 30 AC로 **교체** |
| 4 | MED | PUT phone 필수 → 모든 수정 payload에 phone 포함 | edit form 항상 전송 |
| 5 | LOW | DB nullable vs 앱 필수 불일치 | NOT NULL migration Out · READ null `—` 유지 |

---

## 구현 추정

- **범위:** ~12–16 파일 · ~250–400 LOC · SQL 0
- **복잡도:** Medium
- **예상:** ~90–120분 (BE → FE → notifications → E2E)
- **Checkpoint:** BE POST/PUT + tsc (~40분)

---

## 구현 팀 전달 메모

### designer

- Users 추가/수정 Sheet에 **연락처 필드 필수** — `FormPhoneField` · plan 09 하이픈 placeholder.
- SheetDescription·필드 순서: 이름 → (이메일 create만) → **연락처** → 소속 cascade …
- legacy NULL user 수정 시 빈 연락처 + 필수 안내 copy.

### backend-dev

- `POST`/`PUT` schema를 **동시** 맞춤 · `DISALLOWED_PUT_FIELDS`에서 `phone`만 제거.
- `recordActivityLog` 전 분기 유지 · metadata에 phone **값 금지**.
- 신규 SQL **없음**.

### frontend-dev

- CUD는 `mutations.ts` 경유 · `onSettled` invalidate.
- edit Sheet **항상 phone** payload · 성공 시 `form.reset()` (core-conventions).
- `FormPhoneField` orphan → Users Sheet 연결.

### verifier

- AC #7–#9: API activity log (`x-request-id`·`changed_fields`).
- AC #10: user B notifications.
- AC #11–#12: profile self-edit 회귀.
- `bunx playwright test` · tsc · lint · build (AC #13).

---

## 열린 질문

없음 (deep-interview·battle-plan·`go` 확정).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-03 | 최초 작성 (Approved) — admin 연락처 필수 추가·수정 · plan 21/09 supersede · plan 27 알림 | planner |
