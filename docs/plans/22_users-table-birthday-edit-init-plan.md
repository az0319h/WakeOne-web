# Users 테이블 생일 컬럼 · 수정 Sheet 초기값 기획서

> Date: 2026-07-13  
> Status: Approved  
> Author: planner  
> **SQL:** 해당 없음 (`profiles.birthday` 재사용 · plan 09 SQL `11`)  
> **선행:** [06](./06_users-profile-modal-plan.md), [08](./08_activity-audit-log-plan.md), [09](./09_profile-phone-birthday-plan.md), [10](./10_dashboard-birthday-profile-sheet-plan.md), [17](./17_user-management-add-flow-plan.md), [21](./21_user-profile-slim-migration-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **09** | `profiles.birthday`·admin Sheet·Dialog·`formatBirthdayDisplay` **완료**. **AC #8「테이블 생일 컬럼 없음」·Out「Users 테이블 생일 컬럼」→ 본 plan에서 대체(In)** |
| **10** | overview 배너·프로필 Sheet. Out「admin Users 테이블 생일 컬럼」**본 plan으로 정책 변경** (10 Out은 본 plan 승인 후 무효) |
| **06** | Users Dialog read-only · 아바타 셀 — 회귀 유지 |
| **08** | CUD Route `recordActivityLog` — 기존 `PUT /api/users/[id]` · `user.update` **회귀 검증 필수** |
| **17 / 21** | 사용자 추가·수정 Sheet · `FormBirthdayField` · PUT birthday — **재사용** |

### plan 09 AC #8 대체

| 항목 | plan 09 (기존) | plan 22 (본 문서) |
|------|----------------|-------------------|
| Users 테이블 생일 컬럼 | **없음** (AC #8 · Out) | **있음** (연락처 옆) |
| 표시 | — | `yyyy년 M월 d일` · null `—` |
| 정렬·필터 | — | **Out** |

구현·verifier는 **본 plan AC를 우선**한다. plan 09 AC #8은 ~~테이블에 생일 컬럼 없음~~ → **본 plan AC #1로 대체**.

---

## 한 줄 요약

`/dashboard/users` 테이블에 생일 컬럼을 추가하고, 수정 Sheet에서 저장된 생일이 년/월/일 Select에 초기값으로 표시·재오픈 유지되도록 고친다.

---

## 정책 확정안 (deep-interview · battle-plan · go)

| 항목 | 확정 |
|------|------|
| **테이블 표시** | `formatBirthdayDisplay`와 동일 **`yyyy년 M월 d일`** |
| **null** | **`—`** |
| **컬럼 위치** | **연락처 옆** (phone 다음) |
| **정렬·필터** | **Out** |
| **Sheet 버그** | **수정(edit)** Sheet — 저장된 생일 년/월/일 Select **초기 표시 + 재오픈 유지** |
| **create** | UX 개편 Out · **가벼운 회귀**만 |
| **plan 09 AC #8** | **대체 동의** |
| **SQL** | **신규 없음** |
| **신규 Route / action** | **보통 Out** — 기존 PUT 경로 사용 |
| **activity log** | 「해당 없음」으로 생략 **금지** — 기존 `user.update` **회귀 검증 필수**. 누락 시 BE 보완 **In** |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin, `/dashboard/users`, 생일 있는·없는 사용자 | 목록 확인 | 연락처 **옆**에 **생일** th · 값 **`yyyy년 M월 d일`** · null **`—`** · 정렬·필터 UI **없음** *(plan 09 AC #8 대체)* |
| 2 | Playwright | admin, `birthday`가 `YYYY-MM-DD`로 저장된 active user | 수정 Sheet 오픈 | 년·월·일 Select에 **해당 생일 초기 표시** (placeholder 「년」「월」「일」만 보이는 상태 **아님**) |
| 3 | Playwright | AC #2 직후 Sheet를 닫았다가 같은 user로 다시 오픈 | — | 동일 년·월·일 값이 Select에 **유지** |
| 4 | API / Playwright | admin | `PUT /api/users/[id]`로 `birthday` 변경 성공 | **200** · `changed_fields`에 **`birthday`** · `/dashboard/logs`(또는 activity-logs API)에 Action **`user.update`** · Status **2xx** 행 |
| 5 | Playwright | admin, 사용자 추가 Sheet | 필수값·생일 선택 후 제출 | 성공 토스트 · 목록에 신규 행 · 생일 셀이 **`yyyy년 M월 d일`**로 표시 *(create 회귀)* |
| 6 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 06 Dialog 가드 · plan 21 Sheet 필드(소속·직급·생일) · plan 08 PUT 전 분기 로깅 패턴 **유지**.

---

## 범위 (In / Out)

### In Scope (구현 순서: **FE 버그픽스 → 테이블 컬럼 → BE 회귀 확인 → 검증**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **FE 버그픽스** | `FormBirthdayField` / `parseBirthdayParts`(또는 목록·폼 진입 전 정규화) — edit defaultValues의 birthday가 Select에 반영 |
| B | **FE 테이블** | `users-table/columns.tsx` — 연락처 옆 생일 컬럼 · `formatBirthdayDisplay` · null `—` · 정렬·필터 비활성 |
| C | **BE 회귀** | `PUT /api/users/[id]` · `birthday` schema · `jsonWithActivityLog`/`recordActivityLog` · `user.update` — **이미 있으면 변경 최소** · **누락 시 보완 In** |
| D | **검증** | Playwright AC #1–#5 · CLI #6 · 목 데이터 cleanup |

### Out of Scope

| 항목 | 비고 |
|------|------|
| 신규 SQL / `profiles.birthday` 스키마 변경 | plan 09 재사용 |
| 신규 mutation Route · 신규 activity **action** 코드 | `user.update` 재사용 |
| 테이블 생일 **정렬·필터** | 인터뷰 Out |
| create Sheet UX 개편 | 회귀만 |
| overview 배너·프로필 Sheet·Dialog 포맷 변경 | 기존 `yyyy년 M월 d일` 유지 |
| admin 타 user 연락처 수정 | plan 05/09 Out 유지 |

---

## UI 요구사항

### Users 테이블 (`/dashboard/users`)

| 항목 | 내용 |
|------|------|
| **헤더** | **생일** |
| **위치** | `phone`(연락처) 컬럼 **바로 다음** |
| **셀** | `formatBirthdayDisplay(birthday)` · falsy/null → **`—`** |
| **정렬** | `enableSorting: false` (또는 동등) |
| **필터** | `enableColumnFilter: false` · meta filter **없음** |

### 수정 Sheet (`UserFormSheet` edit)

| 항목 | 내용 |
|------|------|
| **필드** | 기존 `FormBirthdayField name='birthday'` 유지 |
| **초기값** | DB/API에 저장된 생일이 년·월·일 Select에 **마운트 시 표시** |
| **재오픈** | Sheet를 닫았다가 다시 열어도 동일 값 표시 |
| **원인 후보** | `parseBirthdayParts`가 `YYYY-MM-DD`만 허용 — ISO 등 비정규 문자열이면 placeholder만 표시 → **정규화 또는 파싱 보강** |

**패턴 참조:** `user-profile-modal.tsx`의 `formatBirthdayDisplay` · `src/lib/birthday.ts` · `src/components/forms/fields/birthday-field.tsx`

---

## API / DB 요구사항

### DB

**신규 SQL 없음.** `profiles.birthday` (`date`, nullable) — plan 09 / SQL `11`.

### API (기존 · 회귀)

| Route | Method | action | 본 plan 역할 |
|-------|--------|--------|--------------|
| `/api/users/[id]` | PUT | `user.update` | birthday 업데이트 경로 · **전 HTTP 분기** `recordActivityLog` 유지/보완 |
| `/api/users` | GET | — | list에 `birthday` select **이미 있음** — Read 로그 Out |

**FE 호출 경로 (확인됨):**  
`user-form-sheet` → `updateUserMutation` → `updateUser()` → `PUT /api/users/[id]`.

**Schema:** `birthday` in `updateUserSchema` + `refineBirthday` — 유지.

신규 CUD Route가 없으면 **신규 action 추가 Out**. 다만 기존 PUT에 로깅/birthday 처리가 빠져 있으면 BE에서 **In으로 보완**.

---

## 활동 감사 로그 (plan 08 · 기존 CUD 회귀)

> `core-conventions.mdc` §활동 감사 로그 · [plan 08](./08_activity-audit-log-plan.md)  
> 신규 Route **없음**이어도 「activity log 해당 없음」으로 **생략하지 않음** — **기존 update 경로 회귀 필수**.

### 기록 연동 (기존)

| Route | HTTP | action | 변경 사항 |
|-------|------|--------|----------|
| `src/app/api/users/[id]/route.ts` | PUT | `user.update` | birthday 포함 시 `changed_fields` · **전 return 분기** `jsonWithActivityLog` / `finishWithActivityLog` → `recordActivityLog` **유지** · 누락 시 보완 |

### return 분기 매트릭스 (`PUT /api/users/[id]` — 회귀)

| 분기 | http_status | metadata |
|------|-------------|----------|
| unauthenticated / forbidden (admin) | 401 / 403 | `unauthenticated` / `forbidden` |
| `phone` 등 DISALLOWED in body | 400 | `forbidden_field` |
| Zod / birthday validation | 400 | `validation` |
| not found | 404 | `not_found` |
| inactive user | 400 | `inactive_user` |
| DB error | 400 | `validation` |
| success (birthday 포함) | 200 | `changed_fields: [..., 'birthday', ...]` |
| catch | 500 | `internal_error` |

**민감 데이터:** metadata에 생일 **값** 저장 금지 — `changed_fields` 필드명만.

**AC:** #4 — PUT birthday 성공 후 `/dashboard/logs`(또는 API)에서 **`user.update`** 2xx + `changed_fields`에 `birthday`.

---

## 영향 파일 & 패턴

| 파일 | 이유 |
|------|------|
| `src/features/users/components/users-table/columns.tsx` | 생일 컬럼 추가 |
| `src/components/forms/fields/birthday-field.tsx` | Select 초기값 sync |
| `src/lib/birthday.ts` | `parseBirthdayParts` / 정규화 |
| `src/lib/format.ts` | `formatBirthdayDisplay` 재사용 |
| `src/features/users/components/user-form-sheet.tsx` | edit `defaultValues.birthday` (필요 시 정규화) |
| `src/app/api/users/[id]/route.ts` | PUT·log **회귀 확인** (누락 시만 수정) |
| `e2e/users/*.spec.ts` | AC #1–#5 |

**패턴:** `formatBirthdayDisplay` · `Icons.*` · `cn()` · React Query `updateUserMutation` `onSettled` invalidate · API Route 경유 CUD

---

## 리스크 & 완화책

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | API/DB birthday가 ISO 등 비-`YYYY-MM-DD` → Select 초기값 실패 | 파싱 보강 또는 폼/목록 진입 전 `YYYY-MM-DD` 정규화 · AC #2/#3 |
| 2 | MED | plan 09/10 「테이블 생일 Out」과 문서 충돌 | 본 plan이 AC #8·Out **대체**임을 README·본 문서에 명시 |
| 3 | LOW | 컬럼 추가로 가로 스크롤 | 단일 컬럼 · 정렬/필터 없음 |

---

## 구현 추정

- **범위:** ~4–8 파일 · ~80–150 LOC · SQL 0  
- **복잡도:** Simple–Medium  
- **예상:** ~40–70분  
- **체크포인트:** Sheet 초기값 수정 확인 후 테이블 컬럼

---

## 열린 질문

없음 (인터뷰·battle-plan·포맷·`go` 확정).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-07-13 | 최초 작성 (Approved) · plan 09 AC #8 대체 · 테이블 생일 + Sheet 초기값 | planner |
