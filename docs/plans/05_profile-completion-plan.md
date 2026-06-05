# 프로필 페이지 완성 기획서

> Date: 2026-06-05  
> Status: Completed  
> Author: planner  
> **SQL:** `09` · `supabase/sql/09_profiles_extended_fields.sql` (예정)  
> **선행 plan 참조:** [01](./01_supabase-auth-login-plan.md), [02](./02_user-invite-profiles-plan.md), [03](./03_user-lifecycle-profile-plan.md) (프로필 UX·Security), [04](./04_user-reactivate-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **03** | `/dashboard/profile` 세로 3섹션(Profile·Account·Security) **유지** · 아바타 URL 당시 Out → **본 plan In** |
| **02** | `profiles` 단일 테이블 · org/membership 제거 → 조직 필드는 `profiles` 컬럼으로 표현 |
| **04** | Users admin Sheet · `PUT /api/users/[id]` · `mutations.ts` **`onSettled` invalidate** 재사용 |

**[변경됨]** 초기 Draft의 「부서·직책 필드 없음」 정책 **철회** — 조직도(이민지 참조) 반영.

---

## 한 줄 요약

**관리자·일반 사용자 동일 프로필 필드**(아바타 URL·소속·부서·직급·직책·이름·연락처·못 먹는 음식)를 `profiles`에 추가하고, **본인은 이름·연락처·음식 제한만** 수정 가능하며 **조직·아바타 필드는 관리자만** Users 수정 Sheet에서 cascade Select로 설정한다.

---

## 정책 확정안

### 필드·권한

| 항목 | 확정 |
|------|------|
| **공통 필드** | admin·user **동일 스키마** — admin 계정도 소속·부서·직급·직책·아바타 URL 보유 |
| **아바타** | `profiles.avatar_url` `text` nullable · http(s) URL · `AvatarImage` + 이니셜 Fallback |
| **소속** | `profiles.affiliation` CHECK `wake` \| `sans` \| `sans_foundry` · UI: 웨이크 / 산스 / 산스파운드리 |
| **부서** | `profiles.department` `text` nullable · 소속별 허용 enum (DB text, app Zod 검증) |
| **직급** | `profiles.rank` `text` nullable · max 50자 · 소속별 허용 enum |
| **직책** | `profiles.job_title` `text` nullable · max 50자 · 소속별 허용 enum (역할명; 직급과 겹칠 수 있음) |
| **못 먹는 음식** | `profiles.food_restrictions` `text` nullable · max **200자** · textarea |
| **본인 PATCH** | `PATCH /api/profile` — `first_name`, `last_name`, `phone`, `food_restrictions` **만** |
| **관리자 PUT** | `PUT /api/users/[id]` — `avatar_url`, `affiliation`, `department`, `rank`, `job_title`, `system_role` · inactive 가드 유지 · **이름·연락처·음식 대리 수정 불가** |
| **프로필 UI** | 조직·아바타 필드 **모든 사용자 읽기 전용** (admin 본인 프로필 포함) · 수정은 Users Sheet |
| **Users 목록** | 소속·부서 컬럼 **추가 안 함** (Sheet·프로필에서만 표시) |
| **Users 수정 Sheet** | cascade Select 4단(소속→부서→직급→직책) + 아바타 URL + 시스템 역할 · **이름·연락처 제거** |

### 소속별 조직 옵션 (FE 상수 · BE Zod 검증)

소속 변경 시 **부서·직급·직책 reset** (연쇄 Select).

#### `wake` (웨이크 · 주식회사 웨이크)

| 필드 | 허용값 |
|------|--------|
| **부서** | 콘텐츠팀, 사업기획팀, 마케팅팀, 디자인팀, 구매물류팀, 인사팀, 회계팀, 사업본부, 경영본부 |
| **직급** | 사원, 주임, 대리, 과장, 팀장, COO, CEO |
| **직책** | 팀장, CEO, COO |

직급 표기 `(T)`/`(P)` 등은 **Out** — 필요 시 후속 plan (`rank_note` 등).

#### `sans` (산스)

| 필드 | 허용값 |
|------|--------|
| **부서(지점)** | 익선(본점), 신세계강남 스위트파크, 본사 |
| **직급** | CEO, 점장, 부점장, 선임매니저, 매니저, 쉐프 |
| **직책** | CEO, 점장, 부점장, 선임매니저, 매니저, 쉐프 |

#### `sans_foundry` (산스파운드리 · 안산공장)

| 필드 | 허용값 |
|------|--------|
| **부서(팀)** | 생산팀, 품질팀, 공무팀, 지원팀, 물류팀 |
| **직급** | CEO, 공장장, 팀장, 차장, 오퍼레이터 |
| **직책** | CEO, 공장장, 팀장, 차장, 오퍼레이터 |

### FE 상수 파일 (권장)

```
src/features/users/constants/organization.ts
  AFFILIATION_OPTIONS
  DEPARTMENT_BY_AFFILIATION
  RANK_BY_AFFILIATION
  JOB_TITLE_BY_AFFILIATION
  getAffiliationLabel()
  getDepartmentLabel() // 필요 시
```

프로필 read-only 표시에도 동일 상수 import.

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | 일반 user, `/dashboard/profile` | Profile 섹션 확인 | 아바타·소속·부서·직급·직책 **입력 불가(read-only)** · 미설정 시 「미설정」 muted |
| 2 | Playwright | 일반 user | Account에서 이름·연락처·못 먹는 음식(199자) 저장 | 「프로필이 저장되었습니다.」 토스트 · 새로고침 후 유지 |
| 3 | Playwright | 일반 user | 못 먹는 음식 201자 제출 | 클라이언트 또는 API **400** · 저장 안 됨 |
| 4 | Playwright | 일반 user | `PATCH`에 `avatar_url`·`affiliation`·`department` 우회 | API **403** 또는 필드 무시 · DB 미변경 |
| 5 | Playwright | admin, Users 활성 user B | 수정 Sheet: 소속 `wake` → 부서 `마케팅팀` → 직급 `대리` → 직책 선택 후 저장 | 성공 토스트 · B 프로필에 **웨이크 · 마케팅팀 · 대리** read-only 반영 |
| 6 | Playwright | admin | Users 수정 Sheet | **이름·연락처 입력 필드 없음** |
| 7 | Playwright | user B, admin이 Slack CDN `avatar_url` 설정 | `/dashboard/profile` 헤더 | **이미지 렌더** · Fallback 아님 |
| 8 | Playwright | user B, 소속 `sans` · 부서 `익선(본점)` | 프로필 Profile 섹션 | 「산스」「익선(본점)」 표시 |
| 9 | Playwright | admin, Users Sheet | 소속을 `wake`→`sans` 변경 | 부서·직급·직책 **초기화**(또는 저장 전 유효성 오류) · sans 옵션만 선택 가능 |
| 10 | Playwright | admin 본인, `/dashboard/profile` | Profile 섹션 | 소속·부서·직급·직책·아바타 **read-only** (Users Sheet에서만 수정) |
| 11 | Playwright | admin, Users | 목록 테이블 | **소속·부서 컬럼 없음** (이름·연락처·역할·상태만) |
| 12 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE → FE**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | DB | SQL `09` — `avatar_url`, `affiliation`, `department`, `rank`, `job_title`, `food_restrictions` |
| B | BE | `PATCH /api/profile` 화이트리스트 · `PUT /api/users/[id]` admin 필드 + **소속별 enum Zod** |
| C | BE | `session.server`·Users GET select 필드 확장 |
| D | FE | `organization.ts` 상수 · cascade Select 유틸 |
| E | FE 프로필 | AvatarImage · read-only 조직 필드 · `food_restrictions` textarea |
| F | FE Users | admin Sheet 4단 cascade + avatar URL · 이름·연락처 제거 |
| G | FE | `nav-user` avatar_url |
| H | 검증 | Playwright AC #1~#12 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| 이미지 파일 업로드·Storage | URL만 |
| 총무 전용 회식 관리 화면 | `food_restrictions` 저장만 |
| admin이 타 user 이름/연락처/음식 대리 수정 | 본 plan 제외 |
| Users 목록 소속·부서 컬럼 | 확정 Out |
| 직급 (T)/(P) 표기·`rank_note` | 후속 plan |
| 조직 옵션 런타임 DB 관리 | app 상수 고정 |

---

## DB (`09_profiles_extended_fields.sql`)

```sql
-- Plan: 05_profile-completion-plan.md
-- Date: 2026-06-05
-- Status: Approved

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists affiliation text check (affiliation in ('wake', 'sans', 'sans_foundry')),
  add column if not exists department text,
  add column if not exists rank text,
  add column if not exists job_title text,
  add column if not exists food_restrictions text;

alter table public.profiles
  add constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048),
  add constraint profiles_rank_length check (rank is null or char_length(rank) <= 50),
  add constraint profiles_job_title_length check (job_title is null or char_length(job_title) <= 50),
  add constraint profiles_food_restrictions_length check (food_restrictions is null or char_length(food_restrictions) <= 200);

comment on column public.profiles.avatar_url is '프로필 이미지 URL (admin 설정)';
comment on column public.profiles.affiliation is '소속: wake|sans|sans_foundry';
comment on column public.profiles.department is '부서/지점 (admin 설정, 소속별 enum)';
comment on column public.profiles.rank is '직급 (admin 설정)';
comment on column public.profiles.job_title is '직책/역할명 (admin 설정)';
comment on column public.profiles.food_restrictions is '못 먹는 음식 (본인 입력, max 200자)';
```

- `department`·`rank`·`job_title` 허용값은 **앱 레이어 Zod**에서 `affiliation`과 함께 검증 (DB는 text nullable).
- `affiliation` 변경 시 기존 `department`/`rank`/`job_title`이 새 소속 enum에 없으면 PUT 시 **400** 또는 FE에서 reset 후 저장.

RLS: plan 03 패턴 — Route Handler 화이트리스트로 권한 분리.

---

## API

### `PATCH /api/profile` (본인)

```ts
z.object({
  first_name: z.string().max(100),
  last_name: z.string().max(100),
  phone: z.string().max(50).nullable().optional(),
  food_restrictions: z.string().max(200).nullable().optional()
});
```

`avatar_url`, `affiliation`, `department`, `rank`, `job_title`, `system_role` → **strip 또는 403**.

### `PUT /api/users/[id]` (admin)

```ts
z.object({
  avatar_url: z.string().url().max(2048).nullable().optional(),
  affiliation: z.enum(['wake', 'sans', 'sans_foundry']).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  rank: z.string().max(50).nullable().optional(),
  job_title: z.string().max(50).nullable().optional(),
  system_role: z.enum(['admin', 'user']).optional()
}).superRefine(/* affiliation별 department/rank/job_title enum 일치 검증 */);
```

- `first_name`, `last_name`, `phone`, `food_restrictions` — **허용하지 않음**.
- inactive 대상 **400** 유지 (plan 03).

---

## UI

### `/dashboard/profile` (plan 03 레이아웃 유지)

**Profile 섹션 (read-only)**

- `Avatar` + `AvatarImage` (`avatar_url`)
- 이메일, 소속(한글), 부서, 직급, 직책
- 미설정: 「미설정」 muted

**Account 섹션 (본인 편집)**

- 이름, 성, 연락처
- `FormTextareaField` 못 먹는 음식 (maxLength 200, 글자 수)

**Security 섹션**

- plan 03 유지 (비밀번호 Sheet · 로그아웃)

### Users > 수정 Sheet (admin)

1. 아바타 URL (`Input type=url`)
2. 소속 Select → 부서 Select → 직급 Select → 직책 Select (**cascade**)
3. 시스템 역할 Select
4. ~~이름·연락처~~ 없음

---

## 영향 파일

| 경로 | 작업 |
|------|------|
| `supabase/sql/09_profiles_extended_fields.sql` | **신규** |
| `src/features/users/constants/organization.ts` | **신규** — AFFILIATION·DEPARTMENT·RANK·JOB_TITLE |
| `src/app/api/profile/route.ts` | `food_restrictions` · admin 필드 차단 |
| `src/app/api/users/[id]/route.ts` | PUT 스키마·소속별 검증 |
| `src/features/auth/api/types.ts` | `AuthProfile` 확장 |
| `src/features/auth/api/session.server.ts` | select 필드 |
| `src/features/auth/api/profile.client.ts` | payload |
| `src/features/auth/components/profile-page-content.tsx` | AvatarImage · read-only 조직 |
| `src/features/auth/components/profile-form.tsx` | `food_restrictions` |
| `src/features/users/api/types.ts` | `User` 확장 |
| `src/features/users/schemas/user.ts` | admin update schema |
| `src/features/users/components/user-form-sheet.tsx` | cascade Sheet |
| `src/features/users/api/service.server.ts` | select 필드 |
| `src/components/nav-user.tsx` | `avatar_url` |

**변경 없음:** `src/features/users/components/users-table/columns.tsx` (목록 컬럼 추가 Out)

---

## 리스크 & 완화

| # | 리스크 | 완화 |
|---|--------|------|
| 1 | HIGH — RLS로 본인이 admin 필드 UPDATE | API 화이트리스트 · admin route service_role |
| 2 | MED — 소속 변경 후 stale department | FE cascade reset · BE superRefine 400 |
| 3 | MED — 잘못된 이미지 URL | `AvatarImage` onError → Fallback |
| 4 | LOW — sans 직급/직책 동일 옵션 풀 | UI에서 직급·직책 Select 분리 유지 · 동일 목록 허용 |

---

## 열린 질문

| ID | 항목 | 결정 |
|----|------|------|
| Q1 | 직책 컬럼명 | **`job_title`** (`position`은 혼동 방지로 미사용) |
| Q2 | Users 목록 소속·부서 컬럼 | **Out** (확정) |
| Q3 | (T)/(P) 직급 표기 | **Out** — 후속 plan |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-05 | 최초 작성 (Draft) | planner |
| 2026-06-05 | 재기획 Approved — 부서·직책(`job_title`) In, 소속별 cascade 조직도, admin 동일 필드, AC #1~#12, Users 목록 컬럼 Out | planner |
