# Dashboard Loading Spinner 통일 기획서

> Date: 2026-07-15  
> Status: Approved  
> Author: planner  
> **선행:** [12](./12_dashboard-skeleton-mobile-sheet-quality-plan.md) (supersede · overview 외) · [25](./25_activity-logs-ui-improvement-plan.md) (pagination 회귀) · [10](./10_dashboard-birthday-profile-sheet-plan.md) (overview Out)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **12** | **supersede (부분)** — dashboard skeleton 표준은 **`/dashboard/overview` 제외** 구간에서 plan 26 Spinner 표준으로 대체. plan 12 **모바일 Sheet CTA** 절은 **유지** |
| **25** | `/dashboard/logs` pagination·filter·sort **회귀 없음** — 로딩 UI만 Spinner로 교체 |
| **10** | overview 생일 배너·parallel slot skeleton **Out** — 변경 금지 |
| **08** | CUD activity log — **본 plan Out** (Read UI만) |

---

## 한 줄 요약

`/dashboard/overview`를 **제외한** dashboard 전역에서 Read 로딩 UX를 **skeleton → shadcn `Spinner` 중앙 정렬**로 통일한다. route `loading.tsx`, `Suspense fallback`, pagination refetch, Sheet·Dialog·Popover Read 로딩을 포함하며, `core-conventions.mdc` §로딩 UI를 개정한다.

---

## 목표 & 완료 기준

- overview 경로 skeleton **변경 0건**
- In-scope dashboard Read 로딩 시 **skeleton/pulse 블록 미노출**, **`Spinner`(`role="status"`)** 중앙 노출
- `PageContainer` **pageTitle / pageDescription**은 초기·refetch 로딩 중에도 유지
- pagination·filter·sort 기존 E2E **회귀 없음**
- tsc · lint · build · Playwright AC green

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **공통 컴포넌트** | `PageLoadingSpinner` (`@/components/ui/spinner` 래핑, a11y 유지) |
| 2 | **Route `loading.tsx`** | overview 제외 6개 — `PageContainer` 헤더 + 콘텐츠 `PageLoadingSpinner` |
| 3 | **Suspense fallback** | logs, system-email-logs, contracts listing, office-snacks, react-query demo 등 |
| 4 | **Pagination refetch** | users, logs, contracts, system-email-logs — `Suspense` boundary 보강 + Spinner fallback |
| 5 | **Sheet·Dialog·Popover Read** | contract-detail-sheet, run-detail-dialog, log-user-combobox 등 |
| 6 | **Dead code 정리** | overview import 없음 확인 후 미사용 `*Skeleton` export·파일 삭제 |
| 7 | **Convention** | `.cursor/rules/core-conventions.mdc` §스켈레톤 UI → **§로딩 UI** 개정 |
| 8 | **E2E** | spinner 노출·pagination 회귀 spec |
| 9 | **데모·템플릿** | `/dashboard/*` 전부 (chat, kanban, forms, react-query 등 기존 skeleton 사용처 포함) |

### Out of Scope

| 항목 | 비고 |
|------|------|
| `/dashboard/overview/**` | layout·parallel routes·`@*` slots·생일 배너 skeleton **현状 유지** |
| Button·폼 **mutation** `isLoading` / `isPending` | 기존 Button 내 Spinner 유지 |
| API · DB · RLS 변경 | Out |
| activity log `recordActivityLog` | Out |
| shadcn `Skeleton` **primitive 삭제** | overview·sidebar 등 **잔존 사용처** 유지 |
| `SidebarMenuSkeleton` (shadcn primitive) | nav chrome, Read UX 아님 |
| Designer 3-preview gate | **불필요** — Spinner 레이아웃 spec만 designer 산출 |

---

## 활동 감사 로그

**activity log 해당 없음** — 본 plan은 **Read 로딩 UI만** 변경. 신규 mutation·`recordActivityLog` 연동 없음.

---

## UI 요구사항

### Spinner 기준 (shadcn)

- 기존 `@/components/ui/spinner` 재사용
- `Icons.spinner` + `size-4 animate-spin` + `role="status"` + `aria-label="Loading"`

### `PageLoadingSpinner` (신규)

| variant | 용도 | 스타일 |
|---------|------|--------|
| **default** | route `loading.tsx`, page Suspense | `min-h-[240px] flex items-center justify-center` |
| **fill** | listing 내부 Suspense (pagination) | `flex-1 min-h-[200px] items-center justify-center` |
| **compact** | Sheet / Dialog / Popover 본문 | `min-h-[120px] items-center justify-center` |

- 페이지 헤더(`PageContainer` title/description)는 **fallback 밖(RSC shell)** 에 두어 로딩 중에도 표시
- 콘텐츠 영역 **중앙 Spinner** — skeleton·pulse 블록 **금지**
- **툴바 유지:** 1차 목표는 page 헤더 유지; pagination 시 툴바까지 suspend되면 **best-effort** (table/toolbar 분리 Suspense는 users·logs 우선 적용)

### 교체 대상 매핑

| 현재 | 변경 후 |
|------|---------|
| `DataTableSkeleton` | `PageLoadingSpinner` |
| `FormCardSkeleton` | `PageLoadingSpinner` |
| `OfficeSnacks*Skeleton` | `PageLoadingSpinner` |
| `ActivityLogsTableSkeleton` / pulse 블록 | `PageLoadingSpinner` |
| `ContractDetailSheetSkeleton` | `PageLoadingSpinner variant="compact"` |
| `DetailSkeleton` (run-detail-dialog) | `PageLoadingSpinner variant="compact"` |
| `"불러오는 중…"` 텍스트 (combobox) | `PageLoadingSpinner variant="compact"` |
| `PokemonSkeleton` (react-query demo) | `PageLoadingSpinner` |

### overview 유지 (변경 금지)

- `overview/layout.tsx` · `@bar_stats` · `@area_stats` · `@pie_stats` · `@sales` `loading.tsx`
- `BirthdayCelebrantsBannerSkeleton` 및 graph skeleton 컴포넌트

---

## API / DB 요구사항

**해당 없음** — FE·convention 변경만.

---

## 영향 파일 (예상)

### 신규

- `src/components/ui/page-loading-spinner.tsx`

### 수정 — route

- `src/app/dashboard/contracts/loading.tsx`
- `src/app/dashboard/users/loading.tsx`
- `src/app/dashboard/profile/loading.tsx`
- `src/app/dashboard/office-snacks/loading.tsx`
- `src/app/dashboard/office-snacks/[sessionId]/loading.tsx`
- `src/app/dashboard/system-email-logs/loading.tsx`

### 수정 — page / listing / Suspense

- `src/app/dashboard/logs/page.tsx`
- `src/app/dashboard/system-email-logs/page.tsx`
- `src/app/dashboard/react-query/page.tsx`
- `src/features/contracts/components/contract-listing.tsx`
- `src/features/office-snacks/components/office-snacks-listing.tsx`
- `src/features/users/components/user-listing.tsx` (Suspense boundary 보강)

### 수정 — Sheet / Dialog / Popover

- `src/features/contracts/components/contract-detail-sheet.tsx`
- `src/features/system-email-logs/components/system-email-logs-table/run-detail-dialog.tsx`
- `src/features/activity-logs/components/log-user-combobox.tsx`

### 수정 — convention

- `.cursor/rules/core-conventions.mdc` §로딩 UI

### 삭제 후보 (overview import 없음 확인 후)

- `src/components/ui/table/data-table-skeleton.tsx`
- `src/components/form-card-skeleton.tsx`
- `src/features/office-snacks/components/office-snacks-skeleton.tsx`
- `src/features/react-query-demo/components/pokemon-skeleton.tsx`
- feature별 `*TableSkeleton` export (users, activity-logs, system-email-logs)

### E2E (신규·수정)

- `e2e/loading/spinner-unification.spec.ts` (신규)
- `e2e/users/list-readonly-regression.spec.ts` (회귀)
- `e2e/activity-logs/logs-pagination-sort.spec.ts` (회귀)

---

## 리스크 & 완화

| # | 등급 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | HIGH | overview 실수 변경 | AC #1 grep gate · PR checklist |
| 2 | HIGH | core-conventions 충돌 | plan 26과 **동시** §로딩 UI 개정 |
| 3 | MED | plan 25 pagination 회귀 | 기존 E2E 재실행 AC |
| 4 | MED | pagination 시 툴바 suspend | users·logs Suspense 분리 best-effort |
| 5 | LOW | skeleton 삭제 후 숨은 import | 삭제 전 ripgrep · tsc |

---

## Acceptance Criteria (Given-When-Then)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | grep / manual | plan 26 구현 완료 | `src/app/dashboard/overview/**` diff 확인 | skeleton·Spinner 관련 **변경 0건** |
| 2 | Playwright | admin storageState · 네트워크 정상 | `/dashboard/users` 최초 진입 | `pageTitle` 영역 「사용자 관리」표시 · 콘텐츠 영역 `getByRole('status', { name: 'Loading' })` **1개 이상** · `DataTableSkeleton` pulse 테이블 **없음** |
| 3 | Playwright | admin · users 목록 page 1 로드 완료 | pagination 「다음」 클릭 | page 헤더 「사용자 관리」유지 · 콘텐츠에 `role="status"` Spinner 노출 후 테이블 행 표시 · **앱 크래시 없음** |
| 4 | Playwright | admin | `/dashboard/contracts` 진입 | 「계약서 관리」헤더 유지 · skeleton 대신 **중앙 Spinner** |
| 5 | Playwright | 로그인 user | `/dashboard/profile` 진입 | 「프로필」헤더 유지 · `FormCardSkeleton` pulse **없음** · Spinner 노출 |
| 6 | Playwright | admin · logs 데이터 ≥2페이지 | `/dashboard/logs?log_user=self` · page 2 이동 | plan 25 pagination **동작 유지** (page 2 행 표시) · `ActivityLogsTableSkeleton` pulse **없음** |
| 7 | Playwright | admin · system-email-logs | `/dashboard/system-email-logs` 진입 | skeleton 테이블 **없음** · Spinner 노출 |
| 8 | Playwright | admin · contracts 목록 | 계약 행 클릭 → detail Sheet open | Sheet 본문 Read 중 skeleton **없음** · compact Spinner 또는 동등 |
| 9 | Playwright | admin · system-email-logs | run detail Dialog open | Dialog Read 중 skeleton **없음** · Spinner 노출 |
| 10 | Playwright | admin · overview | `/dashboard/overview` 진입 | 기존 graph/banner **skeleton UX 유지** (Spinner 전환 **없음**) |
| 11 | Playwright | admin | `/dashboard/react-query` 진입 | `PokemonSkeleton` **없음** · Spinner 노출 |
| 12 | CLI | 구현 완료 | `bunx playwright test e2e/loading e2e/users/list-readonly-regression e2e/activity-logs/logs-pagination-sort` | **전부 green** |
| 13 | CLI | 구현 완료 | tsc · lint · build | **통과** |

---

## core-conventions §로딩 UI 개정 (In)

기존 §스켈레톤 UI를 아래로 **대체·개정**:

1. 비동기 Read 경로(`loading.tsx`, `Suspense fallback`)는 **로딩 상태 필수**
2. **`/dashboard/overview`**: 기존 skeleton 재사용 유지 (`*GraphSkeleton`, `BirthdayCelebrantsBannerSkeleton` 등)
3. **그 외 `/dashboard/*`**: **`PageLoadingSpinner` / `Spinner` 우선** — skeleton·pulse 블록 fallback **금지**
4. Sheet·Dialog·Popover Read: **`PageLoadingSpinner variant="compact"`**
5. mutation Button `isLoading`: 기존 Button 내 Spinner **유지**
6. App Router: `loading.tsx` 또는 `Suspense fallback` **최소 1개** 필수

---

## 실행 순서

1. `PageLoadingSpinner` 추가
2. `core-conventions.mdc` §로딩 UI 개정
3. route `loading.tsx` 6개 교체
4. page/listing Suspense fallback 교체
5. pagination Suspense boundary (users, logs, contracts, system-email-logs)
6. Sheet/Dialog/Popover Read 교체
7. 미사용 skeleton dead code 삭제
8. E2E spec 작성·회귀 실행
9. overview diff 0 확인

---

## 열린 질문

- [TBD] pagination 시 **툴바까지** 유지할 2차 Suspense 분리 범위 (users·logs 외 contracts/system-email-logs 포함 여부)

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-07-15 | 최초 작성 (Approved) | planner |
