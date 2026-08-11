# Filter Shell Loading UX 기획서

> Date: 2026-08-11  
> Status: Approved  
> Author: planner  
> **선행:** [26](./26_loading-spinner-unification-plan.md) (TBD 후속) · [25](./25_activity-logs-ui-improvement-plan.md) · [27](./27_in-app-notifications-user-update-plan.md) · [39](./39_announcements-plan.md)

## Filter Shell / Data Body 원칙 (필수)

> **Filter Shell / Data Body 원칙:** 페이지 chrome·필터·툴바·combobox·tabs·admin CTA 등 **데이터 fetch와 무관한 UI**는 query refetch(필터·pagination·sort·scope combobox 변경) 시에도 **항상 표시**한다. **새 데이터 fetch가 필요한 영역**(테이블 body·infinite list 본문·pagination refetch 대상 목록)만 `PageLoadingSpinner` fallback을 허용한다.

---

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **26** | Approved | **직접 후속** — Spinner 통일 완료. line 88·227 「툴바 Suspense 분리 TBD」**본 plan이 구현** |
| **25** | Approved | `/dashboard/logs` pagination·filter·sort **회귀 금지** — admin Combobox shell 분리 |
| **27** | Approved | `/dashboard/notifications` — `notif_user` Combobox·Tabs·infinite list shell/body 분리 |
| **39** | Approved | `/dashboard/announcements` — 필터 shell + infinite list body 분리 · `isFetchingNextPage` compact Spinner **유지** |
| **12** | Approved | 모바일 Sheet CTA 규칙 **유지** (본 plan과 무충돌) |
| **08** | Approved | CUD activity log — **본 plan Out** (Read UI만) |

**중복 금지:** API·DB 변경 없음. `useQuery`+placeholderData 전환 **Out** — wallet Suspense 분리 패턴이 표준.

---

## 한 줄 요약

dashboard listing에서 queryKey 변경 시 **필터 shell까지 Spinner로 교체**되는 UX를 고치고, wallet 패턴(Filter Shell / Data Body Suspense)을 6개 listing(+ wallet 정합)에 적용하며 `core-conventions.mdc` §로딩 UI에 표준을 codify한다.

---

## 목표 & 완료 기준

- In-scope 페이지에서 필터·pagination·sort·scope combobox 변경 시 **Filter Shell / Data Body 원칙** 준수
- plan 25 logs pagination/sort·plan 39 announcements infinite scroll **기능 회귀 없음**
- `core-conventions.mdc` §로딩 UI — **Filter Shell / Data Body Suspense** 패턴 추가
- E2E: users·logs·announcements 핵심 AC green + `spinner-unification.spec.ts` 회귀 확장 green
- tsc · lint · build green

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **표준 패턴** | wallet `wallet-page-content.tsx` — Combobox·필터 **Suspense 밖**, data body **Suspense 안** + `key={querySignature}` |
| 2 | **DataTable listing** | users, logs, contracts, system-email-logs — shell(툴바·combobox·날짜필터·bulk CTA) / body(테이블 rows·pagination refetch) 분리 |
| 3 | **Infinite listing** | notifications(combobox·tabs·CTA shell), announcements(필터·admin CTA shell) |
| 4 | **wallet** | combobox shell 유지 · convention reference impl 정합 |
| 5 | **Convention** | `.cursor/rules/core-conventions.mdc` §로딩 UI 개정 |
| 6 | **E2E** | `e2e/loading/filter-shell-loading.spec.ts` 신규 + `spinner-unification.spec.ts` shell 가시성 AC 확장 |
| 7 | **회귀** | `logs-pagination-sort`, `list-readonly-regression`, `list-infinite-scroll` green |

### Out of Scope

| 항목 | 비고 |
|------|------|
| **백엔드·DB·RLS·API Route** | 요청 URL·응답·스키마 **변경 없음** — React Suspense 경계·FE 코드만 |
| `/dashboard/overview/**` | plan 26·10 skeleton **현状 유지** |
| Sheet·Dialog·Popover Read | plan 26 compact Spinner **유지** |
| `useQuery` + `placeholderData` | Suspense 분리 패턴 **표준** — 대안 Out |
| mutation Button `isPending` | Out |
| designer 3-preview gate | **불필요** — 경계 이동만 |

---

## 활동 감사 로그

**activity log 해당 없음** — 본 plan은 **Read 로딩 UI(Suspense 경계)** 만 변경. 신규 mutation·`recordActivityLog` 연동 없음.

---

## UI 요구사항

### Filter Shell / Data Body Suspense (표준)

참조: `src/features/wallet/components/wallet-page-content.tsx`

```
┌─ PageContainer (pageTitle · pageDescription — plan 26 유지) ─┐
│  ┌─ Filter Shell (Suspense 밖, 항상 표시) ─────────────────┐  │
│  │  Combobox · DataTableToolbar · tabs · 필터 row · admin CTA │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌─ Data Body (Suspense 안, key=querySignature) ───────────┐  │
│  │  PageLoadingSpinner variant="fill" → 테이블 rows / list   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

| 구분 | Suspense | Spinner variant |
|------|----------|-----------------|
| **Filter Shell** | **밖** — suspend/fallback **금지** | 없음 |
| **Data Body** — filter·pagination·sort·combobox scope 변경 | **안** — `key={querySignature}` | `fill` |
| **Data Body** — infinite scroll **다음 페이지** | body 내부 | `compact` (plan 39 AC 11a **유지**) |
| **초기 route 진입** | `loading.tsx` 또는 page Suspense | `default` / `fill` (plan 26) |

### 페이지별 shell / body 매핑

| 페이지 | Filter Shell (유지) | Data Body (Spinner만) |
|--------|---------------------|------------------------|
| `/dashboard/users` | `DataTableToolbar` (검색·역할 등) | 테이블 rows + pagination |
| `/dashboard/logs` | `LogUserCombobox` + `DataTableToolbar` | `activity-logs-table` rows |
| `/dashboard/contracts` | `ContractDateRangeFilter`, `ContractBulkDownloadButton`, `DataTableToolbar` | `DataTable` body rows |
| `/dashboard/system-email-logs` | `DataTableToolbar` | table rows |
| `/dashboard/notifications` | `NotifUserCombobox`, Tabs(전체/읽지 않음/읽음), 「모두 읽음」 | tab별 `NotificationInfiniteList` |
| `/dashboard/announcements` | `AnnouncementsListFilters`, admin 「공지 작성」 | `AnnouncementInfiniteList` |
| `/dashboard/wallet` | `WalletUserCombobox` (기존) | summary card + `WalletSyncLog` |

### notifications Tabs 카운트

Tabs 라벨(전체/읽지 않음/읽음) **chrome은 shell** — refetch 중에도 **가시**. 카운트 숫자는 **stale 표시 허용**(fetch 무관 UI 우선).

### DataTableToolbar 결합 (구현 가이드)

`DataTableToolbar`는 `useDataTable` → `useSuspenseQuery` data에 결합됨. FE는 users spike 후 아래 중 하나로 shell 분리:

- column defs·nuqs 기반 필터만 shell에 두고 body suspend, 또는
- toolbar chrome은 shell에 유지·body suspend 시 column visibility는 defs 기반으로 동작

---

## API / DB 요구사항

**해당 없음 (Out)** — Supabase·Route Handler·RLS·스키마 **변경 없음**. 브라우저 React 컴포넌트 Suspense 경계만 수정.

---

## 영향 파일 (예상)

### Convention

- `.cursor/rules/core-conventions.mdc` — §로딩 UI Filter Shell / Data Body 절

### Feature

- `src/features/users/components/users-table/index.tsx`
- `src/features/activity-logs/components/activity-logs-table/index.tsx`
- `src/features/contracts/components/contracts-table/index.tsx`
- `src/features/system-email-logs/components/system-email-logs-table/index.tsx`
- `src/features/notifications/components/notifications-page.tsx`
- `src/features/announcements/components/announcements-page.tsx`
- `src/features/announcements/components/announcement-infinite-list.tsx`
- `src/features/wallet/components/wallet-page-content.tsx` (reference 정합)

### Page / Listing (이중 Suspense 정리)

- `src/app/dashboard/users/page.tsx`
- `src/app/dashboard/logs/page.tsx`
- `src/features/contracts/components/contract-listing.tsx`
- `src/app/dashboard/system-email-logs/page.tsx`
- `src/app/dashboard/notifications/page.tsx`
- `src/app/dashboard/announcements/page.tsx`

### E2E

- `e2e/loading/filter-shell-loading.spec.ts` (신규)
- `e2e/loading/spinner-unification.spec.ts` (shell 가시성 AC 확장)
- 회귀: `e2e/activity-logs/logs-pagination-sort.spec.ts`, `e2e/users/list-readonly-regression.spec.ts`, `e2e/announcements/list-infinite-scroll.spec.ts`

---

## 리스크 & 완화

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | `DataTableToolbar` ↔ table data 결합 | users spike → 패턴 확정 → 4 DataTable 페이지 복제 |
| 2 | HIGH | notifications Tabs 카운트가 suspend data 의존 | shell에 Tabs chrome 유지 · stale count 허용(AC 명시) |
| 3 | MED | page·listing **이중 Suspense** | RSC page Suspense = 초기 진입만 · client refetch = inner Body Suspense |
| 4 | MED | plan 25 pagination 회귀 | `logs-pagination-sort.spec.ts` 필수 green |
| 5 | LOW | infinite next-page compact vs filter refetch fill 혼동 | convention 표 분리 · plan 39 AC 11a 유지 |

---

## 실행 순서

1. users `UsersTable` spike — Shell/Body 분리 POC
2. logs · contracts · system-email-logs DataTable listing 적용
3. notifications · announcements infinite listing 적용
4. wallet convention 정합
5. `core-conventions.mdc` §로딩 UI 개정
6. E2E spec 작성·회귀 실행
7. tsc · lint · build · verifier

---

## Acceptance Criteria (Given-When-Then)

### 공통 원칙 AC

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| P | Playwright · manual | In-scope listing 페이지 로드 완료 | 필터·pagination·sort·scope combobox 중 **하나** 변경 (해당 API `route` delay ≥1.5s) | **Filter Shell / Data Body 원칙** — shell UI **가시** · `getByRole('status', { name: 'Loading' })`는 **목록(body) 영역에만** · shell이 Spinner로 **교체되지 않음** · 앱 크래시 없음 |

### 핵심 E2E — users

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin storageState · `/dashboard/users` page 1 로드 | 검색 input에 값 입력(debounce 후) 또는 역할 필터 변경 · `/api/users` delay ≥1.5s | `getByRole('heading', { name: '사용자 관리' })` **가시** · `DataTableToolbar` 영역(검색 placeholder 「Filter names…」 또는 동등) **가시** · `getByRole('columnheader', { name: /이름/ })` **비가시 또는 body Spinner 구간** · shell Combobox/툴바가 `role="status"` Loading으로 **교체되지 않음** |
| 2 | Playwright | admin · users page 1 · total > perPage | pagination 「Go to next page」 클릭 · `/api/users` delay ≥1.5s | page 헤더 「사용자 관리」·툴바 **가시** · body에 Spinner 노출 후 page 2 `columnheader` 「이름」**가시** · plan 26 AC-03 회귀 |

### 핵심 E2E — logs

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 3 | Playwright | admin · `/dashboard/logs?log_user=self` 로드 | admin `LogUserCombobox`에서 「전체」(또는 다른 사용자) 선택 · `/api/activity-logs` delay ≥1.5s | `getByRole('heading', { name: '활동 로그' })` **가시** · Combobox trigger **가시** · `getByTestId('activity-logs-table')` 영역 Spinner 또는 rows 교체 · Combobox가 Spinner로 **교체되지 않음** |
| 4 | Playwright | admin · logs page 1 · pagination 가능 | sort 컬럼 클릭 또는 「Go to next page」 · API delay ≥1.5s | Combobox·툴바 **가시** · 테이블 body만 Spinner → plan 25 pagination **동작 유지** (`logs-pagination-sort` green) |

### 핵심 E2E — announcements

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 5 | Playwright | admin · `/dashboard/announcements` 로드 | `announcements-search-input`에 검색어 입력(debounce 후) · `/api/announcements` delay ≥1.5s | `getByTestId('announcements-list-filters')` **가시** · admin `announcement-create-button` **가시** · `announcements-infinite-list` 영역 Spinner · 필터 행이 Spinner로 **교체되지 않음** |
| 6 | Playwright | admin · announcements 목록 | `announcements-priority-filter`에서 중요도 토글 · API delay ≥1.5s | 필터 행 **가시** · list body Spinner → 필터 결과 행 또는 empty state |

### 회귀 확장 — spinner-unification

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 7 | Playwright | admin · users page 1 pagination 가능 | AC-03과 동일(next page + delay) | refetch 중 **툴바 또는 검색 input 가시** (plan 26 AC-03 **보강**) |
| 8 | Playwright | admin · logs self pagination 가능 | AC-06과 동일(page 2 + delay) | refetch 중 **`log_user` Combobox 또는 툴바 가시** (plan 26 AC-06 **보강**) |

### In-scope 구현 AC (E2E smoke / manual)

| # | 페이지 | Given | When | Then |
|---|--------|-------|------|------|
| 9 | contracts | admin · `/dashboard/contracts` | 날짜필터 또는 검색 변경 · API delay | 「문서승인일」필터·bulk download·툴바 **가시** · 테이블 body만 Spinner · plan 26 AC-04 회귀 |
| 10 | system-email-logs | admin · `/dashboard/system-email-logs` | 검색 또는 pagination · API delay | 툴바 **가시** · table body만 Spinner · plan 26 AC-07 회귀 |
| 11 | notifications | admin · `/dashboard/notifications` | `notif_user` Combobox 변경 · API delay | Combobox·Tabs(전체/읽지 않음/읽음) **가시** · infinite list body만 Spinner |
| 12 | wallet | admin · `/dashboard/wallet` | `wallet_user` Combobox 변경 · API delay | Combobox **가시** · summary/sync log body만 Spinner |

### infinite scroll (plan 39 유지)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 13 | Playwright | 공지 11건+ | `/dashboard/announcements` 하단 scroll | **filter 변경이 아닌** next page fetch 시 하단 **`PageLoadingSpinner variant="compact"`** · plan 39 AC 11a **회귀** |

### CLI

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 14 | CLI | 구현 완료 | `bunx playwright test e2e/loading e2e/users/list-readonly-regression e2e/activity-logs/logs-pagination-sort e2e/announcements/list-infinite-scroll` | **전부 green** |
| 15 | CLI | 구현 완료 | tsc · lint · build | **통과** |

### overview (회귀)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 16 | Playwright | admin | `/dashboard/overview` 진입 | plan 26 AC-10 — graph/banner skeleton UX **유지** · 본 plan 변경 **0건** |

---

## core-conventions §로딩 UI 개정 (In)

plan 26 §로딩 UI에 아래 **추가**:

7. **Filter Shell / Data Body:** dashboard listing에서 query refetch 시 **fetch와 무관한 UI**(필터·툴바·combobox·tabs·admin CTA)는 Suspense **밖**. **데이터 body만** `<Suspense key={querySignature} fallback={<PageLoadingSpinner variant="fill" />}>` 안에 둔다. 참조: `wallet-page-content.tsx`.
8. **infinite scroll next page:** filter/queryKey 변경 ≠ `isFetchingNextPage` — 후자는 body 내부 **`variant="compact"`** (plan 39).

---

## 열린 질문

- 없음 (deep-interview·battle-plan에서 확정)

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-08-11 | 최초 작성 (Approved) | planner |
