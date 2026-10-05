# 조직도 · admin 프로필 슬림화 기획서

> Date: 2026-10-05
> Status: Approved
> Author: planner
> **SQL:** `63` · `supabase/sql/63_profiles_org_chart_fields.sql` (구현 시)
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [21](./21_user-profile-slim-migration-plan.md), [29](./29_profile-name-live-display-plan.md), [40](./40_filter-shell-loading-ux-plan.md), [49](./49_live-users-presence-plan.md), [50](./50_live-users-admin-hide-live-dot-plan.md), [57](./57_google-auth-approval-migration-plan.md), [58](./58_approval-birthday-optional-user-add-removal-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **07** | dashboard·`/api/*` defense in depth — nav 숨김은 UX, **서버 가드 필수** |
| **08** | CUD activity log — 본 plan mutation은 `user.approve`·`user.update` **기존 action** 확장 |
| **21** | profiles 슬림화 · admin-only Users 수정 — **본 plan에서 admin org 필드 분기·프로필 UI 축소** |
| **29** | `full_name` live 표시 — 조직도 person 노드 라벨에 사용 |
| **40** | listing filter shell — 본 plan은 단일 Read body Suspense |
| **49** | `/dashboard/*`는 `dashboard/layout.tsx` **`DashboardPresenceTrack` 상속** — `/dashboard/org-chart` 별도 track **불필요** |
| **50** | `system_role=admin` 목록 제외 패턴 — 조직도 API·트리 **동일 철학** |
| **57** | Google pending 승인 Sheet — **admin/user 분기·필드 확장** |
| **58** | 승인 시 생일 optional — user 승인 Zod와 **병행** |

**중복 금지:** 조직도 편집 UI · `reports_to` · WakeOne 미등록 인원 import · 채용예정 placeholder · kbar synonym 확장(1차 Out).

---

## 한 줄 요약

전 임직원 **Read-only 조직도**(`/dashboard/org-chart`, d3-org-chart + shadcn)를 추가하고, `profiles`에 **직급·리더 역할** 필드를 도입한다. **active `system_role=user`만** 트리에 표시하며, **admin 계정**은 조직도·프로필·Users 편집에서 **조직 데이터를 제외(슬림화)** 한다.

---

## 정책 확정안 (deep-interview · battle-plan)

### 조직도 UI

| 항목 | 확정 |
|------|------|
| **라이브러리** | [d3-org-chart](https://github.com/TagajN/D3-Organization-Chart) + shadcn/ui (참고: Medium TagajN) |
| **Nav** | Overview 그룹 **「조직도」** → `/dashboard/org-chart` · admin·user **동일 노출** |
| **소속 전환** | 상단 **Tabs 3개** — 웨이크 \| 산스 \| 산스파운드리 · URL `?affiliation=` (**nuqs**) |
| **데스크톱 (md+)** | d3 트리 + **pan/zoom** |
| **모바일 (<md)** | **drill-down만** — 소속 탭 → 팀/지점 목록 → 멤버 카드 · d3 **미로드** |
| **권한** | **Read-only** — 편집·드래그·placeholder **Out** |
| **표시 대상** | `status=active` **AND** `system_role=user` **AND** `position_level IS NOT NULL` **AND** affiliation 일치 |
| **제외** | admin · inactive/pending/rejected · `position_level` null · WakeOne 미등록 · 채용예정 |
| **노드 라벨** | `full_name` + `position_level` + `(T)`/`(P)` when leader_role set |
| **디자인** | WakeOne design system · `PageContainer` · shadcn Card/Avatar/Tabs · `Icons.*` only |

### profiles 신규 필드 (SQL 63)

| 컬럼 | UI | 규칙 |
|------|-----|------|
| `position_level` | 직급 | **user: 필수** (승인·추가·수정) · 소속별 **고정 Select** |
| `leader_role` | 리더 역할 | **optional** · `null` \| `team_leader`(T) \| `part_leader`(P) · 기본 UI **「선택 안 함」** |

**`POSITION_LEVEL_BY_AFFILIATION` (FE 상수 · BE Zod):**

| 소속 | 허용 직급 |
|------|-----------|
| wake | CEO, COO, 부장, 차장, 과장, 대리, 주임, 사원 |
| sans | CEO, 점장, 부점장, 선임매니저, 매니저, 쉐프 |
| sans_foundry | CEO, 공장장, 팀장, 차장, 오퍼레이터 |

### rank (부서/사업장) — 기존 `profiles.rank`

| 규칙 | 내용 |
|------|------|
| **user rank Select** | **팀명/지점만** — `RANK_BY_AFFILIATION`에서 **`경영진` 옵션 제외** |
| **CEO/COO** | admin이 `position_level=CEO` 또는 `COO` 설정 시 **`rank=경영진` 자동** (Route·폼 연동) |
| **경영진 의미** | **CEO·COO person 노드만** — **경영진 가상 팀 Out** |
| **legacy** | `rank=경영진` AND `position_level NOT IN (CEO, COO)` → **조직도 제외** · admin Users에서 수동 보정 |

### wake 트리 (규칙 기반 · `reports_to` 없음)

```
CEO  (rank=경영진, position_level=CEO)
 └─ COO  (rank=경영진, position_level=COO)
      ├─ [사업기획팀]
      ├─ [마케팅팀]
      ├─ [디자인팀]
      ├─ … (RANK_BY_AFFILIATION.wake에서 경영진·총무 제외 팀 + [총무])
      └─ (팀별 멤버 — 정렬 규칙 적용)
```

- **사업본부/경영본부 분기 없음** — 모든 팀이 **COO 직하**
- CEO/COO **0명 또는 복수** 시: 가상 루트 `웨이크` fallback **[INFERRED]**

### sans 트리

```
[산스] (가상 루트)
  ├─ [익선]       — rank=익선 멤버
  └─ [신세계강남] — rank=신세계강남 멤버
```

- **정렬:** 선임매니저 = 매니저 = 쉐프 (동급) → T > P → `full_name` 가나다순

### sans_foundry 트리

```
[공장장]  (position_level=공장장, rank=공장장)
  ├─ [생산팀]
  ├─ [품질팀]
  ├─ [공무팀]
  ├─ [지원팀]
  └─ [물류팀]
```

- `RANK_BY_AFFILIATION.sans_foundry`에서 **`공장장` 제외** 팀 = COO 하위 팀과 동급 구조
- **정렬:** 공장장 → 팀장 → 차장 → 오퍼레이터 + T/P 규칙

### wake 멤버 정렬 (팀 내)

1. **리더:** T > P > 없음 (**T는 직급보다 우선** — 예: 대리(T) > 과장(P))
2. **직급:** 부장 → 차장 → 과장 → 대리 → 주임 → 사원
3. **동급:** `full_name` localeCompare `ko`

### admin 슬림화

| 영역 | admin |
|------|-------|
| **조직도** | **미표시** (API·UI 동일) |
| **`/dashboard/profile`** | **아바타 · 이메일 · 이름(read-only)** 만 |
| **Users 수정 Sheet** | **편집:** 아바타 URL · system_role · **read-only:** full_name · **숨김:** 소속·rank·phone·birthday·직급·리더 |
| **승인 (system_role=admin)** | org·직급·리더·생일 **숨김** · DB org 컬럼 **null** |
| **승인 (system_role=user)** | affiliation·rank·**position_level 필수** · leader optional · phone·full_name 필수 |
| **PUT 대상 admin** | `avatar_url`·`system_role`만 허용 · org·개인 필드 **ignore/null** · `full_name` 변경 **400 forbidden_field** |

---

## Battle Plan 요약

### SCOPE

| 항목 | 내용 |
|------|------|
| **Goal** | Read-only 조직도 + profile 직급/리더 + admin org 분리 |
| **Done when** | AC #01–#16 · VAL · TREE · RANK · #17 Playwright green · CLI #18 green |
| **Not doing** | reports_to · org chart CUD · admin in tree · 경영진 가상팀 · bulk migration · kbar |

### STEPS

| # | 단계 | 산출 | Confidence |
|---|------|------|------------|
| 1 | SQL 63 | `supabase/sql/63_profiles_org_chart_fields.sql` | HIGH |
| 2 | `organization.ts` 확장 | position/leader constants · rank 팀-only helper · sort util | HIGH |
| 3 | `buildOrgChartTree` + unit test | `src/features/org-chart/api/service.server.ts` | MED |
| 4 | `GET /api/org-chart` | Route + session guard | HIGH |
| 5 | admin Zod·Route 분기 | approve·PUT·create schemas | HIGH |
| 6 | admin profile + Users Sheet variants | `profile-page-content` · form fields | HIGH |
| 7 | nav + page + tabs + loading | `/dashboard/org-chart` | HIGH |
| 8 | FE queries + desktop d3 | `OrgChartD3Canvas` client-only | MED |
| 9 | mobile drill-down | `OrgChartDrillDown` | HIGH |
| 10 | E2E | `e2e/org-chart/` | MED |
| 11 | verifier | tsc · lint · build · spec | HIGH |

**Checkpoint:** Step 3 — wake JSON 샘플 API 수동 smoke → d3 연동

### RISKS & MITIGATIONS

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | d3 SSR/hydration·resize | `'use client'` dynamic · tab switch `fit()` |
| HIGH | legacy `rank=경영진` non-CEO/COO | 조직도 제외 + admin 수동 보정 · AC TREE-03 |
| MED | CEO/COO 부재 fallback | 가상 루트 · AC TREE-02 |
| MED | admin PUT org payload | 서버 ignore + AC-16 |
| LOW | admin→user role 전환 org blank | 1차 수동 보완 · Out auto-seed |

### ROLLBACK

nav·page·`src/features/org-chart/**` 제거 → admin form revert → SQL 63 DROP columns(데이터 손실 주의).

### ESTIMATE

~20–28 files · ~900–1300 LOC · **Medium–Complex** · **~5–7시간**

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | active user 로그인 | sidebar Overview 확인 | **「조직도」** nav 항목이 보인다 |
| AC-02 | Playwright | active user | `/dashboard/org-chart` 이동 | 페이지 제목 **「조직도」** · description **「WakeOne 임직원 조직을 확인합니다.」** · 소속 탭 **웨이크·산스·산스파운드리** 3개 |
| AC-03 | Playwright | wake active user A (rank=마케팅팀, position_level=과장) · inactive user B | user가 웨이크 탭 · 데스크톱 viewport | d3 영역에 **A의 full_name** 포함 · **B 미포함** |
| AC-04 | Playwright | wake · CEO·COO 시드 2명 (position_level CEO/COO, rank=경영진) | 웨이크 탭 차트 | **CEO 노드 아래 COO 1명** · COO 아래 **팀 노드**(마케팅팀 등) · 사업/경영 본부 **분기 없음** |
| AC-05 | Playwright | 동일 팀 · user C 대리(T) · user D 과장(P) | 해당 팀 멤버 순서 확인 (모바일 drill-down 또는 API order) | **C가 D보다 위** |
| AC-06 | Playwright | mobile viewport (<768px) | 웨이크 탭 | **팀/지점 목록** 표시 · 팀 선택 시 **멤버 카드** · d3 canvas **없음** |
| AC-07 | Playwright | admin · Google pending user E | 승인 Sheet에서 affiliation·rank·position_level 설정 후 승인 | 성공 토스트 · 조직도 웨이크 탭에 **E 표시** |
| AC-08 | API | active user 세션 | `GET /api/org-chart?affiliation=wake` | HTTP **200** · 응답 nodes에 **inactive·admin·position_level null** 사용자 **0명** |
| AC-09 | API | admin · active user F | `PUT /api/users/F` body `position_level=과장` 성공 | `/dashboard/logs` **`user.update`** · metadata `changed_fields`에 **`position_level`** |
| AC-10 | Playwright | DB active admin A · active user B (동일 affiliation) | user가 조직도 웨이크 탭 | **B만** 표시 · **A 없음** |
| AC-11 | API | active user 세션 | `GET /api/org-chart?affiliation=wake` | 모든 person node의 user **system_role=user** |
| AC-12 | Playwright | **admin** 로그인 | `/dashboard/profile` | **아바타·이메일·이름(read-only)** 만 · 소속·부서·연락처·생일·직급·리더 **섹션 없음** |
| AC-13 | Playwright | admin · Users에서 **admin** 대상 G 수정 Sheet | Sheet 필드 확인 | **아바타 URL·시스템 역할**만 편집 · 이름 **read-only** · 소속·부서·연락처·생일·직급·리더 **없음** |
| AC-14 | Playwright | admin · Google pending H | 승인 Sheet **시스템 역할=admin** 선택 | **소속·부서·직급·리더·생일 필드 숨김** |
| AC-15 | Playwright/API | admin · pending H **admin** 승인 성공 | DB profiles H | `affiliation`·`rank`·`position_level`·`leader_role` **null** · `system_role=admin` |
| AC-16 | API | admin · active admin G | `PUT /api/users/G` body `affiliation:wake` | HTTP **200** · DB `affiliation` **null** · logs `changed_fields`에 affiliation **없음** |
| VAL-01 | Playwright | admin · 사용자 **추가** Sheet (user) **[INFERRED: create flow 존재 시]** 또는 user **승인** Sheet | 직급 미선택 후 제출 | 직급 오류 · **저장/승인 안 됨** |
| VAL-02 | Playwright | admin · Google pending **user** 승인 Sheet | 직급 미선택 후 승인 | **「직급을 선택해 주세요.」** 등 오류 · 승인 **안 됨** |
| VAL-03 | Playwright/API | active user B · `position_level=null` | 조직도·API 조회 | **B 미표시** |
| VAL-04 | Playwright | admin · pending **admin** 승인 Sheet | — | **직급 필드 없음** · 승인 성공 |
| TREE-02 | Playwright | wake · CEO·COO · user E (rank=마케팅팀) | 웨이크 탭 | **CEO → COO → [마케팅팀] → E** · **「경영진」팀 노드 없음** |
| TREE-03 | Playwright/API | wake · user F: rank=경영진, position_level=부장 | 조직도 조회 | **F 미표시** |
| RANK-01 | Playwright | admin · user 승인/추가 Sheet | rank Select 옵션 확인 | **「경영진」옵션 없음** · 팀명만 |
| RANK-02 | API | admin · user U | `PUT` `position_level=CEO` 성공 | DB **`rank=경영진`** |
| AC-17 | Playwright | active user | `/dashboard/org-chart` 진입 | 페이지가 **`dashboard/layout` 하위** — 별도 presence track 코드 **없이** layout **`DashboardPresenceTrack` 상속** (plan 49) |
| AC-18 | CLI | 구현 완료 | `bunx playwright test e2e/org-chart/` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 07 dashboard 가드 · plan 49 presence · plan 50 admin Live 제외 · plan 57 승인 flow · plan 58 생일 optional **유지**.

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **SQL 63** | `position_level` · `leader_role` columns + comments |
| B | **BE tree** | `buildOrgChartTree` · admin/user/position filters · wake/sans/sans_foundry rules |
| C | **BE API** | `GET /api/org-chart?affiliation=` |
| D | **BE admin** | approve·PUT·create Zod/route — user 필수 position · admin slim · CEO/COO→rank |
| E | **FE org-chart** | feature module · tabs(nuqs) · d3 desktop · drill-down mobile · loading |
| F | **FE admin** | profile admin variant · Users Sheet role branch · approve dynamic form |
| G | **Nav** | Overview 「조직도」 |
| H | **E2E** | `e2e/org-chart/` |
| I | **Profile read-only** | user 프로필에 직급·리더 표시 추가 |

### Out Scope

| 항목 | 비고 |
|------|------|
| 조직도 편집·드래그 | Read-only |
| `reports_to` | 후속 |
| admin 조직도 노출 | 제외 |
| 경영진 가상 팀 | Out |
| WakeOne 미등록 import · 채용예정 placeholder | Out |
| legacy rank 일괄 migration | admin 수동 |
| kbar synonym | 후속 |
| `GET /api/org-chart` activity log | Read Out |
| admin→user 자동 org seed | Out |

---

## User Flow (Express)

### Flow A — 조직도 조회 (desktop)

1. active user 로그인 → Overview **「조직도」** 클릭
2. `/dashboard/org-chart?affiliation=wake` — RSC prefetch + Tabs
3. md+ viewport: d3 chart render · pan/zoom
4. 탭 전환 → nuqs affiliation 변경 → Suspense body refetch

### Flow B — 조직도 조회 (mobile)

1. 동일 진입 · 탭 선택
2. 팀/지점 목록 → 팀 tap → 멤버 카드 (Avatar·이름·직급·T/P)
3. 뒤로가기 → 팀 목록

### Flow C — admin user 승인

1. admin pending user → 승인 Sheet
2. system_role=user → affiliation·rank·**position_level 필수** · leader optional
3. system_role=admin → org 필드 숨김 → approve → org null

### Flow D — admin 프로필

1. admin `/dashboard/profile` → 아바타·이메일·이름만

---

## UI/UX

### Page (`/dashboard/org-chart`)

- `PageContainer`:
  - `pageTitle="조직도"`
  - `pageDescription="WakeOne 임직원 조직을 확인합니다."`
- **Tabs** (Suspense **밖**): 웨이크 \| 산스 \| 산스파운드리
- **Body** (Suspense `key={affiliation}` · `PageLoadingSpinner variant="fill"`)
- **Desktop:** shadcn `Card` wrapping d3 canvas · min-height **[INFERRED] 480px**
- **Mobile:** `OrgChartDrillDown` — Breadcrumb 또는 back button
- **Empty team:** 「구성원이 없습니다」 muted text
- **Person label:** `{full_name} {position_level}{leader suffix}` — 예: `홍길동 대리(T)`

### Admin profile (system_role=admin)

- **ProfileSection 1개:** Avatar + email + full_name read-only
- **Account 섹션 Out**

### Users Sheet variants

- **Target user:** full form + position_level(required) + leader_role(optional)
- **Target admin:** avatar + system_role only + read-only name

---

## API / Service Layer

### Feature 구조

```txt
src/features/org-chart/
  api/types.ts              — OrgChartNode, OrgChartResponse
  api/service.server.ts     — listOrgChartProfiles, buildOrgChartTree
  api/queries.ts            — orgChartKeys, orgChartQueryOptions
  api/service.ts            — fetchOrgChart (client)
  lib/sort-members.ts       — wake/sans/sans_foundry sort
  lib/build-tree.ts         — pure tree builder (testable)
  components/org-chart-page-content.tsx
  components/org-chart-tabs.tsx
  components/org-chart-d3-canvas.tsx   — 'use client'
  components/org-chart-drill-down.tsx  — 'use client'

src/features/users/constants/organization.ts  — POSITION_LEVEL_*, LEADER_ROLE_*, rankForUserSelect()
```

### READ API

| Method | Path | Guard | Log |
|--------|------|-------|-----|
| GET | `/api/org-chart?affiliation=wake\|sans\|sans_foundry` | `requireSession` + active | **Out** |

### Mutation (기존 Route 확장)

| Method | Path | 변경 |
|--------|------|------|
| POST | `/api/users/[id]/approval/approve` | user: position required · admin: org null |
| PUT | `/api/users/[id]` | user: position/leader · admin: slim |
| POST | `/api/users` | user create: position required **[if create In]** |

---

## 활동 감사 로그

> **GET /api/org-chart:** activity log **해당 없음** (Read-only).

### 기록 연동 (CUD)

| Route | action | 기록 분기 | metadata (success 2xx) |
|-------|--------|-----------|------------------------|
| `POST /api/users/[id]/approval/approve` | `user.approve` | **전 HTTP 분기** | user: `changed_fields` + `position_level`, `leader_role`, `rank`, … · admin: `admin_profile: true`, org fields omitted |
| `PUT /api/users/[id]` | `user.update` | **전 HTTP 분기** | user: `changed_fields` includes `position_level`/`leader_role` when changed · admin: org keys **not** in changed_fields |
| `POST /api/users` | `user.create` | **전 HTTP 분기** | `changed_fields` includes `position_level` when user created |

**AC 검증:** AC-09 (logs `user.update` + `position_level`).

**신규 action:** **없음**.

---

## E2E

| 항목 | 내용 |
|------|------|
| **경로** | `e2e/org-chart/list.spec.ts` · `e2e/org-chart/rbac.spec.ts` · `e2e/org-chart/validation.spec.ts` · `e2e/org-chart/org-chart.api.spec.ts` |
| **셀렉터** | `getByRole` · `getByPlaceholder` · `getByTestId` only |
| **인증** | `storageState` admin.json · user.json 재사용 |
| **viewport** | AC-06 mobile: Playwright viewport 또는 project config |

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `supabase/sql/63_profiles_org_chart_fields.sql` | 신규 |
| `src/features/users/constants/organization.ts` | position/leader · rank user select |
| `src/features/users/schemas/user.ts` | Zod 분기 |
| `src/features/users/components/user-*-form-fields.tsx` | role variants |
| `src/app/api/users/[id]/route.ts` | admin PUT slim |
| `src/app/api/users/[id]/approval/approve/route.ts` | admin approve |
| `src/features/auth/components/profile-page-content.tsx` | admin variant |
| `src/config/nav-config.ts` | 「조직도」 |
| `src/app/dashboard/org-chart/page.tsx`, `loading.tsx` | 신규 |
| `src/features/org-chart/**` | 신규 |
| `package.json` | `d3-org-chart` (+ `d3` if peer) |

**패턴:** plan 41 read-only page · plan 50 admin filter · `live-users/lib/dedupe-sort.ts` · wallet listing Suspense shell (plan 40)

---

## 열린 질문

| # | 항목 | 기본값 |
|---|------|--------|
| 1 | d3 `data-testid="org-chart-canvas"` | **In AC** **[INFERRED]** |
| 2 | CEO/COO 둘 다 없을 때 wake 루트 | 가상 「웨이크」→ 팀 직접 |
| 3 | user create flow (plan 58 removal) | **승인 flow만** VAL-01은 approve Sheet로 커버 |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-05 | 최초 작성 · Approved · `/root` planner Phase 3+4 | planner |
