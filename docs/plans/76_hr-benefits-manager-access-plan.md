# 웨이크 인사팀 복지비 관리 접근 기획서

> Date: 2026-10-13
> Status: Completed
> Author: planner
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [31](./31_global-kbar-search-plan.md), [41](./41_user-my-contracts-plan.md), [49](./49_live-users-presence-plan.md), [63](./63_org-chart-admin-profile-plan.md), [73](./73_benefits-url-filters-plan.md), [74](./74_admin-my-benefits-proxy-plan.md), [75](./75_benefits-admin-inactive-roster-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | Status | 관계 |
|------|--------|------|
| **07** | Completed | nav UX + **page·API·middleware** 서버 가드 필수 |
| **08** | Approved | 복지비 관리 UI는 **Read-only** — 본 plan **GET만** 확장 · `benefits/import` service token **변경 없음** |
| **31** | Revised | kbar는 `nav-config` 필터 결과와 **동일 RBAC** |
| **41** | Approved | `hasMyContracts` 패턴 → **`hasHrBenefitsNav`** nav flag 참조 |
| **49** | Approved | `/dashboard/benefits`는 `dashboard/layout` **`DashboardPresenceTrack` 상속** |
| **63** | Approved | `profiles.rank` · `RANK_BY_AFFILIATION.wake` **`인사팀`** |
| **73** | Approved | admin·HR 동일 URL 필터 **회귀 없음** |
| **74** | Approved | **HR은 내 복지비 proxy Out** — admin만 combobox |
| **75** | Approved | 비활성 명단·행 스타일 **HR 동일 적용** |

---

## 한 줄 요약

`system_role=user` 이고 **`affiliation=wake` + `rank=인사팀`** 인 active 사용자에게 **「복지비 관리」**(`/dashboard/benefits`) 및 `GET /api/benefits` 접근을 **admin과 동일(Read-only org-wide UI)** 로 허용하고, 사이드바에 **Overview 다음 · Admin 앞** 신규 그룹 **`HR (인사)`** 로만 노출한다. 다른 Admin 메뉴·plan 74 타인 proxy **제외**.

---

## 정책 확정안 (deep-interview · battle-plan)

| # | 항목 | 확정 |
|---|------|------|
| Q1 | **기능 범위** | **복지비 관리 페이지·API만** admin과 동일 (사용자/계약/CS 등 Admin **Out**) |
| Q2 | **인사팀 판별** | **`affiliation === 'wake'` AND `rank === '인사팀'`** · `status=active` · rank/소속 변경 시 **다음 요청부터** 즉시 반영 |
| Q3 | **네비** | 그룹 **`HR (인사)`** — Overview 다음, Admin **앞** · 1차 항목 **「복지비 관리」만** · Admin 그룹의 동일 링크는 **admin 전용 유지** (중복 노출 없음) |
| Q4 | **내 복지비** | HR도 일반 user와 동일 — **본인만** · combobox·`benefits_user` proxy **없음** (plan 74 admin 한정) |
| Q5 | **명칭** | 메뉴·페이지 **「복지비 관리」** |

### 접근 함수 (서버·middleware 공통)

```ts
// 예: src/features/auth/api/benefits-access.server.ts (신규 권장)
export function isWakeHrBenefitsManager(profile: AuthProfile): boolean {
  return (
    profile.system_role === 'user' &&
    profile.affiliation === 'wake' &&
    profile.rank === '인사팀'
  );
}

export function canAccessBenefitsAdmin(profile: AuthProfile): boolean {
  return profile.system_role === 'admin' || isWakeHrBenefitsManager(profile);
}
```

---

## 목표 & 완료 기준

### 목표

- 웨이크 인사팀(user)이 **복지비 관리** 화면·데이터를 admin과 **동일 UI/필터**로 사용한다.
- 인사팀에게 **Admin 그룹·타 admin 라우트**가 노출·접근되지 않는다.
- 인사팀 **내 복지비**는 plan 74 **admin proxy 없이** 본인만 조회한다.
- nav·middleware·RSC·API **방어 깊이 일치** (nav만 열리고 API 403 **금지**).

### 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | active user H: `affiliation=wake`, `rank=인사팀`, `system_role=user` | dashboard sidebar | **`HR (인사)`** 그룹에 **「복지비 관리」** link 보임 · **Admin (관리)** 그룹 **없음** |
| AC-02 | Playwright | H (AC-01) | **「복지비 관리」** 클릭 | `/dashboard/benefits` · 제목·필터·테이블(plan 73) **로드 성공** · overview redirect **없음** |
| AC-03 | Playwright | H · plan 75 fixture(비활성 행 등) | 복지비 관리 화면 | admin과 **동일** 비활성 명단·연한 빨강 행 규칙(plan 75) |
| AC-04 | Playwright | H | `/dashboard/users` 직접 진입 | overview redirect **또는** access-denied flash (admin-only) · users UI **없음** |
| AC-05 | Playwright | `system_role=admin` | sidebar | **Admin** 그룹에 **「복지비 관리」** · **`HR (인사)` 그룹 없음** (admin 중복 메뉴 **금지**) |
| AC-06 | Playwright | admin | `/dashboard/benefits` | plan 73·75 AC **회귀 없음** |
| AC-07 | Playwright | wake user W: `rank=마케팅팀` | sidebar | **「복지비 관리」** 없음 · `/dashboard/benefits` 직접 접근 시 **거부**(overview + flash 등 plan 07 패턴) |
| AC-08 | Playwright | H | `/dashboard/my-benefits` | **사용자 선택 combobox 없음** · **본인** 월별 데이터만 |
| AC-09 | API | H 세션 · 유효 `month` | `GET /api/benefits?month=YYYY-MM` | HTTP **200** · `success: true` · `data` 구조 admin GET과 **동일** |
| AC-10 | API | W (마케팅팀) 세션 | `GET /api/benefits?month=YYYY-MM` | HTTP **403** |
| AC-11 | API | user 세션 | `GET /api/benefits/import` (service token **없음**) | 기존 동작 **유지** (HR에 session import **부여하지 않음**) |
| AC-12 | Playwright | H | ⌘K → **「복지비 관리」** | `/dashboard/benefits` (plan 31 RBAC) |
| AC-13 | Playwright | H | `/dashboard/benefits` | `dashboard/layout` 하위 — **별도 presence 코드 없음** (plan 49) |

---

## 범위 (In / Out)

### In Scope

| # | 영역 | 내용 |
|---|------|------|
| 1 | **Auth helper** | `canAccessBenefitsAdmin` · `isWakeHrBenefitsManager` (서버 단일 소스) |
| 2 | **Page guard** | `benefits/page.tsx` — `requireAdminPage` → **`requireBenefitsAdminPage()`** |
| 3 | **API** | `GET /api/benefits` — `requireAdminSession` → **`requireBenefitsAdminSession()`** |
| 4 | **Middleware + proxy** | `/dashboard/benefits` — `ADMIN_DASHBOARD_PATHS`에서 **분리** · HR 허용 · 타 admin path는 **admin만** |
| 5 | **Nav** | `nav-config`: **`HR (인사)`** 그룹 신규 · `access: { hasHrBenefitsNav: true }` · Admin의 복지비 항목 **유지** |
| 6 | **NavAccess** | `types.PermissionCheck.hasHrBenefitsNav` · `layout`에서 계산 · `checkNavAccess` 연동 |
| 7 | **E2E** | `e2e/benefits/hr-benefits-manager-access.spec.ts` (신규) + admin·user 회귀 |
| 8 | **FE** | 복지비 관리 컴포넌트 **변경 최소** — 권한은 서버·nav만 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| 사용자·계약·CS·system-email-logs | admin-only **유지** |
| `GET /api/my-benefits` HR proxy | **본인만** — plan 74 **변경 없음** |
| `POST /api/benefits/import` | **service token** automation only |
| DB·RLS·신규 role 컬럼 | profile **affiliation+rank** 만 사용 |
| HR 전용 URL (`/dashboard/hr/...`) | **기존** `/dashboard/benefits` |
| 인사 명부·기타 HR 메뉴 | 그룹만 확장 가능 · **1차 항목 1개** |

---

## 권한 / RBAC

| 대상 | admin | wake 인사팀 (user) | 기타 user |
|------|-------|-------------------|-----------|
| nav Admin 「복지비 관리」 | ✅ | ❌ | ❌ |
| nav HR 「복지비 관리」 | ❌ | ✅ | ❌ |
| `/dashboard/benefits` | ✅ | ✅ | ❌ |
| `GET /api/benefits` | ✅ | ✅ | 403 |
| `/dashboard/users` 등 admin paths | ✅ | ❌ | ❌ |
| 「내 복지비」 combobox (plan 74) | ✅ | ❌ | ❌ |
| `/dashboard/my-benefits` | ✅ (proxy) | ✅ (본인) | ✅ (본인) |

---

## 구현 메모 (backend-dev · frontend-dev)

### `admin-routes.ts`

- `ADMIN_DASHBOARD_PATHS`에서 **`/dashboard/benefits` 제거**.
- `BENEFITS_ADMIN_DASHBOARD_PATHS = ['/dashboard/benefits']` 및 `isBenefitsAdminDashboardPath()` 추가.
- `getAdminAccessDeniedParam` — benefits 거부 시 **`benefits`** flash 키 **유지**.

### `session.server.ts`

- `requireBenefitsAdminPage()` / `requireBenefitsAdminSession()` — 내부 `canAccessBenefitsAdmin(profile)`.

### `dashboard/layout.tsx`

```ts
const hasHrBenefitsNav = isWakeHrBenefitsManager(profile);
// NavAccessProvider에 전달
```

### `nav-config.ts` (순서)

1. Overview (개요)
2. **HR (인사)** — 복지비 관리 · `hasHrBenefitsNav`
3. Admin (관리) — 기존 (복지비는 `systemRole: admin`만)
4. Account (계정)

### Activity log

- **Read-only** 확장 — 신규 mutation Route **없음** · AC에 log 검증 **불필요**.

---

## 리스크

| 수준 | 내용 | 대응 |
|------|------|------|
| MED | middleware·page·API 불일치 | 단일 `canAccessBenefitsAdmin` |
| LOW | rank 문자열 오타·legacy | `organization.ts` **`인사팀`** 상수와 E2E 시드 고정 |
| LOW | admin이 HR 그룹까지 보임 | `hasHrBenefitsNav`는 **non-admin HR만** true |

---

## 검증 체크리스트 (verifier)

- [ ] `bunx playwright test e2e/benefits/hr-benefits-manager-access.spec.ts`
- [ ] `bunx playwright test e2e/benefits` 회귀 (admin URL filters · inactive roster · my-benefits)
- [ ] API AC-09~11 (request helper 또는 integration spec)
- [ ] `tsc` · lint · build
