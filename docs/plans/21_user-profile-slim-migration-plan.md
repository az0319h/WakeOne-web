# 사용자 프로필 슬림 마이그레이션 기획서

> Date: 2026-07-10
> Status: Approved
> Author: planner
> **SQL:** `27` · `supabase/sql/27_profiles_slim_drop_fields.sql` (구현 시)
> **선행:** [03](./03_user-lifecycle-profile-plan.md), [05](./05_profile-completion-plan.md), [08](./08_activity-audit-log-plan.md), [09](./09_profile-phone-birthday-plan.md), [10](./10_dashboard-birthday-profile-sheet-plan.md), [15](./15_asset-ledger-plan.md), [17](./17_user-management-add-flow-plan.md), [19](./19_user-single-name-plan.md)

## 선행 plan 참조

| Plan | 관계 |
|------|------|
| **03** | Security(비밀번호 변경 Sheet·로그아웃) **유지** · inactive 가드·본인 비활성화 방지 **유지** |
| **05** | 조직 cascade 4단·`food_restrictions` 본인 PATCH·부서/직책 admin 전용 — **본 plan에서 3필드 제거·본인 PATCH 전면 폐지** |
| **08** | `user.create`·`user.update`·`profile.update` 전 HTTP 분기 `recordActivityLog` 패턴 재사용 |
| **09** | 연락처 11자리·생일 Calendar — 본인 PATCH **폐지**로 phone/birthday self-edit **철회** · admin PUT 생일 수정 **유지** |
| **10** | Account 「수정」Sheet·`profile.update` 본인 CUD — **본 plan에서 Account read-only로 철회** (Security는 유지) |
| **15** | 비품 `usage_location` = `profiles.department` 동적 집계 — **본 plan에서 고정 목록+자산 union으로 전환** |
| **17** | 사용자 추가 필수: 부서·직책·생일 — **부서·직책 필수 제거**, 소속+직급+생일(POST 필수)로 변경 |
| **19** | `full_name` 관리자 전용·본인 read-only — **유지** |

**충돌 해소:** plan 05·09·10·17의 본인 프로필 수정·부서/직책 필수 정책은 본 plan이 **우선**한다.

---

## 한 줄 요약

Flex HR 정합에 맞게 사용자 프로필을 **소속(`affiliation`) + 직급(`rank`)** 중심으로 슬림화하고, `department`·`job_title`·`food_restrictions`를 UI·API·DB에서 제거한다. 일반 user의 프로필 필드 self-edit을 전면 금지하고(비밀번호 변경·로그아웃만 유지), admin만 Users 관리에서 수정한다. 비품 대장 `usage_location`은 `profiles.department` 의존을 끊고 고정 목록으로 전환한다.

---

## 정책 확정안

| 항목 | 확정 |
|------|------|
| **조직 필드** | **소속 + 직급만** 유지. `department`·`job_title` UI·API·타입·SELECT **제거** |
| **제거 필드 DB** | `profiles.department`·`job_title`·`food_restrictions` — SQL `27`로 **DROP**(데이터 영구 삭제) |
| **일반 user 프로필** | Account **read-only 전용** — 「수정」버튼·`ProfileEditSheet`·`PATCH /api/profile` 본인 경로 **폐지** |
| **Security** | plan 03 — 비밀번호 변경 Sheet·로그아웃 **유지** (`PATCH /api/profile/password` 별도) |
| **admin 수정** | Users Sheet/Dialog에서만 — `PUT /api/users/[id]` |
| **이름** | plan 19 — `full_name` 관리자 전용, 본인 read-only **유지** |
| **연락처** | plan 09 — admin 타 user 연락처 수정 **Out 유지** · 본인 PATCH 폐지 후 **전원 read-only** |
| **생일 POST** | 사용자 **추가(생성) 시 필수** — Calendar DatePicker, 빈값 제출 차단 |
| **생일 PUT** | admin **수정 허용**(optional) · 일반 user **수정 불가** |
| **레거시 NULL 생일** | 일괄 migration **없음** — admin이 Users 수정에서 개별 보완 |
| **소속** | `wake`·`sans`·`sans_foundry` **유지** (`flex` 소속 신설 **Out**) |
| **직급 enum** | `RANK_BY_AFFILIATION` **확장**(Flex HR 직급 반영) |
| **Flex bulk import** | 30명 일괄 반영 **Out** — 수동 admin 추가 또는 후속 plan |
| **activity log** | `user.create`·`user.update`·`profile.update`(403 거부) — 신규 action **없음** |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin, `/dashboard/users` 사용자 추가 Sheet | 이름·이메일·소속·직급·시스템역할·생일 입력 후 제출 | 성공 토스트 · Users 목록에 신규 사용자가 새로고침 없이 표시된다 |
| 2 | Playwright | admin, 사용자 추가 Sheet | 생일을 비우고 제출 | 생일 필드 오류가 표시되고 사용자는 생성되지 않는다 |
| 3 | Playwright | admin, 사용자 추가 Sheet | 폼 필드 확인 | **부서·직책·못 먹는 음식** 입력 필드가 **없다** |
| 4 | Playwright | 일반 user, `/dashboard/profile` Account 섹션 | 페이지 확인 | **「수정」버튼이 없다** · 연락처·생일이 read-only로 표시된다 |
| 5 | Playwright | 일반 user, `/dashboard/profile` Security 섹션 | 비밀번호 변경·로그아웃 확인 | 비밀번호 변경 Sheet·로그아웃 버튼이 **정상 동작**한다 (plan 03 회귀) |
| 6 | API | 일반 user 로그인 세션 | `PATCH /api/profile`에 `phone` 또는 `birthday` 포함 요청 | **403** 응답 · DB 미변경 · `activity_logs`에 `profile.update` **실패** 로그 1건 · `metadata.error_code`에 거부 코드 포함 |
| 7 | Playwright | admin, Users 목록 active user B | 수정 Sheet에서 직급·생일 변경 후 저장 | 「사용자 정보가 저장되었습니다.」 토스트 · 목록·Dialog에 반영 · `user.update` 성공 로그 |
| 8 | Playwright | admin, birthday가 NULL인 active user B | Users 수정 Sheet에서 생일만 설정 후 저장 | 생일이 반영되고 PUT이 성공한다 |
| 9 | Playwright | admin, Users 프로필 Dialog | 조직·계정 정보 확인 | **소속·직급만** 표시 · 부서·직책·못 먹는 음식 필드가 **없다** |
| 10 | Playwright | wake user, `/dashboard/product` 비품 등록 Sheet | 사용처 Select 열기·값 선택 후 저장 | 사용처 옵션이 표시되고 저장에 성공한다 · `profiles.department`에 **의존하지 않는다** |
| 11 | API | admin 로그인 세션 | `POST /api/users` body에 `department` 또는 `job_title` 포함 | **400** validation · `user.create` **실패** 로그 1건 |
| 12 | API/DB | SQL `27` 원격 적용 후 | `profiles` 스키마 조회 | `department`·`job_title`·`food_restrictions` 컬럼이 **존재하지 않는다** |
| 13 | CLI | 구현 완료 후 | `bunx playwright test` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

---

## E2E AC 매핑

| AC | spec 파일 (신규/수정) | 비고 |
|----|----------------------|------|
| #1–#3, #7–#9, #11 | `e2e/users/add-flow.api.spec.ts` · `e2e/users/list.spec.ts` (필요 시) | payload에서 `department`·`job_title` 제거 |
| #4–#5 | `e2e/users/profile.spec.ts` | 「수정」버튼·Sheet AC **철회** → read-only·Security 회귀 AC로 교체 |
| #6, #11 | `e2e/users/add-flow.api.spec.ts` (API) | `profile.update` 403 · `user.create` validation |
| #10 | `e2e/asset-ledger/` (기존 또는 신규) | usage_location Select 저장 |
| #12 | API/DB 검증 (verifier) | migration 적용 확인 |
| #13 | verifier CLI 게이트 | 전체 spec green |

**activity log:** UI E2E 아님 — AC #6·#7·#11은 `GET /api/activity-logs` 또는 동등 API로 검증 (plan 08).

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE 준비 → FE → SQL 27 → 검증**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | asset-ledger | `usage-locations.ts` 상수 · `listAssetLedgerUsageLocations()` · 폼/검증 전환 |
| B | organization | `DEPARTMENT_*`·`JOB_TITLE_*` 제거 · `RANK_BY_AFFILIATION` 확장 · `validateOrganizationFields` rank-only |
| C | BE API | `POST/PUT /api/users` 스키마 · `PATCH /api/profile` 403 · select 컬럼 정리 |
| D | FE Users | 추가/수정 Sheet 2단(소속→직급) · Dialog read-only 정리 |
| E | FE Profile | Account read-only only · `ProfileEditSheet` 제거 · `patchProfileMutation` 정리 |
| F | SQL `27` | 3컬럼 DROP (앱 참조 제거 **후** 적용) |
| G | E2E | spec 갱신 · activity log API 검증 |
| H | 검증 | Playwright AC #1~#13 · tsc · lint · build |

### Out of Scope

| 항목 | 비고 |
|------|------|
| Flex 30명 bulk import / CSV / 스크립트 | 별도 운영·후속 plan |
| `flex` 소속 신설 | Q5-B 확정 |
| admin 타 user **연락처** 대리 수정 | plan 09 Out 유지 |
| 레거시 NULL birthday 일괄 backfill SQL | admin 수동 보완 |
| `first_name`/`last_name` 컬럼 DROP | plan 19 후속 |
| `PATCH /api/profile/password` 로깅 변경 | plan 03 기존 동작 유지 |
| mock API (`mock-api-users.ts`) | 데모 경로 Out |

---

## DB (`supabase/sql/27_profiles_slim_drop_fields.sql`)

> **구현:** backend-dev가 파일 생성·원격 적용. **앱 레이어에서 3컬럼 참조 제거 후** migration 적용.

```sql
-- Plan: 21_user-profile-slim-migration-plan.md
-- Date: 2026-07-10
-- Status: Approved

-- 제약 제거
alter table public.profiles
  drop constraint if exists profiles_job_title_length,
  drop constraint if exists profiles_food_restrictions_length;

-- 컬럼 DROP (데이터 영구 삭제)
alter table public.profiles
  drop column if exists department,
  drop column if exists job_title,
  drop column if exists food_restrictions;
```

| 항목 | 규칙 |
|------|------|
| **적용 시점** | `src/`·API·타입에서 3컬럼 참조 **0건** 확인 후 |
| **asset_items** | `usage_location`은 독립 `text` — DROP과 무관, 기존 행 값 유지 |
| **Rollback** | 앱 revert 가능 · SQL DROP은 **비가역** — 적용 전 DB 백업 권장 |
| **birthday** | `date` nullable 유지 — 레거시 NULL 계정 로그인·조회 가능 |

---

## asset-ledger — `usage_location` 대안

### 배경 (plan 15)

기존: `listAssetLedgerDepartments()` → `profiles.department` distinct → `validateUsageLocation()`.

### 확정 대안: **고정 사용처 목록 + 기존 자산 값 union**

| 항목 | 내용 |
|------|------|
| **신규 상수** | `src/features/asset-ledger/constants/usage-locations.ts` |
| **`USAGE_LOCATION_OPTIONS`** | 구 `DEPARTMENT_BY_AFFILIATION` 3소속 부서값 전부 + 「미지정」 등 — 레거시 `asset_items.usage_location` 검증 호환 |
| **서비스** | `listAssetLedgerDepartments()` → `listAssetLedgerUsageLocations()` — 반환 = 상수 ∪ `distinct(asset_items.usage_location)` |
| **검증** | `validateUsageLocation(value, locations)` — 동일 strict enum, 소스만 변경 |
| **`listAssetLedgerUsers()`** | `department` 필드 **제거** (`id`, `name`, `email`) |
| **폼 기본값** | `user.department` 제거 → `ASSET_DEPARTMENT_NONE_SENTINEL`(「미지정」) 또는 빈값 |

**plan 15 AC-02 회귀:** spec 문구를 「프로필 부서」→「사용처 목록」으로 갱신.

---

## RANK_BY_AFFILIATION 확장

`DEPARTMENT_BY_AFFILIATION`·`JOB_TITLE_BY_AFFILIATION` **삭제**. `validateOrganizationFields`는 **rank만** 검증.

### `wake` (웨이크)

```
사원, 주임, 대리, 과장, 팀장, 파트장,
마케터, 디자이너, HR, 포토그래퍼, 총무,
COO, CEO
```

### `sans` (산스)

```
CEO, 점장, 부점장, 선임매니저, 매니저, 쉐프,
매장운영, 파티쉐
```

### `sans_foundry` (산스파운드리)

```
CEO, 공장장, 공장 총괄, 팀장, 차장, 오퍼레이터
```

---

## API

### `POST /api/users` (admin·생성)

```ts
z.object({
  email: z.string().email('올바른 이메일 주소를 입력해 주세요.'),
  full_name: z.string().trim().min(1, '이름을 입력해 주세요.').max(100),
  affiliation: z.enum(AFFILIATIONS, { message: '소속을 선택해 주세요.' }),
  rank: z.string().trim().min(1, '직급을 선택해 주세요.').max(50),
  system_role: z.enum(['admin', 'user'], { message: '시스템 역할을 선택해 주세요.' }),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
}).superRefine((data, ctx) => {
  validateOrganizationFields({ affiliation: data.affiliation, rank: data.rank }, ctx);
  refineBirthday(data.birthday, ctx);
});
```

- `department`·`job_title` body 포함 시 Zod에서 **거부**(필드 자체 제거).
- 생성 시 `profiles` insert/update에 `affiliation`·`rank`·`birthday`·`full_name`만.

### `PUT /api/users/[id]` (admin·수정)

```ts
z.object({
  full_name: z.string().trim().min(1).max(100).optional(),
  avatar_url: z.string().max(2048).optional(),
  affiliation: z.enum(AFFILIATIONS).nullable().optional(),
  rank: z.string().max(50).nullable().optional(),
  system_role: z.enum(['admin', 'user']).optional(),
  birthday: birthdaySchema // optional, 제공 시 refineBirthday
}).superRefine(/* rank-only validateOrganizationFields */);
```

- `DISALLOWED_PUT_FIELDS`: `phone`, `food_restrictions` **유지**.
- `department`·`job_title` in body → **400** `forbidden_field` 또는 스키마 strip.
- inactive 대상 **400** 유지 (plan 03).

### `PATCH /api/profile` (본인) — **폐지**

- **모든 인증 user** — body에 필드가 있든 없든 **403**
- 메시지: 「프로필 정보는 관리자만 수정할 수 있습니다.」(또는 동등)
- `profile.update` 실패 로그 · `metadata.error_code`: `profile_edit_disabled`
- **대안 경로 없음** — admin은 `PUT /api/users/[id]`만 사용

### `PATCH /api/profile/password` — **변경 없음** (plan 03)

---

## UI

### `/dashboard/profile`

| 섹션 | 변경 |
|------|------|
| **Profile** | 소속·직급 read-only · **부서·직책 제거** |
| **Account** | 이름·연락처·생일 read-only · **「수정」버튼 제거** · 못 먹는 음식 **제거** |
| **Security** | 비밀번호 Sheet·로그아웃 **유지** |

### `/dashboard/users` — admin

| 화면 | 변경 |
|------|------|
| **추가 Sheet** | 소속 Select → 직급 Select (2단 cascade) · 생일 DatePicker **필수** |
| **수정 Sheet** | 동일 조직 필드 · 생일 optional 수정 |
| **프로필 Dialog** | 소속·직급 read-only · 부서·직책·음식 제거 · subtitle에서 `job_title` 제거 |

---

## 활동 감사 로그 (CUD In)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)

### 기록 연동

| Route | action | 변경 |
|-------|--------|------|
| `POST /api/users` | `user.create` | body에서 `department`·`job_title` 제거 · validation 실패 분기 유지 |
| `PUT /api/users/[id]` | `user.update` | `changed_fields`에 `rank`·`birthday`·`affiliation` 등만 · 제거 필드 미포함 |
| `PATCH /api/profile` | `profile.update` | **전 user 403** — `error_code: profile_edit_disabled` |

### return 분기 매트릭스 (`PATCH /api/profile`)

| 분기 | http_status | metadata `error_code` |
|------|-------------|------------------------|
| unauthenticated | 401 | `unauthenticated` |
| authenticated (any body) | 403 | `profile_edit_disabled` |
| catch | 500 | `internal_error` |

### return 분기 매트릭스 (`POST /api/users` — 제거 필드)

| 분기 | http_status | metadata |
|------|-------------|----------|
| `department`/`job_title` in body (strip 전) | 400 | `validation` |
| birthday missing | 400 | `validation` |
| success | 201 | `changed_fields` 없음(생성) |
| duplicate email | 400 | `duplicate_email` |

**민감 데이터:** metadata에 비밀번호·생일·연락처 **값** 저장 금지 — `changed_fields` 필드명만.

**삭제 확인 Dialog:** 본 plan에 DELETE UI 변경 **없음** — activity log DELETE AC 해당 없음.

---

## 영향 파일 & 패턴

| 경로 | 작업 |
|------|------|
| `supabase/sql/27_profiles_slim_drop_fields.sql` | **신규** (backend-dev) |
| `src/features/asset-ledger/constants/usage-locations.ts` | **신규** |
| `src/features/asset-ledger/api/service.server.ts` | `listAssetLedgerUsageLocations` · users select |
| `src/features/asset-ledger/api/users.ts` | `department` 타입 제거 |
| `src/features/asset-ledger/components/asset-item-form-sheet.tsx` | usage_location options·기본값 |
| `src/app/api/asset-items/route.ts` · `[id]/route.ts` · `users/route.ts` | departments → usageLocations |
| `src/features/users/constants/organization.ts` | rank-only · RANK 확장 |
| `src/features/users/schemas/user.ts` | create/update schema 슬림 |
| `src/app/api/users/route.ts` | POST schema·insert |
| `src/app/api/users/[id]/route.ts` | PUT schema·org 검증 |
| `src/app/api/profile/route.ts` | PATCH 403 · select 컬럼 |
| `src/features/auth/api/session.server.ts` · `types.ts` | select·타입 |
| `src/features/auth/components/profile-page-content.tsx` | read-only only |
| `src/features/auth/components/profile-account-read-only.tsx` | 음식 필드 제거 |
| `src/features/auth/components/profile-edit-sheet.tsx` | **제거 또는 미사용** |
| `src/features/auth/schemas/profile.ts` · `profile.client.ts` · `mutations.ts` | patch 프로필 정리 |
| `src/features/users/components/user-edit-form-fields.tsx` | 2단 cascade |
| `src/features/users/components/user-form-sheet.tsx` | payload·defaultValues |
| `src/features/users/components/user-profile-modal.tsx` | read-only 필드 |
| `src/features/users/api/types.ts` · `service.server.ts` | 타입·select |
| `e2e/users/add-flow.api.spec.ts` · `profile.spec.ts` | AC 갱신 |

**구현 시 필수:** `rg "department|job_title|food_restrictions" src supabase/sql` 재grep.

**패턴:** `mutations.ts` `onSettled` invalidate · `useAppForm` + Zod · `FormBirthdayField` · `recordActivityLog` (plan 08)

---

## 리스크 & 완화

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | SQL DROP 후 컬럼 참조 잔존 | grep 게이트 · tsc를 DROP 직후 1차 검증 (AC #13) |
| 2 | HIGH | asset-ledger 기존 `usage_location`이 상수 목록 밖 | union에 `asset_items.usage_location` distinct 포함 (AC #10) |
| 3 | MED | plan 10·09 E2E/spec 「수정」Sheet AC 충돌 | `profile.spec.ts` read-only AC로 교체 (AC #4–#5) |
| 4 | MED | Flex rank 오매핑 | §RANK 확장 목록을 `organization.ts` 단일 소스로 고정 |
| 5 | LOW | 레거시 NULL birthday 생일 배너 미노출 | admin Users에서 수동 보완 (AC #8) |

---

## 추정

| 항목 | 값 |
|------|-----|
| 복잡도 | **Medium–Complex** |
| 영향 파일 | ~28–32 |
| 예상 시간 | **~3.5–5시간** |
| Checkpoint | BE + organization + asset-ledger 상수 완료 후 tsc 1회 |

---

## 구현 팀 전달 메모

### designer

- Users 추가/수정 Sheet: **소속→직급 2단 cascade** · 생일 DatePicker(생성 필수).
- `/dashboard/profile` Account: **read-only only** — 「수정」CTA 없음 · Security 섹션 톤 유지.
- 프로필 Dialog·Profile 섹션: **소속·직급만** 표시.

### backend-dev

- SQL `27`은 **앱 참조 제거 후** 적용.
- `PATCH /api/profile` → 403 + `profile.update` 실패 로그 **전 분기**.
- asset-ledger `usage-locations.ts` + service 전환 **우선**(plan 15 회귀 방지).
- `POST/PUT` 3 Route와 `organization.ts`를 **동시** 맞춤.

### frontend-dev

- `ProfileEditSheet`·`patchProfileMutation` 제거 · Account read-only만.
- CUD는 `mutations.ts` 경유 · `onSettled` invalidate 유지.
- `user-edit-form-fields.tsx` cascade 4단 → 2단.

### verifier

- AC #6·#11: API로 activity log 검증 (UI E2E 아님).
- AC #10: 비품 대장 usage_location Select·저장.
- AC #12: SQL `27` 적용 확인.
- `bunx playwright test` · tsc · lint · build (AC #13).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-07-10 | 최초 작성 (Approved) — 프로필 슬림화, 본인 PATCH 폐지, SQL 27 DROP, asset-ledger usage_location 전환, RANK 확장 | planner |
