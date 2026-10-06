# 조직도 person 노드 hover 연락처 카드 기획서

> Date: 2026-10-06
> Status: Approved
> Author: planner
> **SQL:** 해당 없음 (`profiles.email` · `profiles.phone` 기존 컬럼 재사용)
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [30](./30_admin-user-phone-edit-plan.md), [40](./40_filter-shell-loading-ux-plan.md), [49](./49_live-users-presence-plan.md), [63](./63_org-chart-admin-profile-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **07** | dashboard·`/api/*` defense in depth — nav 숨김은 UX, **서버 가드 필수** |
| **08** | activity log — 본 plan **Read-only** → **해당 없음** |
| **30** | `formatPhoneDisplay()` · phone 11자리 DB · UI `010-0000-0000` — **표시 규칙 재사용** |
| **40** | listing filter shell — 본 plan은 plan 63 org-chart Suspense shell **유지** |
| **49** | `/dashboard/*`는 `dashboard/layout.tsx` **`DashboardPresenceTrack` 상속** |
| **63** | Read-only 조직도 d3 · `OrgChartD3Canvas` · `GET /api/org-chart` · admin 트리 제외 — **본 plan은 desktop person hover 연락처 확장** |

**중복 금지:** 모바일 drill-down hover · team/root hover · 카드에 이름/직급 · SQL migration · CUD · activity log · admin-only 연락처 제한.

---

## 한 줄 요약

데스크톱 d3 조직도(`OrgChartD3Canvas`) **person 노드** hover 시 shadcn **Hover Card (Option 1 — horizontal compact)** 로 **프로필 사진 · 이메일 · 휴대전화**만 표시한다. d3 HTML string 제약으로 **단일 Portal 오버레이 + 이벤트 위임** 패턴을 사용하며, `GET /api/org-chart` person node에 `email`·`phone`을 Read-only로 추가한다.

---

## 정책 확정안 (deep-interview · battle-plan · go)

### RBAC · 표시

| 항목 | 확정 |
|------|------|
| **열람 권한** | 로그인한 **모든 dashboard 사용자 (user + admin)** |
| **대상 노드** | `nodeType=person` **만** — team/root hover **없음** |
| **viewport** | **desktop md+ (≥768px)** d3 canvas **만** — 모바일 drill-down **변경 없음** |
| **빈값** | hover **항상 가능** · email/phone 없으면 **`—`** |
| **카드 필드** | Avatar · email · phone **3개만** — 이름/직급 **카드에 없음** (d3 노드 라벨 담당) |
| **phone 표시** | `formatPhoneDisplay()` from `@/lib/phone` (plan 30) |
| **email/phone 링크** | 1차 **plain text** (mailto/tel Out) |
| **Avatar fallback** | `avatarUrl` null → initials (drill-down `getInitials` 패턴) |
| **Hover delay** | `openDelay=200ms` · `closeDelay=100ms` |
| **d3 zoom/pan 중** | hover card **즉시 close** |
| **group CEO** (sans/foundry cross-affiliation) | person node이면 **동일 카드 In** |

### Privacy (내부 디렉터리)

로그인한 **전 임직원(user + admin)** 이 조직도 person hover로 **동료 email·휴대전화**를 열람할 수 있다. `requireSession` 뒤 Read-only API이며 외부 공개가 아니다. admin 계정은 조직도 **트리에 미표시**(plan 63)이나 **타 person hover 열람은 가능**.

---

## Battle Plan 요약

### SCOPE

| 항목 | 내용 |
|------|------|
| **Goal** | Desktop d3 person hover → 연락처 Hover Card (avatar · email · phone) |
| **Done when** | AC #01–#09 · plan 63 회귀 유지 |
| **Not doing** | mobile · CUD · migration · activity log · team/root hover · 카드 이름/직급 |

### STEPS

| # | 단계 | 산출 | Confidence |
|---|------|------|------------|
| 1 | BE SELECT + types + personNode mapping | API person nodes with email/phone | HIGH |
| 2 | API smoke | JSON shape 확인 | HIGH |
| 3 | `OrgChartPersonHoverCard` Option 1 UI | 신규 component | HIGH |
| 4 | d3 data-attributes + delegation + controlled HoverCard | desktop hover 동작 | MED |
| 5 | E2E `e2e/org-chart/person-hover.spec.ts` | AC-01~08 | MED |
| 6 | verifier | tsc · lint · build · spec | HIGH |

**Checkpoint:** Step 2 — `GET /api/org-chart` person node `email`/`phone` smoke 후 FE 착수.

### RISKS & MITIGATIONS

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | d3 pan/zoom 중 anchor 어긋남 | `getBoundingClientRect()` fixed anchor · zoom/pan/scroll 시 **카드 close** |
| HIGH | d3 innerHTML 재렌더 listener 유실 | **containerRef 1회 attach** · nodes 변경 시 Map만 갱신 |
| MED | legacy phone NULL | **`—`** placeholder |
| MED | 내부 연락처 전사 노출 | deep-interview Q1 확정 · §Privacy note |
| MED | Playwright hover flaky | `data-testid="org-chart-person-node-{userId}"` · poll `toBeVisible` |
| LOW | controlled HoverCard without per-node Trigger | fixed-position anchor span |

### ROLLBACK

FE hover overlay·delegation 제거 → plan 63 canvas 복원 · BE SELECT/types revert · E2E spec 삭제 · **DB 변경 없음**.

### ESTIMATE

~8–12 files · ~250–450 LOC · **Medium** · **~2–3시간**

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | active user · wake person P (email `p@test.com`, phone `01012345678`) · desktop viewport 1280×720 | `/dashboard/org-chart?affiliation=wake` · P `fullName` person 노드 **hover** | `getByTestId('org-chart-person-hover-card')` visible · `getByText('p@test.com')` · `getByText('010-1234-5678')` |
| AC-02 | Playwright | person Q · `phone=null` · desktop | Q person 노드 hover | hover card visible · phone **`—`** |
| AC-03 | Playwright | person R · `email=null` 또는 `''` · desktop | R person 노드 hover | hover card visible · email **`—`** |
| AC-04 | Playwright | wake · team 노드 「마케팅팀」· desktop | team 노드 hover | `getByTestId('org-chart-person-hover-card')` **없음** |
| AC-05 | Playwright | mobile viewport 375×812 · wake person S | `/dashboard/org-chart?affiliation=wake` · drill-down에서 S 확인 | d3 canvas(`org-chart-canvas`) **없음** · hover card spec **해당 없음** |
| AC-06 | API | active user 세션 | `GET /api/org-chart?affiliation=wake` | person node P에 **`email`** · **`phone`** 키 존재 · team/root node에 **없음** |
| AC-07 | Playwright | **admin** 로그인 · desktop · person T | T person 노드 hover | user와 **동일** email/phone 표시 |
| AC-08 | Playwright | active user | `/dashboard/org-chart` 진입 | 페이지가 **`dashboard/layout` 하위** — 별도 presence track 코드 **없이** layout **`DashboardPresenceTrack` 상속** (plan 49) |
| AC-09 | CLI | 구현 완료 | `bunx playwright test e2e/org-chart/person-hover.spec.ts` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 63 조직도 트리·admin 제외·mobile drill-down · plan 30 phone format · plan 49 presence **유지**.

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **BE Read** | `ORG_CHART_PROFILE_SELECT`에 `email, phone` · types · `personNode()` 매핑 |
| B | **FE d3** | person HTML `data-org-chart-person` · `data-user-id` · `data-testid` |
| C | **FE Hover Card** | `OrgChartPersonHoverCard` — controlled HoverCard · Option 1 layout |
| D | **FE delegation** | container pointerenter/leave · contactIndex Map · zoom/pan close |
| E | **E2E** | `e2e/org-chart/person-hover.spec.ts` · helper 타입 동기화 |

### Out Scope

| 항목 | 비고 |
|------|------|
| 모바일 drill-down hover/카드 | desktop d3 only |
| team/root 노드 hover | person only |
| 카드 이름·직급·rank | d3 노드 라벨 |
| SQL migration | profiles 기존 컬럼 |
| CUD / mutations | Read-only |
| activity log | Read Out |
| admin-only 연락처 | 전체 로그인 user+admin |
| `mailto:` / `tel:` | 1차 plain text |
| d3 키보드 focus hover | 1차 Out |
| 조직도 편집·admin 트리 노출 | plan 63 Out 유지 |

---

## User Flow (Express)

### Flow A — desktop person hover

1. active user/admin 로그인 → `/dashboard/org-chart?affiliation=wake` (desktop)
2. d3 canvas에 person 노드 표시 (plan 63)
3. person 노드에 pointer hover → 200ms 후 Hover Card 표시 (avatar · email · phone)
4. pointer leave · zoom · pan · affiliation 탭 전환 → card close

### Flow B — mobile (변경 없음)

1. mobile viewport → drill-down 멤버 카드 (plan 63)
2. hover card **없음**

---

## UI/UX

### Hover Card — Option 1 (horizontal compact)

| 요소 | spec |
|------|------|
| **Container** | `HoverCardContent` · `p-3` · `w-auto min-w-[240px] max-w-[320px]` · `data-testid="org-chart-person-hover-card"` |
| **Layout** | `flex flex-row items-center gap-3` |
| **Avatar** | shadcn `Avatar` · **`h-12 w-12`** · `AvatarImage` + `AvatarFallback` initials |
| **Text column** | `flex flex-col gap-1.5 min-w-0 flex-1` |
| **Email row** | `flex items-center gap-2 text-sm` · `Icons.mail` `h-4 w-4 shrink-0 text-muted-foreground` · value `truncate` |
| **Phone row** | `flex items-center gap-2 text-sm` · `Icons.phone` · `formatPhoneDisplay(phone) ?? '—'` |
| **Empty** | **`—`** · `text-muted-foreground` |
| **Side** | `side="right"` · `align="start"` |
| **Excluded on card** | full_name · position_level · leader_role · rank |

### d3 person node HTML

- `data-org-chart-person="true"`
- `data-user-id="{userId}"`
- `data-testid="org-chart-person-node-{userId}"`
- team/root: 위 attribute **미부여**

### Icons

- `@/components/icons` **`Icons.*` only**

---

## API / Service Layer

### Feature 구조 (변경·신규)

```txt
src/features/org-chart/
  api/types.ts                          — OrgChartNode/Profile email·phone
  api/service.server.ts                 — SELECT + personNode mapping
  components/org-chart-d3-canvas.tsx    — data-* + delegation hook
  components/org-chart-person-hover-card.tsx  — 신규 Option 1 UI
  hooks/use-org-chart-person-hover.ts   — 신규 (선택)
```

### READ API

| Method | Path | Guard | Log |
|--------|------|-------|-----|
| GET | `/api/org-chart?affiliation=wake\|sans\|sans_foundry` | `requireSession` + active | **Out** |

### BE 변경 상세

```ts
// ORG_CHART_PROFILE_SELECT 확장
'user_id, full_name, avatar_url, email, phone, affiliation, rank, position_level, leader_role, system_role, status'
```

- `OrgChartNode` (person only): `email?: string | null` · `phone?: string | null`
- `OrgChartProfile`: `email: string | null` · `phone: string | null`
- `personNode()` · `listOrgChartProfiles()` · `fetchGroupCeoProfile()` 매핑
- `src/app/api/org-chart/route.ts`: **변경 없음**

### FE Architecture

```
OrgChartD3Canvas
├── div[data-testid='org-chart-canvas']  ← event delegation
│   └── d3 person nodes [data-org-chart-person][data-user-id]
├── contactIndex: Map<userId, { avatarUrl, email, phone }>
└── OrgChartPersonHoverCard
    ├── HoverCard open={!!activeUserId} openDelay={200} closeDelay={100}
    ├── HoverCardTrigger: fixed anchor at node getBoundingClientRect()
    └── HoverCardContent: Option 1
```

---

## 활동 감사 로그

> **본 feature activity log 해당 없음.**  
> `GET /api/org-chart` Read-only 확장만. plan 08·63: Read Out.  
> CUD 없음 → `recordActivityLog` · `/dashboard/logs` AC **없음**.

---

## E2E

| 항목 | 내용 |
|------|------|
| **경로** | `e2e/org-chart/person-hover.spec.ts` (신규) |
| **셀렉터** | `getByRole` · `getByPlaceholder` · `getByTestId` only |
| **인증** | `storageState` `user.json` · `admin.json` |
| **viewport** | desktop AC: 1280×720 · mobile AC-05: 375×812 |
| **헬퍼** | `e2e/helpers/org-chart.ts` — `OrgChartNode` email/phone 타입 · `createOrgChartTestUser` phone/email |

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/features/org-chart/api/service.server.ts` | SELECT + mapping |
| `src/features/org-chart/api/types.ts` | email/phone types |
| `src/features/org-chart/components/org-chart-d3-canvas.tsx` | data-* + overlay integration |
| `src/features/org-chart/components/org-chart-person-hover-card.tsx` | **신규** |
| `src/features/org-chart/hooks/use-org-chart-person-hover.ts` | **신규 (선택)** |
| `src/components/ui/hover-card.tsx` | 재사용 (수정 금지) |
| `src/lib/phone.ts` | `formatPhoneDisplay` 재사용 |
| `e2e/org-chart/person-hover.spec.ts` | **신규** |
| `e2e/helpers/org-chart.ts` | 타입 동기화 |

**패턴:** plan 63 d3 client-only · plan 40 filter shell · controlled Radix overlay · plan 30 phone display

---

## 열린 질문 (go 시 기본값 확정)

| # | 질문 | 확정값 |
|---|------|--------|
| 1 | email/phone `mailto:` / `tel:` 링크 | **plain text** |
| 2 | Hover openDelay | **200ms** |
| 3 | d3 zoom/pan 중 카드 | **즉시 close** |
| 4 | person node `data-testid` | **In** — `org-chart-person-node-{userId}` |
| 5 | Avatar fallback | **initials** |
| 6 | cross-affiliation group CEO hover | **In** |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-10-06 | 최초 작성 · Approved · `/root` planner Phase 3+4 | planner |
