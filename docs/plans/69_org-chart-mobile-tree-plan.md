# 조직도 모바일 ReUI Tree 교체 기획서

> Date: 2026-10-06
> Status: Approved
> Author: planner
> **SQL:** 해당 없음
> **선행:** [40](./40_filter-shell-loading-ux-plan.md), [49](./49_live-users-presence-plan.md), [63](./63_org-chart-admin-profile-plan.md), [67](./67_org-chart-pdf-download-plan.md), [68](./68_org-chart-person-hover-contact-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **40** | listing filter shell — tabs Suspense **밖** · data body만 Suspense **유지** |
| **49** | `/dashboard/org-chart`는 `dashboard/layout.tsx` **`DashboardPresenceTrack` 상속** — 별도 track **불필요** |
| **63** | Read-only 조직도 · `OrgChartNode[]` flat API · d3 desktop · **모바일 drill-down → 본 plan에서 ReUI Tree로 교체** · person tap profile sheet **Out** |
| **67** | PDF 다운로드 desktop only · plan 67 AC-05 drill-down 회귀 → **본 plan AC-06·AC-REG-01로 tree 회귀 검증** |
| **68** | desktop person hover 연락처 · **모바일 tree 변경 없음(hover Out)** · plan 68 「drill-down 변경 없음」 문구는 본 plan 구현 후 **supersede** |

**중복 금지:** BE/API/SQL 변경 · 조직도 CUD · 모바일 profile Sheet · d3 mobile 로드 · drill-down UI 유지 · activity log 추가.

---

## 한 줄 요약

모바일(`<md`, 768px) 조직도 UI를 `OrgChartDrillDown`(팀 목록→멤버 카드 drill-down)에서 **ReUI Tree(`@reui/c-tree-6`)** 로 교체한다. D3와 **동일 parent-child 계층**을 collapsible vertical tree(Avatar + 이름 + 직급)로 표시하며, **Read-only·expand/collapse만** 허용한다. desktop d3(`OrgChartD3Canvas`)는 **변경 없음**.

---

## 정책 확정안 (deep-interview · battle-plan)

### breakpoint · 렌더 분기

| 항목 | 확정 |
|------|------|
| **breakpoint** | **`md` (768px)** — `org-chart-data-body.tsx` `useIsDesktop` **유지** |
| **≥768px** | `OrgChartD3Canvas` dynamic import · **변경 없음** |
| **<768px** | **`OrgChartMobileTree`** (신규) · d3 **미로드** |
| **데이터** | 기존 `useSuspenseQuery(orgChartQueryOptions(affiliation))` · **`OrgChartNode[]` 재사용** |

### Tree 계층 · 상호작용

| 항목 | 확정 |
|------|------|
| **계층** | API `OrgChartNode` flat 배열의 **`id` / `parentId` 그대로** — D3와 **동일 트리** (root → CEO → COO → team → members) |
| **노드 tap** | **Read-only** — expand/collapse **만** · profile Sheet · hover card · navigation **Out** |
| **기본 펼침** | **depth 1~2** — CEO 및 **직계 자식**(COO, `nodeType=team` 팀 노드) **expanded** · 팀 **하위 person(멤버)** **collapsed** |
| **person 행** | `Avatar` + `formatPersonLabel({ fullName, positionLevel, leaderRole })` · `getInitials` fallback |
| **team/root 행** | 팀/루트 **이름 라벨** · Avatar **없음** · chevron expand/collapse |
| **빈 상태** | 기존 `isOrgChartDisplayEmpty` + drill-down과 **동일 카피** — 「표시할 임직원이 없습니다」·「사용자 관리에서 직급을 설정하면…」 |

### 컴포넌트 · 설치

| 항목 | 확정 |
|------|------|
| **설치** | `npx shadcn@latest add @reui/c-tree-6` |
| **의존** | `@headless-tree/core`, `@headless-tree/react`, `@/components/reui/tree` |
| **신규 FE** | `OrgChartMobileTree` · `org-chart-mobile-tree.tsx` |
| **제거** | `OrgChartDrillDown` · `org-chart-drill-down.tsx` — import·파일 **삭제** |

---

## Battle Plan 요약

### SCOPE

| 항목 | 내용 |
|------|------|
| **Goal** | 모바일 조직도 drill-down → ReUI vertical tree |
| **Done when** | AC #01–#12 · AC-REG-01 · CLI #13 green |
| **Not doing** | BE/API/SQL · CUD · activity log · mobile profile/hover · desktop d3 변경 |

### STEPS

| # | 단계 | 산출 | Confidence |
|---|------|------|------------|
| 1 | shadcn ReUI tree 설치 | `@/components/reui/tree` | HIGH |
| 2 | `org-chart-nodes-to-tree.ts` | flat → headless-tree loader + default expanded ids | HIGH |
| 3 | `OrgChartMobileTree` | Avatar·label·empty state | MED |
| 4 | `org-chart-data-body.tsx` | drill-down → mobile tree | HIGH |
| 5 | `org-chart-drill-down.tsx` 삭제 | dead code 제거 | HIGH |
| 6 | E2E `list.spec.ts` | AC-03·05·06·07·10·TREE-02 mobile 경로 | MED |
| 7 | plan 67 download spec | AC-05 drill-down → tree 회귀 문구 **[INFERRED: download.spec.ts 존재 시]** | LOW |
| 8 | verifier | tsc · lint · build · spec | HIGH |

**Checkpoint:** Step 2 — wake 샘플 nodes로 depth·expanded set unit smoke

### RISKS & MITIGATIONS

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | headless-tree flat `parentId` 매핑 오류 | pure mapper + API order AC-05 |
| MED | sans/sans_foundry 다중 root | `parentId === null` 전부 root item · AC-08 |
| MED | CEO/COO 부재 fallback root | plan 63 `root:wake` 등 · AC-04 |
| LOW | ReUI tree a11y role | `getByRole('tree')` · `treeitem` AC-02 |
| LOW | plan 63/67/68 E2E drill-down 잔존 | grep `org-chart-leadership` · `팀 목록` 제거 |

### ESTIMATE

~8–12 files · ~350–550 LOC · **Medium** · **~2–4시간**

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | active user · **mobile viewport (375×812)** | `/dashboard/org-chart?affiliation=wake` | **`getByTestId('org-chart-canvas')` 0개** · **`getByTestId('org-chart-mobile-tree')` 1개** visible |
| AC-02 | Playwright | AC-01 · wake CEO·COO·팀 시드 | 페이지 로드 | **`getByRole('tree')`** visible · **CEO `fullName`** visible · **COO `fullName`** visible · **「마케팅팀」** 등 team 라벨 visible |
| AC-03 | Playwright | wake active user A (rank=마케팅팀, position_level=과장) · inactive user B | user · mobile · 웨이크 탭 | tree에 **A `fullName` 포함** (팀 노드 expand **없이도** CEO/COO/팀 depth까지 visible) · **B 미포함** · **`팀 목록` back 버튼 없음** |
| AC-04 | Playwright/API | wake · CEO·COO 시드 | mobile 웨이크 탭 | tree에서 **CEO 아래 COO** · COO 아래 **팀 노드**(마케팅팀 등) · **「사업본부」/「경영본부」 텍스트 없음** |
| AC-05 | Playwright | 동일 팀 · user C 대리(T) · user D 과장(P) | mobile · **「디자인팀」treeitem expand** (chevron/클릭) | 펼친 목록에서 **C `fullName`이 D `fullName`보다 위** (DOM 순서) |
| AC-06 | Playwright | mobile viewport | 웨이크 탭 | **ReUI tree** 표시 · **d3 canvas 없음** · **`data-testid='org-chart-leadership'` 없음** · **`data-testid='org-chart-teams'` 없음** · drill-down **「팀 목록」 버튼 없음** |
| AC-07 | Playwright | admin · Google pending user E 승인 완료 (plan 63 AC-07 flow) | mobile · 웨이크 탭 · **「마케팅팀」 expand** | tree에 **E `fullName` visible** |
| AC-08 | Playwright | **sans** 탭 · mobile | `/dashboard/org-chart?affiliation=sans` | **`getByRole('tree')`** visible · 지점 team 라벨(익선/신세계강남 등) **1개 이상** |
| AC-09 | Playwright | active user · **desktop viewport (≥768px)** | `/dashboard/org-chart?affiliation=wake` | **`getByTestId('org-chart-canvas')` visible** · **`getByTestId('org-chart-mobile-tree')` 0개** (desktop 회귀) |
| AC-10 | Playwright | DB active admin A · active user B | user · mobile · 웨이크 · B 소속 팀 expand | **B만** visible · **A 없음** |
| AC-11 | Playwright | active user | `/dashboard/org-chart` | 페이지가 **`dashboard/layout` 하위** — 별도 presence track 없이 layout **`DashboardPresenceTrack` 상속** (plan 49) |
| AC-12 | Playwright | plan 67 구현됨 · mobile | `/dashboard/org-chart` | **「PDF 다운로드」 버튼 보이지 않음** (plan 67 AC-04 회귀) |
| AC-REG-01 | Playwright | plan 67 · mobile · active user | tree 탐색 | **ReUI tree 정상** · drill-down UI **없음** (plan 67 AC-05 supersede) |
| AC-13 | CLI | 구현 완료 | `bunx playwright test e2e/org-chart/` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 63 desktop d3 · API 필터 · plan 68 desktop hover(구현 시) · plan 49 presence · plan 07 세션 **유지**.

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **FE deps** | `@reui/c-tree-6` shadcn add · `@/components/reui/tree` |
| B | **FE mapper** | `OrgChartNode[]` → headless-tree sync data loader · default expanded depth 1~2 |
| C | **FE component** | `OrgChartMobileTree` — person Avatar+label · team/root label |
| D | **FE wiring** | `org-chart-data-body.tsx` mobile 분기 교체 |
| E | **FE cleanup** | `org-chart-drill-down.tsx` 삭제 |
| F | **E2E** | `e2e/org-chart/list.spec.ts` AC-03·05·06·07·10·TREE-02 mobile 경로 |

### Out Scope

| 항목 | 비고 |
|------|------|
| BE · API · SQL | FE only |
| desktop `OrgChartD3Canvas` | 변경 없음 |
| person tap → profile Sheet | plan 63 mobile tap Out · 본 plan도 Out |
| mobile hover 연락처 | plan 68 desktop only |
| CUD · activity log | Read-only |
| PDF 레이아웃 | plan 67 |
| kbar · nav | 없음 |

---

## User Flow (Express)

### Flow A — 모바일 조직도 tree

1. active user → **조직도** → 소속 탭 (nuqs `affiliation`)
2. viewport `<768px`: **vertical tree** 렌더 — CEO·COO·팀 **펼침**, 멤버 **접힘**
3. 사용자가 팀 chevron tap → 멤버 목록 expand/collapse
4. person row tap → **동작 없음**(또는 chevron 없는 leaf — expand only)

### Flow B — desktop (변경 없음)

1. 동일 진입 · `OrgChartD3Canvas` · pan/zoom · plan 68 hover(별도 plan)

---

## UI/UX (designer)

### Mobile Tree (`OrgChartMobileTree`)

- **컨테이너:** `data-testid="org-chart-mobile-tree"` · `className="flex flex-1 flex-col"` **[INFERRED]**
- **Tree:** ReUI `@/components/reui/tree` — vertical · collapsible · **read-only**
- **Person item:**
  - 좌: `Avatar` `h-8 w-8` **[INFERRED]** — `avatarUrl` / `getInitials`
  - 우: primary `formatPersonLabel` · optional muted `rank` (drill-down `MemberCard`와 동일)
- **Team/root item:**
  - 텍스트: `node.name` (대괄호 포함 team명 그대로)
  - **Avatar 없음**
- **Empty:** drill-down과 **동일** 2줄 카피 · centered muted
- **탭:** plan 63 — Suspense **밖** tabs 유지

### Desktop (변경 없음)

- `OrgChartD3Canvas` in `Card` · min-height plan 63 **[INFERRED] 480px**

### 제거 UI

- `OrgChartDrillDown` — 경영진/팀 섹션 · 팀 Card grid · 「팀 목록」 back · `data-testid='org-chart-leadership'|'org-chart-teams'`

---

## Data Mapping (FE · designer/frontend-dev)

### 입력

```ts
nodes: OrgChartNode[]  // flat, id + parentId + nodeType
```

### Mapper (`src/features/org-chart/lib/org-chart-nodes-to-tree.ts` **[INFERRED path]**)

1. **`childrenByParentId: Map<string | null, OrgChartNode[]>`** — `parentId`로 그룹 · 팀 내 person 순서는 API 배열 순서 **유지** (plan 63 sort 반영됨)
2. **Root ids:** `parentId === null` 인 모든 node id (wake CEO, `root:wake`, sans root 등)
3. **headless-tree sync data loader:**
   - `getItem(itemId)` → `{ itemName: itemId, isFolder: nodeType !== 'person' }` **[INFERRED: team/root folder]**
   - `getChildren(itemId)` → direct children ids (stable order)
4. **Default expanded (`initialExpandedItems`):**
   - BFS from roots · **depth ≤ 2** node ids 포함
   - depth 0: root · depth 1: CEO · depth 2: COO + team nodes
   - **depth ≥ 3** (team 하위 person): **collapsed**
5. **headless-tree `initialState.expandedItems`** 또는 ReUI Tree prop으로 주입 **[INFERRED: @reui/c-tree-6 API 확인]**

### Person vs team 렌더 분기

| `nodeType` | UI |
|------------|-----|
| `person` | Avatar + `formatPersonLabel` |
| `team` | team name · folder chevron |
| `root` | root label · folder chevron |

---

## API / DB 요구사항

**변경 없음.** `GET /api/org-chart?affiliation=` · `OrgChartNode` 타입 · plan 63 필터 **유지**.

---

## 활동 감사 로그

> **activity log 해당 없음** — Read-only UI 교체 · mutation Route **없음**.

---

## E2E

| 항목 | 내용 |
|------|------|
| **경로** | `e2e/org-chart/list.spec.ts` (주) · plan 67 `download.spec.ts` AC-05 **[INFERRED]** |
| **셀렉터** | `getByRole('tree')` · `getByRole('treeitem', { name: … })` · `getByTestId('org-chart-mobile-tree')` · `getByTestId('org-chart-canvas')` |
| **viewport** | mobile: `{ width: 375, height: 812 }` |
| **제거 assertion** | `org-chart-leadership` · `org-chart-teams` · `button` 「팀 목록」 · team Card click drill |
| **추가 assertion** | tree expand → member order (AC-05) |

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `package.json` | `@headless-tree/core`, `@headless-tree/react` (shadcn add) |
| `src/components/reui/tree.tsx` | **신규** (shadcn) |
| `src/features/org-chart/lib/org-chart-nodes-to-tree.ts` | **신규** — mapper + default expanded |
| `src/features/org-chart/components/org-chart-mobile-tree.tsx` | **신규** |
| `src/features/org-chart/components/org-chart-data-body.tsx` | `OrgChartDrillDown` → `OrgChartMobileTree` |
| `src/features/org-chart/components/org-chart-drill-down.tsx` | **삭제** |
| `e2e/org-chart/list.spec.ts` | AC-03·05·06·07·10·TREE-02 mobile |

**재사용:** `formatPersonLabel` · `getInitials` · `isOrgChartDisplayEmpty` · `Avatar` · plan 40 Suspense shell

**패턴:** wallet listing mobile/desktop split · headless-tree sync data loader (ReUI docs)

---

## 열린 질문

| # | 항목 | 기본값 |
|---|------|--------|
| 1 | ReUI Tree `initialExpandedItems` API | shadcn add 후 `@/components/reui/tree` props 확인 · mapper unit optional |
| 2 | team node `treeitem` accessible name | `node.name` 그대로 (대괄호 포함) |
| 3 | sans multi-root expand depth | 동일 depth≤2 규칙 · root+CEO+지점 team expanded |

---

## 팀 전달 요약

### — /designer 에게 —

- 모바일 조직도: **ReUI vertical collapsible tree** — person은 **Avatar + 이름 직급(T/P)** · team/root는 **텍스트 folder**
- **기본 펼침:** CEO·COO·팀까지 · 멤버 접힘
- drill-down(경영진 섹션·팀 카드 grid·back) **전부 제거**
- 참고: plan 63 `MemberCard` · ReUI `@reui/c-tree-6` reference image

### — /backend-dev 에게 —

- **작업 없음** (FE only). API/SQL 변경 **금지**.

### — /frontend-dev 에게 —

- `npx shadcn@latest add @reui/c-tree-6` → `OrgChartMobileTree` + `org-chart-nodes-to-tree.ts`
- `org-chart-data-body.tsx` `<md` 분기만 교체 · d3 dynamic import **유지**
- `OrgChartDrillDown` **삭제** · E2E drill-down assertion → tree assertion

### — /verifier 에게 —

- AC-01~12 · AC-REG-01 · CLI-13
- mobile: `tree` + `org-chart-mobile-tree` · **no** canvas · **no** drill-down testids
- desktop 회귀 AC-09 · plan 67 mobile PDF hidden AC-12

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-06 | 최초 작성 · Approved · deep-interview 확정 반영 · plan 63 mobile drill-down supersede | planner |
