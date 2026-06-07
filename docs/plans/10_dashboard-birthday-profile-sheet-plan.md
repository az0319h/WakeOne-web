# 대시보드 생일 배너·프로필 Sheet 기획서

> Date: 2026-06-07  
> Status: In Progress  
> Author: planner  
> **SQL:** 해당 없음 (DB 변경 없음 · plan 09 `profiles.birthday` 재사용)  
> **선행:** [03](./03_user-lifecycle-profile-plan.md), [05](./05_profile-completion-plan.md), [06](./06_users-profile-modal-plan.md), [08](./08_activity-audit-log-plan.md), [09](./09_profile-phone-birthday-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **09** | `profiles.birthday`·`PATCH /api/profile`·프로필 폼 필드 **완료** — 본 plan은 **조회 API·overview UI·Account Sheet UX** 추가 |
| **03** | 프로필 **세로 섹션(Profile → Account)** 유지 · Security(비밀번호 Sheet)는 `nav-user` **유지** |
| **05** | 본인 PATCH 필드 범위·조직 read-only **유지** — Sheet도 동일 필드만 |
| **06** | Users 테이블 **생일 컬럼 Out** 유지 — overview 배너만 신규 |
| **08** | 프로필 저장은 기존 `PATCH /api/profile` → **`profile.update` 회귀** (신규 action 없음) |

---

## 한 줄 요약

KST 기준 **이번 달 생일 active 사용자**를 `/dashboard/overview` 최상단 **캐러셀 배너**로 표시하고, 생일자가 있을 때 **세션당 1회 컨페티**를 재생한다. `/dashboard/profile` Account는 **read-only + 「수정」Sheet Form**으로 전환한다.

---

## 정책 확정안 (deep-interview)

| 항목 | 확정 |
|------|------|
| **생일자 대상** | `status = active` **AND** `birthday IS NOT NULL` **AND** `birthday`의 **월 = KST 현재 월** (연도 무시 · 해당 월 전체 일자) |
| **생일자 0명** | overview **배너·컨페티 모두 없음** (섹션 숨김) |
| **컨페티** | 생일자 ≥ 1명 · **세션당 1회** (`sessionStorage`) · [shadcn Payment Success Confetti](https://www.shadcn.io/blocks/billing-payment-success-confetti) 스타일 · `canvas-confetti` |
| **타임존** | **Asia/Seoul(KST)** — 서버에서 현재 연·월 산출 |
| **조회 권한** | **로그인 user 전원** (admin·user 동일 목록) |
| **RLS** | 클라이언트 `profiles` 직접 조회 불가 → **Route Handler + service_role** (또는 동등 server-only 쿼리) |
| **API 노출 필드** | `user_id`, `first_name`, `last_name`, `avatar_url`, `birthday` — **email·phone 제외** |
| **캐러셀** | 생일자 **2명 이상** 시 shadcn **Carousel** (1명이면 단일 카드, 화살표 숨김 또는 비활성) |
| **본인 강조** | **없음** — 본인도 동일 슬라이드 |
| **프로필 Sheet** | **Account 필드만** — 이름·성·연락처·생일·못 먹는 음식 · Profile(조직) **read-only 유지** |
| **activity log** | 신규 action **없음** — `profile.update` 재사용 · READ API는 **기록 Out** |

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | KST 이번 달 생일자 **≥1명** (active·birthday 설정) | 일반 user `/dashboard/overview` | **최상단**(mock KPI 카드 **위**)에 **「이번 달 생일」** 배너 표시 · 생일자 **이름**·**`M월 d일`**(또는 동등) · 아바타(또는 이니셜) |
| 2 | Playwright | 이번 달 생일자 **≥2명** | overview 배너 | **캐러셀** 이전/다음(또는 dot)으로 **모든 생일자** 순회 가능 |
| 3 | Playwright | AC #1 조건 | overview **첫 방문**(세션) | **컨페티** 1회 재생(또는 canvas-confetti 호출 확인) |
| 4 | Playwright | AC #3 직후 **같은 세션**에서 overview 재방문 | — | 컨페티 **재생 없음** (`sessionStorage` 키 유지) |
| 5 | Playwright | 이번 달 생일자 **0명** (또는 테스트 데이터로 해당 월 비움) | `/dashboard/overview` | 생일 배너 **없음** · KPI 카드 그리드가 **최상단** · 컨페티 없음 |
| 6 | Playwright | **non-admin** user | overview 생일 배너 | admin 전용 UI 없이 **동일 생일자 목록** 표시 |
| 7 | Playwright | 일반 user `/dashboard/profile` Account | 페이지 확인 | 필드 **read-only** 표시 · 인라인 **「저장」버튼 없음** · **「수정」** 버튼 있음 |
| 8 | Playwright | AC #7 | **「수정」** 클릭 | **Sheet** 오픈 · 이름·성·연락처·생일·못 먹는 음식 **편집 가능** · Profile 조직 필드는 Sheet **밖 read-only 유지** |
| 9 | Playwright | Sheet에서 연락처·생일 변경 후 저장 | — | 「프로필이 저장되었습니다.」 토스트 · Sheet 닫힘 · Account read-only에 **반영** |
| 10 | Playwright | AC #9 저장 성공 후 `/dashboard/logs` | — | 최신 행 Action **`profile.update`** · Status **2xx** · `changed_fields`에 변경 필드명 |
| 11 | API | 로그인 user | `GET /api/birthdays/this-month` | **200** · `data.celebrants[]` — 전원 `status=active`·`birthday` 월=KST 현재 월 · **email 미포함** |
| 12 | API | 비로그인 | `GET /api/birthdays/this-month` | **401** |
| 13 | CLI | — | `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 09 프로필·admin Users 생일·연락처 AC · plan 06 Dialog · plan 08 기존 6 Route 로깅 **유지**.

---

## User Flow (Express)

### Flow A — Overview 생일 배너

1. user 로그인 → `/dashboard/overview` 진입
2. 서버(또는 prefetch)가 KST 기준 이번 달 생일자 목록 조회
3. **0명** → 배너 렌더 생략, 기존 overview만 표시
4. **≥1명** → 최상단 배너 + 캐러셀(2명 이상) · 클라이언트가 `sessionStorage` 미설정 시 **컨페티 1회** 후 키 저장
5. 동일 세션 재방문 → 배너는 유지, 컨페티 생략

### Flow B — 프로필 Account Sheet

1. `/dashboard/profile` → Account 섹션 read-only(이름·연락처 하이픈·생일 `yyyy년 M월 d일`·음식)
2. **「수정」** → Sheet 오픈 · 기존 `ProfileForm` 필드·검증(plan 09) 재사용
3. **저장** → `PATCH /api/profile` (`mutations.ts`) → 성공 토스트 · Sheet 닫기 · `router.refresh()` 또는 쿼리 invalidate
4. 생일 변경으로 이번 달 목록이 바뀌면 → `birthdayCelebrants` 쿼리 **invalidate** (overview 재방문 시 반영)

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE → FE deps → overview → profile Sheet → 검증**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **BE** | `GET /api/birthdays/this-month` — `requireSession` · service_role · KST 월 필터 · active·birthday not null |
| B | **BE** | `src/features/birthday-celebrants/api/` — `types.ts` · `service.server.ts` · `service.ts` · `queries.ts` |
| C | **FE deps** | `bun add canvas-confetti` (+ types) · shadcn **carousel** 추가 |
| D | **FE overview** | `overview/layout.tsx` 최상단 배너 슬롯 · `BirthdayCelebrantsBanner`(client) — Carousel · Confetti · session 1회 |
| E | **FE profile** | Account read-only display · `ProfileEditSheet` (또는 동등) — `user-form-sheet` / `profile-password-sheet` 패턴 |
| F | **FE mutation** | `patchProfileMutation.onSettled`에 `birthdayCelebrantsKeys` invalidate 추가 |
| G | **검증** | Playwright AC #1~#10 · API #11~#12 · tsc · lint · build |

### Out of Scope

| 항목 | 비고 |
|------|------|
| DB·SQL 변경 | plan 09 `birthday` 재사용 |
| inactive·birthday null 사용자 | 목록 제외 |
| 생일자 **오늘만** 필터 | 이번 **달** 전체 |
| 이메일·연락처 배너 노출 | API·UI 제외 |
| admin Users 테이블 생일 컬럼 | plan 06 Out 유지 |
| 푸시·이메일 생일 알림 | 후속 plan |
| `prefers-reduced-motion` 무시 | **[INFERRED]** 후속 — 1차는 confetti 기본 동작 |
| activity log READ 기록 | plan 08 Out |
| overview mock KPI·차트 교체 | 기존 parallel routes **유지** |

---

## DB

**해당 없음** — `profiles.birthday`·`status`는 plan 09·03에서 이미 존재.

**쿼리 (service_role · 참고):**

```sql
-- KST 현재 월 = :month (1-12)
select user_id, first_name, last_name, avatar_url, birthday
from public.profiles
where status = 'active'
  and birthday is not null
  and extract(month from birthday) = :month
order by extract(day from birthday), last_name, first_name;
```

---

## API

### `GET /api/birthdays/this-month`

| 항목 | 내용 |
|------|------|
| **인증** | `requireSession` — **모든 authenticated user** |
| **데이터** | `getServiceRoleClient()` — RLS 우회 · 위 쿼리 |
| **KST** | 서버 헬퍼 `getKstYearMonth()` — `Intl` 또는 `date-fns-tz` **[INFERRED: `Intl` timeZone `Asia/Seoul`]** |

**응답 (200):**

```ts
{
  success: true,
  data: {
    month: number;       // 1-12 KST
    year: number;        // KST 현재 연 (UI·sessionStorage 키용)
    celebrants: Array<{
      user_id: string;
      first_name: string;
      last_name: string;
      avatar_url: string | null;
      birthday: string;  // YYYY-MM-DD
    }>;
  }
}
```

| HTTP | 조건 |
|------|------|
| **401** | 미인증 |
| **500** | DB·서버 오류 |

**Query key:**

```ts
export const birthdayCelebrantsKeys = {
  all: ['birthday-celebrants'] as const,
  thisMonth: () => [...birthdayCelebrantsKeys.all, 'this-month'] as const
};
```

---

## UI 요구사항

### `/dashboard/overview` — 생일 배너 (최상단)

| 항목 | 내용 |
|------|------|
| **위치** | `layout.tsx` 내 `PageContainer` 자식 **첫 요소** — 「Hi, Welcome back」·KPI 카드 **위** |
| **표시 조건** | `celebrants.length > 0` 만 |
| **레이아웃** | Card 또는 gradient 배너 · 제목 **「이번 달 생일」** (또는 **「🎂 이번 달 생일을 축하해요」**) |
| **슬라이드** | `ProfileAvatar` 패턴 · **이름** · **`M월 d일`** (`parseBirthdayParts` / `formatBirthdayDisplay`에서 연도 생략 variant 또는 신규 `formatBirthdayMonthDay`) |
| **캐러셀** | shadcn Carousel · 2명 이상 시 Prev/Next · 1명 시 단일 카드 |
| **컨페티** | client mount · `sessionStorage` 키 예: `wakeone:birthday-confetti:{year}-{month}` · [참조 블록](https://www.shadcn.io/blocks/billing-payment-success-confetti) |
| **데이터** | RSC: `getBirthdayCelebrantsServer()` 직접 호출 **또는** `prefetchQuery` + `HydrationBoundary` — overview에 `page.tsx` 추가 시 후자 가능 |

### `/dashboard/profile` — Account Sheet

| 항목 | 내용 |
|------|------|
| **Account read-only** | 이름·성·연락처(`formatPhoneDisplay`)·생일(`formatBirthdayDisplay`)·못 먹는 음식 · 미설정 「미설정」 |
| **트리거** | **「수정」** `Button` (Account 섹션 헤더 우측 또는 하단) |
| **Sheet** | `profile-password-sheet`·`user-form-sheet` 패턴 — `SheetHeader`·`SheetFooter` 저장/취소 |
| **폼** | 기존 `profile-form.tsx` 로직 **추출** → Sheet 본문 · `useAppForm` + plan 09 Zod **유지** |
| **제거** | Account 섹션 인라인 `ProfileForm` + 페이지 내 **저장** 버튼 |

---

## 활동 감사 로그 (plan 08)

> CUD 신규 Route **없음** · READ `GET /api/birthdays/this-month` **기록 Out**

| Route | action | 비고 |
|-------|--------|------|
| `PATCH /api/profile` | `profile.update` | Sheet 저장 — **기존 분기·로깅 유지** |

**AC:** #10 — Sheet 저장 후 `/dashboard/logs` **`profile.update`** 행 확인.

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/app/api/birthdays/this-month/route.ts` | **신규** GET |
| `src/features/birthday-celebrants/api/*` | **신규** feature |
| `src/app/dashboard/overview/layout.tsx` | 배너 최상단 삽입 |
| `src/features/overview/components/birthday-*` | **신규** 배너·confetti·carousel |
| `src/features/auth/components/profile-page-content.tsx` | Account read-only + 수정 버튼 |
| `src/features/auth/components/profile-edit-sheet.tsx` | **신규** (또는 `profile-form` 리팩터) |
| `src/features/auth/components/profile-form.tsx` | Sheet 전용으로 추출·정리 |
| `src/features/auth/api/mutations.ts` | `birthdayCelebrantsKeys` invalidate |
| `src/components/ui/carousel.tsx` | shadcn 추가 |
| `package.json` | `canvas-confetti` |

**패턴:** `requireSession` · `getServiceRoleClient` · React Query key factory · `useSuspenseQuery`(client refetch 시) · `Icons.*` · `cn()` · `PageContainer`

---

## 리스크 & 완화책

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | RLS로 일반 user 타인 `profiles` 조회 불가 | **전용 GET Route** + service_role · API 필드 최소화 |
| 2 | MED | 컨페티 매 방문 피로·접근성 | **세션 1회** · 생일자 있을 때만 (Q2 A) |
| 3 | MED | KST vs 서버 UTC 월 경계 | `Intl` `Asia/Seoul` 단일 헬퍼 · 단위 테스트 또는 AC 고정 데이터 |
| 4 | MED | `overview/layout.tsx` 동기 레이아웃 + async 데이터 | async 자식 `BirthdayCelebrantsSection` + `Suspense` fallback null |
| 5 | LOW | carousel·confetti 번들 | client component 격리 · dynamic import confetti **[INFERRED]** |
| 6 | LOW | 프로필 저장 후 overview 목록 stale | `patchProfileMutation.onSettled` invalidate |

---

## 구현 추정

- **범위:** ~12–16 파일 · ~400–550 LOC  
- **복잡도:** Medium  
- **예상:** ~90–120분 (BE → deps → overview → profile Sheet → verifier)  
- **체크포인트:** BE GET + KST 필터 단위 확인 후 overview UI

---

## 열린 질문

없음 (deep-interview·사용자 Q1~Q6 확정).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-06-07 | 최초 작성 (Approved) | planner |
| 2026-06-07 | BE·FE 구현 완료 · tsc/lint/build 통과 | frontend-dev |
