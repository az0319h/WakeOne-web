# Admin 내 복지비 타인 조회(Proxy) 기획서

> Date: 2026-10-12
> Status: In Progress
> Author: planner
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [40](./40_filter-shell-loading-ux-plan.md), [41](./41_user-my-contracts-plan.md), [49](./49_live-users-presence-plan.md), [73](./73_benefits-url-filters-plan.md), wallet `WalletUserCombobox` / `GET /api/wallet` proxy 패턴

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **07** | Completed | nav는 UX — **page·API 서버 가드** 필수 |
| **08** | Approved | **Read-only** — activity log **해당 없음** |
| **40** | Approved | my-benefits body `PageLoadingSpinner variant="fill"` **유지** |
| **41** | Approved | admin은 **내 계약서** redirect 유지 — 본 plan은 **wallet 패리티**로 내 복지비만 admin 허용 |
| **49** | Approved | `/dashboard/my-benefits`는 `dashboard/layout` **`DashboardPresenceTrack` 상속** — 별도 track **불필요** |
| **73** | Approved | `month` nuqs **유지·통합**. plan 73 「`GET /api/my-benefits` 변경 없음」은 본 plan에서 **supersede** (admin `user` query **In**) |

**중복 금지:** `/dashboard/benefits` org-wide admin 테이블·`GET /api/benefits` **변경 없음**. 복지비 CUD·Flex sync **없음**.

---

## 한 줄 요약

admin이 Account **「내 복지비」**(`/dashboard/my-benefits`)에서 식대 카드와 동일하게 **사용자 Combobox + URL `benefits_user`**로 타인의 월별 복지비(Read-only)를 조회하고, `GET /api/my-benefits`에 wallet과 같은 **admin `user` proxy**를 추가한다.

---

## 정책 확정안 (deep-interview · battle-plan)

| 항목 | 확정 |
|------|------|
| **라우트·nav (Q1)** | **옵션 A** — 단일 `/dashboard/my-benefits`, nav 「내 복지비」 **admin+user 공통** |
| **카피·헤더 (Q2)** | 페이지 제목·설명 **변경 없음**; 카드 헤더는 **조회 대상 사용자** `full_name · rank · position_level` |
| **Combobox (Q3)** | **wallet 동일** — `WalletUserCombobox`·users listing·admin 선택 가능 · default **`benefits_user=self`** · API query **`user`** |
| **non-admin proxy** | wallet 동일 — `user` query **무시**, 항상 **viewer 본인** 데이터 (403 아님) |
| **URL** | plan 73 **`month=YYYY-MM`** + **`benefits_user`** (uuid 또는 `self`) · `shallow: true` |
| **Activity log** | GET만 — **해당 없음** |

---

## 목표 & 완료 기준

### 목표

- admin sidebar·kbar에 **「내 복지비」**가 노출되고 `/dashboard/my-benefits` 접근이 가능하다.
- admin은 **WalletUserCombobox**로 조회 대상을 바꾸고 URL `benefits_user`와 동기화된다.
- `month`(plan 73)와 `benefits_user`를 함께 deep link·refresh·back 할 수 있다.
- user 동작(본인 조회·plan 73 URL·plan 73 E2E) **회귀 없음**.
- `/dashboard/benefits`·`GET /api/benefits` **회귀 없음**.

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | `system_role=admin` | dashboard sidebar Account 확인 | **「내 복지비」** link가 보인다 |
| AC-02 | Playwright | admin | `/dashboard/my-benefits` 진입 | 제목 **「내 복지비 사용 현황」** · 설명 **「월별 10만원 예산과 신청 내역을 확인합니다.」** · **사용자 선택** combobox(placeholder **「사용자 선택」**)가 보인다 |
| AC-03 | Playwright | admin · `E2E_BENEFIT_INTEGRATION=1` · fixture user U의 복지 데이터 존재 | combobox에서 U 선택 | URL에 `benefits_user=<U의 user_id>` · 카드 헤더에 **U의 `full_name`**(·팀·직급 있으면 ` · ` 구분) · U의 월 사용 합계 UI(예: integration 시 **120,000원 사용 / 100,000원**) |
| AC-04 | Playwright | admin · AC-03 상태 | combobox에서 **「본인」** 선택 | URL `benefits_user=self`(또는 omit 정책에 맞게 default) · 헤더가 **admin 본인** 프로필 표시 |
| AC-05 | Playwright | admin | `/dashboard/my-benefits?month=2026-08&benefits_user=self` 직접 진입 | 제목 유지 · 상단 월 네비에 **2026년 8월** · combobox **본인** · 크래시 없음 |
| AC-06 | Playwright | admin · URL을 combobox·월로 2회 이상 변경 | 브라우저 **뒤로가기** 1회 | 이전 `month`·`benefits_user`와 UI **일치** (plan 73 AC-12 원칙) |
| AC-07 | Playwright | `system_role=user` | `/dashboard/my-benefits?benefits_user=<다른 user uuid>` 직접 진입 | **본인** 데이터만 표시(combobox **없음**) · URL의 `benefits_user`는 **무시되어도 됨**(서버가 viewer 고정) |
| AC-08 | Playwright | user | `my-benefits.spec.ts`·`my-benefits-url-filters.spec.ts` | plan 73·기존 user AC **회귀 없음** |
| AC-09 | Playwright | user | sidebar | **「복지비 관리」** link **없음** · `/dashboard/benefits` 직접 접근 시 overview redirect **유지** |
| AC-10 | Playwright | admin | `/dashboard/benefits` | plan 73 admin AC **회귀 없음** |
| AC-11 | API | user 세션 · 본인 데이터 응답 R0 | `GET /api/my-benefits?month=YYYY-MM&user=<타인 uuid>` | HTTP **200** · body `data`가 R0과 **동일**(proxy 불가) |
| AC-12 | API | admin 세션 · active user U · U의 해당 월 데이터 D | `GET /api/my-benefits?month=YYYY-MM&user=<U uuid>` | HTTP **200** · `data`가 U 기준 **D**와 일치 |
| AC-13 | API | admin 세션 | `GET /api/my-benefits?month=YYYY-MM` 또는 `user=self` | HTTP **200** · **admin viewer 본인** user_id 기준 데이터 |
| AC-14 | Playwright | admin | ⌘K → **「내 복지비」** (plan 31 RBAC) | `/dashboard/my-benefits` 이동 |

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **Nav** | `nav-config.ts` 「내 복지비」`access: { systemRole: "user" }` **제거** — wallet 「식대 카드」와 동일 **무 access** (로그인 dashboard 사용자) |
| 2 | **Page** | `my-benefits/page.tsx` — admin redirect **제거** · `requireDashboardSession` · `isAdmin` + viewer 프로필을 wrapper에 전달 |
| 3 | **FE wrapper** | `MyBenefitsPageContent` (신규, wallet `WalletPageContent` 패턴) — admin일 때 `WalletUserCombobox` · nuqs **`benefits_user`** default `self` |
| 4 | **FE dashboard** | `MyBenefitsDashboard` — `month` + **target API `user`** query key/fetch · 헤더 프로필은 **대상 사용자**(admin 타인: `usersQueryOptions({ userId })` 등) |
| 5 | **nuqs** | plan 73 `month` hook과 **`benefits_user`** 통합 또는 page wrapper에서 병렬 `useQueryStates` · invalid `month` 폴백 **유지** |
| 6 | **BE** | `GET /api/my-benefits` only — `requireSession` · admin `user` query · `resolveBenefitsTargetUserId` → `getMyBenefits(targetUserId, month)` |
| 7 | **Client service** | `fetchMyBenefits(month, user?)` · `myBenefitsQueryOptions(month, user?)` · queryKey에 admin target 반영 |
| 8 | **E2E** | `e2e/benefits/my-benefits-admin-proxy.spec.ts` (신규 권장) + 기존 spec 회귀 · API spec AC-11~13 |
| 9 | **Presence** | `dashboard/layout` 하위 — **DashboardPresenceTrack 상속** (추가 코드 없음) |

### Out of Scope

| 항목 | 비고 |
|------|------|
| `GET /api/benefits` · `/dashboard/benefits` UI | org-wide 테이블 **유지** |
| DB·RLS·Flex sync | 변경 없음 |
| 신규 Route·CUD | activity log **없음** |
| `WalletUserCombobox` → generic 추출 | **선택** — 동 컴포넌트 import로 충분 시 추출 **Out** |
| RSC `searchParamsCache` / wallet급 SSR prefetch | plan 73 정책 유지 — **클라이언트 `useQuery` + nuqs** (선택적 prefetch **Out**) |
| plan 40 filter shell | **Out** |
| admin `/dashboard/my-contracts` | plan 41 **유지** (redirect) |

---

## 권한 / RBAC

| 대상 | admin | user |
|------|-------|------|
| nav 「내 복지비」 | ✅ | ✅ |
| nav 「복지비 관리」 | ✅ | ❌ |
| `/dashboard/my-benefits` | ✅ (+ combobox) | ✅ (본인만) |
| `/dashboard/benefits` | ✅ | redirect overview |
| `GET /api/my-benefits` | ✅ + optional `user` | ✅ · `user` **무시** |
| `GET /api/benefits` | ✅ | **403** |

---

## URL Query 스키마

| Param | 파서 / 규칙 | 기본값 | 비고 |
|-------|-------------|--------|------|
| `month` | plan 73 `parseAsBenefitsMonth` | KST 당월 | invalid → 교정·폴백 **유지** |
| `benefits_user` | `parseAsString.withDefault('self')` | `self` | admin만 UI·API에 반영; uuid = 타인 user_id |

**API query (wallet 패리티):** `user` — admin만 읽음 · 값 `self` 또는 uuid · non-admin 전달 시 **무시**.

**예:** `/dashboard/my-benefits?month=2026-08&benefits_user=<uuid>`

---

## API / Service Layer

### Route — `GET /api/my-benefits`

1. `requireSession()` ( **`requireUserSession` 제거** )
2. `isAdmin = profile.system_role === 'admin'`
3. `requestedUser = isAdmin ? (searchParams.get('user') ?? 'self') : null`
4. `targetUserId = resolveBenefitsTargetUserId(viewerUserId, isAdmin, requestedUser)` — wallet `resolveWalletTargetUserId`와 **동일 semantics**
5. `getMyBenefits(targetUserId, month)` — 기존 service **재사용**

**변경 없음:** `GET /api/benefits/route.ts`, admin benefits service.

### Client

- `fetchMyBenefits(month, user?: string)` — admin이고 `user`가 있으면 query에 `user` 포함 (`self` 포함 wallet과 동일)
- `benefitKeys.mine(month, proxyUser?)` — admin proxy 시 cache 분리

### 활동 감사 로그

**activity log 해당 없음** — Read-only GET 확장. `recordActivityLog` **추가 없음**.

---

## UI 요구사항 (designer)

- **레이아웃:** wallet과 동일 — admin만 우측 상단 **사용자 선택** combobox · 그 아래 기존 월 네비·카드·신청 내역.
- **헤더:** 카드 `CardHeader` 한 줄 — `{fullName} · {team} · {positionLevel}` (null 필드 omit) · 우측 `monthLabel` **유지**.
- **제목/설명:** `PageContainer` **고정** (user·admin·proxy 공통).
- **로딩:** 기존 `PageLoadingSpinner variant="fill"` · combobox는 shell 밖(wallet 동일).
- **아이콘·컴포넌트:** `WalletUserCombobox` 재사용 · `Icons` from `@/components/icons`.

---

## 영향 파일 & 패턴 (예상)

| 파일 | 변경 |
|------|------|
| `src/config/nav-config.ts` | 내 복지비 `access` 제거 |
| `src/app/dashboard/my-benefits/page.tsx` | admin redirect 제거 · wrapper + viewer profile |
| `src/features/benefits/components/my-benefits-page-content.tsx` | **신규** — combobox + nuqs `benefits_user` |
| `src/features/benefits/components/my-benefits-dashboard.tsx` | target user fetch + query options |
| `src/features/benefits/hooks/use-my-benefits-month.ts` | `benefits_user` 병합 또는 wrapper 전용 hook |
| `src/features/benefits/api/queries.ts` | `mine(month, user?)` |
| `src/features/benefits/api/service.ts` | `fetchMyBenefits` + `user` |
| `src/features/benefits/api/service.server.ts` | `resolveBenefitsTargetUserId` (+ optional `getMyBenefitsForViewer`) |
| `src/app/api/my-benefits/route.ts` | `requireSession` + admin `user` |
| `e2e/benefits/my-benefits-admin-proxy.spec.ts` | **신규** |
| `e2e/benefits/my-benefits-proxy.api.spec.ts` | **신규** (AC-11~13) |
| `playwright.config.ts` | 신규 spec project 매핑 (기존 benefits 패턴 따름) |

**참조:** `wallet-page-content.tsx`, `wallet/route.ts`, `service.server.ts` `resolveWalletTargetUserId`.

---

## 리스크 & 완화책

| # | 수준 | 리스크 | 완화 |
|---|------|--------|------|
| 1 | MED | admin `self` 복지 데이터 빈 화면 | wallet과 동일 UX · AC-04 명시 |
| 2 | MED | plan 73 E2E + proxy URL flake | `expect.poll` on `searchParams` · integration flag로 데이터 AC 분리 |
| 3 | LOW | IDOR via `user=` | non-admin 무시 + service role 조회 전 target 확정 |
| 4 | LOW | 헤더 프로필 로딩 지연 | users query + combobox label 패턴 · 로딩 중 fallback label |

---

## 추정

| 항목 | 값 |
|------|-----|
| 범위 | ~8–12 파일 · 2 E2E (+ API spec) |
| 복잡도 | **Medium** |
| 예상 | ~90–120분 (BE + FE + E2E) |
| designer | **경량** — wallet 패리티, 신규 시각 요소 없음 |

---

## E2E 변경 요약

| 파일 | 내용 |
|------|------|
| `e2e/benefits/my-benefits-admin-proxy.spec.ts` | AC-01~06, AC-14 |
| `e2e/benefits/my-benefits-proxy.api.spec.ts` | AC-11~13 |
| 기존 `my-benefits*.spec.ts` | 회귀 (AC-08) |

셀렉터: `getByRole` · `getByPlaceholder` · `getByTestId` — `new URL(page.url()).searchParams` poll.

---

## 열린 질문

없음.

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-12 | 최초 작성 · Approved (Q1 A · Q2 a · Q3 wallet 동일) | planner |
