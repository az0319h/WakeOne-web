# 복지비 URL 필터 동기화 기획서

> Date: 2026-10-12
> Status: Approved
> Author: planner
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [40](./40_filter-shell-loading-ux-plan.md), [41](./41_user-my-contracts-plan.md), [49](./49_live-users-presence-plan.md), [63](./63_org-chart-admin-profile-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **07** | Completed | `/dashboard/benefits` admin-only · `/dashboard/my-benefits` user — **서버 가드 유지**, URL 변경만 |
| **08** | Approved | **Read-only** — activity log **해당 없음** |
| **40** | Approved | filter shell / data body 분리 — 복지비는 **본 plan Out**(후속). 현재 필터는 로딩 밖·테이블 body만 Spinner |
| **41** | Approved | `useQueryStates` + `from`/`to` — **day range 참고만**. 복지비는 **월 예산** → `month=YYYY-MM` |
| **49** | Approved | `/dashboard/benefits`, `/dashboard/my-benefits`는 `dashboard/layout` **`DashboardPresenceTrack` 상속** — 별도 track **불필요** |
| **63** | Approved | `affiliation` Tabs + `parseAsStringLiteral` + `shallow: true` — **동일 패턴 재사용** |

**중복 금지:** API Route·DB·RLS 변경 없음. `expanded` 행 펼침 URL 동기화 **금지**. plan 40 테이블 헤더 고정 **본 plan Out**.

---

## 한 줄 요약

복지비 **관리**·**내 복지비** 페이지의 탭·월·팀·이름 필터를 **nuqs**로 URL과 동기화하여 deep link·새로고침·뒤로가기가 org-chart·my-contracts와 동일하게 동작한다.

---

## 정책 확정안 (deep-interview · battle-plan)

| 항목 | 확정 |
|------|------|
| **Q1 이름 검색** | 로컬 input + **500ms debounce** 후 URL `name` 반영·제거 (`support-list-filters` 패턴) |
| **Q2 expanded** | **로컬 `useState`만** — URL **Out** |
| **Q3 소속 탭 변경** | URL에서 **`team`·`name` 제거** · 로컬 `team=all` · `expanded` 초기화 (현 UI와 동일) |
| **Q4 plan 40** | **Out** — In scope = **nuqs URL sync만** |
| **내 복지비 월** | `month=YYYY-MM` only — `from`/`to` **Out** |

---

## 목표 & 완료 기준

### 목표

- Admin `/dashboard/benefits`: `affiliation`, `month`, optional `team`, `name`이 URL과 양방향 동기화된다.
- User `/dashboard/my-benefits`: `month`가 URL과 양방향 동기화된다.
- 잘못된 query는 **폴백** 후 앱이 죽지 않는다.
- Playwright로 deep link·탭/월 변경·refresh·back을 검증한다.

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | admin 세션 | `/dashboard/benefits?affiliation=sans_foundry&month=2026-09` 직접 진입 | 제목 **「복지비 사용 현황」** · **산스파운드리** 탭 활성 · 조회 월 input 값 **2026-09** · 테이블 또는 **「조건에 맞는 구성원이 없습니다.」** 표시(로딩 후 크래시 없음) |
| AC-02 | Playwright | admin · `/dashboard/benefits` | **산스** 탭 클릭 | URL에 `affiliation=sans` 포함 · **산스** 탭 활성 |
| AC-03 | Playwright | admin · AC-02 상태에서 `team`·`name`이 URL에 있었음 | **웨이크** 탭 클릭 | URL에 `affiliation=wake`(또는 default omit 정책에 맞는 wake 표시) · URL에 **`team`·`name` 없음** |
| AC-04 | Playwright | admin · 필터 적용(URL에 `month`·`affiliation` 등 반영) | 브라우저 **새로고침** | refresh 후 **동일 query** · 탭·조회 월·팀·이름 input이 URL과 **일치** |
| AC-05 | Playwright | admin · URL을 2회 이상 변경(탭 또는 월) | 브라우저 **뒤로가기** 1회 | 이전 URL의 탭·월(·팀·이름)과 UI **일치** |
| AC-06 | Playwright | admin | `/dashboard/benefits?affiliation=not_a_value` 진입 | 크래시 없음 · **웨이크**(default) 탭 활성 |
| AC-07 | Playwright | admin | `/dashboard/benefits?month=2026-13` 진입 | 크래시 없음 · 조회 월이 **KST 당월**(`YYYY-MM`)으로 폴백 · URL이 정상 `month`로 **교정**되거나 요청이 당월 데이터로 성공(400 UI 없음) |
| AC-08 | Playwright | admin · 이름 검색 input | 3자 이상 입력 후 **500ms 이상 대기** | URL `name`에 입력값( trim ) 반영 · `expect.poll`로 `searchParams.get('name')` 검증 |
| AC-09 | Playwright | admin · URL에 `name=foo` | 이름 input 전체 삭제 후 **500ms 이상 대기** | URL에서 `name` **제거** |
| AC-10 | Playwright | user 세션 | `/dashboard/my-benefits?month=2026-08` 직접 진입 | 제목 **「내 복지비 사용 현황」** · 화면에 **「2026년 8월」** 표시 |
| AC-11 | Playwright | user · `/dashboard/my-benefits` | **다음 달** 버튼 클릭 | URL `month`가 표시 월에 맞는 `YYYY-MM`으로 갱신 |
| AC-12 | Playwright | user · AC-11 후 | **새로고침** · **뒤로가기** | AC-04·AC-05와 동일 원칙으로 `month`·표시 월 **일치** |
| AC-13 | Playwright | user | `/dashboard/my-benefits?month=invalid` 진입 | 크래시 없음 · **KST 당월** 표시 · API 400 에러 UI **없음** |
| AC-14 | Playwright | admin | `/dashboard/benefits` 기존 AC(탭·컬럼·이름 placeholder 등) | `e2e/benefits/admin.spec.ts` 기존 시나리오 **회귀 없음** |
| AC-15 | Playwright | user | `/dashboard/my-benefits` 기존 AC | `e2e/benefits/my-benefits.spec.ts` 기존 시나리오 **회귀 없음** |

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **Admin FE** | `benefits-admin-dashboard.tsx` — `useState` 필터 제거 → feature-local **nuqs** hook |
| 2 | **My FE** | `my-benefits-dashboard.tsx` — `month` nuqs 동기화 · prev/next가 URL 갱신 |
| 3 | **파서·폴백** | `affiliation` literal · `month` `YYYY-MM` · invalid → default · `team`/`name` 빈값 → param 제거 |
| 4 | **Debounced name** | `useDebouncedCallback` **500ms** · `support-list-filters.tsx`와 동일 책임 분리 |
| 5 | **Affiliation change** | `setParams({ affiliation, team: null, name: null })` + 로컬 expanded reset |
| 6 | **E2E** | `e2e/benefits/admin.spec.ts`, `e2e/benefits/my-benefits.spec.ts` — AC-01~15 반영·분리 test 권장 |
| 7 | **React Query** | 기존 `benefitsAdminQueryOptions` / `myBenefitsQueryOptions` · `keepPreviousData` **유지** (`useQuery` 전환 Suspense **Out**) |

### Out of Scope

| 항목 | 비고 |
|------|------|
| **백엔드·DB·RLS** | `GET /api/benefits`, `GET /api/my-benefits` **변경 없음** |
| **plan 40 shell/body** | 테이블 헤더 refetch 시 고정 — **별도 후속** |
| **URL `expanded`** | 로컬 state only |
| **내 복지비 `from`/`to`** | 월 단위 도메인 |
| **RSC `searchParamsCache` 확장** | prefetch 없음 — **클라이언트 nuqs만** (전역 `searchparams.ts`에 `month` 추가 **불필요**) |
| **kbar deep link** | nav URL만 유지 (plan 31) |
| **SEO canonical** | dashboard (plan 46) |

---

## URL Query 스키마

| 페이지 | Param | 파서 / 규칙 | 기본값 | 비고 |
|--------|-------|-------------|--------|------|
| Admin | `affiliation` | `parseAsStringLiteral(['wake','sans','sans_foundry']).withDefault('wake')` | `wake` | invalid → `wake` |
| Admin | `month` | custom: `^\d{4}-\d{2}$` + month 1–12 | KST 당월 (`currentKstMonth`) | invalid → default + URL 교정 |
| Admin | `team` | `parseAsString` | — | `all`/빈값 → **null**(omit) · API는 omit 시 전체 팀 |
| Admin | `name` | `parseAsString` | — | trim 빈값 → **null** · **debounce 500ms** |
| My | `month` | Admin과 동일 | KST 당월 | prev/next → `setParams({ month })` |

**`shallow: true`** — org-chart · my-contracts와 동일.

**Default omit:** nuqs `setParams`에서 default와 동일한 값은 `null`로 제거하는 패턴 권장(북마크 URL 최소화). `affiliation=wake` omit 여부는 org-chart 동작과 **일치**시킨다.

---

## 활동 감사 로그

**activity log 해당 없음** — Read UI·URL 동기화만. 신규 mutation·`recordActivityLog` **없음**.

---

## 영향 파일 & 패턴

### 영향 파일 (예상)

| 파일 | 변경 |
|------|------|
| `src/features/benefits/components/benefits-admin-dashboard.tsx` | nuqs hook 사용 · debounced name · affiliation change reset |
| `src/features/benefits/components/my-benefits-dashboard.tsx` | `month` nuqs |
| `src/features/benefits/components/use-benefits-admin-filters.ts` (신규 권장) | `useQueryStates` + 파서 · filters 객체 for queryKey |
| `src/features/benefits/components/use-my-benefits-month.ts` (신규 권장) | `month` parser + hook |
| `e2e/benefits/admin.spec.ts` | URL AC |
| `e2e/benefits/my-benefits.spec.ts` | URL AC |

**변경 없음:** `src/app/api/benefits/route.ts`, `src/app/api/my-benefits/route.ts`, `queries.ts`, `service.ts`.

### FE 구현 노트

1. **Hook 파일 패턴** — `org-chart-tabs.tsx`의 `useOrgChartAffiliation` + `support-list-filters.tsx`의 `useSupportListFilterParams` / debounced search를 합친 형태.
2. **`KST month`** — 기존 `currentKstMonth()` / `KST_MONTH_FORMATTER` **재사용** (dashboard와 서버 `monthRange` 정합).
3. **`team` Select** — URL 값이 현재 응답 `teams` 목록에 없으면(소속 변경 직후 등) Select는 **「전체 팀」** · API 필터는 team omit.
4. **`expanded`** — `useState<Set<string>>` **유지** · affiliation 변경 시 `new Set()` (URL 미반영).
5. **Query key** — hook에서 derived `BenefitsAdminFilters`를 `benefitsAdminQueryOptions`에 전달 (기존과 동일 shape).
6. **Page RSC** — benefits pages는 `searchParams` parse **필수 아님** (클라이언트 fetch only).

### plan 40 평가 (문서화)

| 페이지 | 현재 | plan 73 | plan 40 후속 |
|--------|------|---------|----------------|
| Admin benefits | 필터 shell은 `query.isLoading` 밖 · **테이블 헤더는 로딩 시 숨김** | 변경 없음 | 헤더를 shell로 분리 가능 |
| My benefits | 카드 body만 Spinner | 변경 없음 | 필요 시 동일 패턴 |

---

## API / DB 요구사항

**BE Out.** 기존 query params:

- `GET /api/benefits` — `month`, `affiliation`, `team`, `name`
- `GET /api/my-benefits` — `month`

잘못된 `affiliation` → 400 · 잘못된 `month` → 400 — **클라이언트 폴백으로 FE가 400 경로 회피**.

---

## 리스크 & 완화책

| # | 수준 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | MED | debounce E2E flake | `expect.poll` + 500ms+ buffer · users list 패턴 |
| 2 | LOW | invalid `team` in URL after tab change | affiliation change 시 team/name clear (AC-03) |
| 3 | LOW | URL·input drift on fast typing | 로컬 `nameInput` state + debounced `setParams` |

---

## 추정

| 항목 | 값 |
|------|-----|
| 범위 | ~4–6 FE 파일 · 2 E2E 파일 |
| 복잡도 | **Simple–Medium** |
| 예상 | ~60–90분 (FE + E2E) |
| designer | **생략 가능** — 기존 UI·레이아웃 유지 |

---

## E2E 변경 요약

| 파일 | 추가 내용 |
|------|-----------|
| `e2e/benefits/admin.spec.ts` | deep link AC-01,06,07 · tab AC-02,03 · refresh/back AC-04,05 · name debounce AC-08,09 |
| `e2e/benefits/my-benefits.spec.ts` | deep link AC-10 · next month AC-11 · refresh/back AC-12 · invalid month AC-13 |

셀렉터: `getByRole`, `getByLabel`, `getByPlaceholder` — `new URL(page.url()).searchParams` poll.

---

## 열린 질문

없음 (deep-interview·battle-plan 확정).

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-12 | 최초 작성 · Approved | planner |
