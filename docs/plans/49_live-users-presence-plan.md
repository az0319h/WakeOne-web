# Live 접속자 (Dashboard Presence) 기획서

> Date: 2026-09-11
> Status: Approved
> Author: planner
> **SQL:** `49` · `supabase/sql/49_dashboard_presence_realtime.sql` (구현 시)
> **선행:** [07](./07_auth-route-guard-plan.md), [08](./08_activity-audit-log-plan.md), [10](./10_dashboard-birthday-profile-sheet-plan.md), [26](./26_loading-spinner-unification-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [29](./29_profile-name-live-display-plan.md), [40](./40_filter-shell-loading-ux-plan.md), [44](./44_force-initial-password-change-plan.md)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **07** | `dashboard/layout.tsx` `requireDashboardSession()` — presence track은 **active·인증 세션**에서만. inactive·미로그인 layout 진입 불가 |
| **08** | CUD activity log 전역 정책 — 본 plan은 **ephemeral presence · CUD 없음 → Out** |
| **10** | overview parallel slot — `@sales`만 mock·delay 잔존 → **Live 카드로 교체**. 생일 배너와 동일 **본인 강조 없음** |
| **26** | overview `@sales/loading.tsx` skeleton **예외 유지** — loading C안 |
| **27** | Realtime 패턴: `setAuth` → `channel().subscribe()` — 본 plan은 `postgres_changes`가 아닌 **Presence** |
| **29** | `full_name`·`avatar_url` live 갱신 — track payload stale 시 **re-track**(선택 Step) |
| **40** | infinite scroll next page → `PageLoadingSpinner variant="compact"` |
| **44** | force-password-change는 `dashboard/layout` **미마운트** → presence **track 제외** |

**중복 금지:** notifications·profile Realtime과 **채널·이벤트 타입 분리**. KPI/bar/area/pie mock 슬롯 **변경 Out**.

---

## 한 줄 요약

`/dashboard/overview` 「최근 판매」 슬롯을 Supabase Realtime **Presence** 기반 **Live 접속자 카드**로 교체하고, **`/dashboard/*` 전역**(`dashboard/layout.tsx`)에서 track·단일 private channel로 admin·user 전원이 실시간 접속 목록(5명 + infinite scroll)을 본다.

---

## 정책 확정안 (deep-interview · battle-plan)

| 항목 | 확정 |
|------|------|
| **Live 정의** | WakeOne **탭이 열려 있으면** 접속 중 (백그라운드 탭 포함 · Page Visibility strict **아님**) |
| **제거 시점** | 로그아웃 · 탭/창 닫기(unmount · `beforeunload`) |
| **레이아웃** | `recent-sales.tsx` — Avatar + 이름 + 이메일 + 우측 영역 유지 |
| **우측 영역** | **「접속 중」 Badge만** (구 `$금액` 자리) |
| **정렬** | `full_name` **가나다순** · 본인 강조 **없음** |
| **멀티탭** | `user_id` **dedupe** (1인 1행) |
| **페이지네이션** | 초기 **5명** · 초과 시 **infinite scroll** 5명씩 (클라이언트 slice) |
| **권한** | **admin + user** 동일 노출 |
| **track 범위** | **`/dashboard/*` 전체** (`dashboard/layout.tsx`) |
| **track 제외** | **force-password-change** · **inactive** · 미인증 |
| **Realtime** | **단일 private channel** `dashboard-presence` · active 로그인 user join/subscribe |
| **Mock 제거** | `@sales` **3초 delay** · sales 슬롯 **MockDataOverlay** 제거 |
| **loading** | **C안** — route skeleton 유지 + card body compact Spinner until first sync |
| **activity log** | **Out** — ephemeral presence, CUD·Route 없음 |
| **E2E** | **2 browser context** → overview 카드 **2명 표시 In** |

### UI copy

| UI 요소 | 문구 |
|---------|------|
| **CardTitle** | `접속 중` |
| **CardDescription (N≥1)** | `{N}명이 접속 중입니다` (N=1 포함) |
| **CardDescription (N=0)** | `현재 접속 중인 사용자가 없습니다` |
| **행 우측 Badge** | `접속 중` |
| **빈 목록 body** | `현재 접속 중인 사용자가 없습니다` |

---

## Battle Plan 요약

### SCOPE

| 항목 | 내용 |
|------|------|
| **Goal** | overview 「최근 판매」→ Live 접속자 카드 · `/dashboard/*` 전역 presence track |
| **Done when** | AC #1~#14 Playwright green · CLI #15 green · 전역 규칙 AC #13 |
| **Not doing** | Page Visibility strict · 접속 시각/소속 · admin-only · DB presence · Read API · KPI/bar mock 변경 |

### STEPS

| # | 단계 | 산출 | Confidence |
|---|------|------|------------|
| 1 | SQL Realtime Authorization | `supabase/sql/49_dashboard_presence_realtime.sql` | MED |
| 2 | FE feature scaffold | `src/features/live-users/` | HIGH |
| 3 | `DashboardPresenceTrack` | `dashboard/layout.tsx` | HIGH |
| 4 | `LiveUsersCard` + infinite list | overview `@sales` | HIGH |
| 5 | mock/delay/MockDataOverlay 제거 | overview layout + `@sales/page` | HIGH |
| 6 | (선택) profile re-track | `profile-status-realtime.tsx` | MED |
| 7 | 전역 규칙 mdc 반영 | `core-conventions.mdc` · `global-orchestrator.mdc` | HIGH |
| 8 | E2E 2 context | `e2e/live-users/` | MED |
| 9 | verifier | tsc · lint · build · spec | HIGH |

**Checkpoint:** Step 3 완료 후 2 browser tab 수동 smoke.

### RISKS & MITIGATIONS

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | Realtime Authorization 미설정 | Step 1 선행 · unauthenticated subscribe 실패 확인 |
| HIGH | E2E sync flakiness | `expect.poll` · workers=1 · timeout 15s |
| MED | track payload stale name | Step 6 re-track |
| MED | 멀티탭 dedupe 오류 | dedupe util test |
| LOW | presence leak(tab crash) | Supabase presence timeout · 문서화 |

### ROLLBACK

`DashboardPresenceTrack`·`LiveUsersCard` 제거 → `recent-sales` + delay + MockDataOverlay 복원 → SQL policy revert(선택) → mdc revert.

### ESTIMATE

~12–16 files · ~350–550 LOC · **Medium** · **~2.5–4시간**

---

## 전역 규칙 반영안

> **mdc 실제 수정은 구현 Step 7에서 수행.** 본 plan AC #13으로 완료 조건에 포함.

### 권장 조합

| 후보 | 역할 | 권장 |
|------|------|------|
| **`core-conventions.mdc`** | alwaysApply · FE/BE 공통 상한 | **✓ 1차** |
| **`global-orchestrator.mdc`** | `/root`·verifier 체크리스트 | **✓ 보조** |
| **plan 49 본문** | Realtime·E2E 상세 | 참조용 |

### `core-conventions.mdc` 추가안 (초안)

- Live presence track은 **`dashboard/layout.tsx` 단일 컴포넌트**(`DashboardPresenceTrack`)에서 수행.
- **`/dashboard/*` 하위 신규 페이지**는 별도 track 코드 **불필요**(layout 상속).
- **예외:** `dashboard/layout` **바깥** 라우트(`force-password-change` 등)는 track **금지**.
- 신규 **`/dashboard/*` 전용 layout** 추가 시 `DashboardPresenceTrack` **포함 또는 `dashboard/layout` 상속** 필수.

### `global-orchestrator.mdc` 추가안 (초안)

- planner·verifier: 신규 `/dashboard/*` 페이지 plan AC에 「`dashboard/layout` 하위 여부 · presence track 상속 확인」1줄.

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin·user **2 browser context** 각각 `/dashboard/*` 진입 후 overview | `/dashboard/overview`에서 Live 카드 확인 | 카드 제목 **「접속 중」** · description **「2명이 접속 중입니다」** · **두 사용자 `full_name`** 행 표시 |
| 2 | Playwright | AC #1 상태 | 각 행 확인 | Avatar(또는 이니셜) · **이름** · **이메일** · 우측 Badge **「접속 중」** |
| 3 | Playwright | AC #1 · 접속자 ≥6명 (시드 또는 다 context) | overview Live 카드 | **최초 5명**만 표시 · 목록 **스크롤** 시 **5명씩** 추가 로드 · 중복 행 **없음** |
| 4 | Playwright | admin 1 context · `/dashboard/overview`만 | user context **아직 없음** | description **「1명이 접속 중입니다」** · admin 본인 1행 · **본인 특별 강조 UI 없음** |
| 5 | Playwright | user context가 `/dashboard/overview` **닫기**(context close) | admin overview Live 카드 | **~15초 이내** description **「1명이 접속 중입니다」** · user 행 **사라짐** |
| 6 | Playwright | admin·user 2 context | overview Live 카드 행 순서 | `full_name` **가나다순** |
| 7 | Playwright | admin context | overview Live 카드 `@sales` 슬롯 | **「데모」MockDataOverlay 배지 없음** |
| 8 | Playwright | admin context · overview **첫 진입** | `@sales` 슬롯 로딩 | route `RecentSalesSkeleton` **또는** 카드 shell + body **compact Spinner** until sync — **3초 고정 delay 없음** |
| 9 | Playwright | user `must_change_initial_password` (force-change) | `/auth/force-password-change` | dashboard 셸 **미노출** · Live 카드 **없음** |
| 10 | Playwright | admin·user 각 overview | — | **동일 접속자 목록** (admin-only 필터 **없음**) |
| 11 | Playwright | admin 1 context · presence sync **전** | 카드 body | **compact Spinner** 또는 skeleton rows · sync 후 **목록 표시** |
| 12 | Playwright | 접속자 **0명** (모든 context closed · sync 후) | overview Live 카드 | description **「현재 접속 중인 사용자가 없습니다」** · body 동일 문구 |
| 13 | 수동/PR | 구현 Step 7 완료 | `core-conventions.mdc` · `global-orchestrator.mdc` diff | dashboard presence track **전역 규칙** 절 추가됨 |
| 14 | Playwright | admin·user 2 context · user가 `/dashboard/wallet` | admin overview Live 카드 | user **여전히 목록에 표시** (`/dashboard/*` track) |
| 15 | CLI | 구현 완료 후 | `bunx playwright test e2e/live-users/` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**회귀:** plan 07 dashboard 가드 · plan 10 생일 배너 · plan 27 notifications Realtime · plan 44 force-change · plan 26 overview skeleton 예외 **유지**.

---

## 범위 (In / Out)

### In Scope (구현 순서: **BE SQL → FE track → FE card → wiring → E2E → docs**)

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **SQL `49`** | Realtime Authorization policy — private channel `dashboard-presence` · authenticated active user만 join |
| B | **FE track** | `DashboardPresenceTrack` — `dashboard/layout.tsx` · track/untrack · payload · inactive skip |
| C | **FE feature** | `src/features/live-users/` — types · channel 상수 · dedupe/sort · presence hook |
| D | **FE card** | `LiveUsersCard` — `recent-sales` 레이아웃 · Badge · 5명 slice · IntersectionObserver infinite scroll |
| E | **FE wiring** | `@sales/page` delay 제거 · overview sales `MockDataOverlay` 제거 · loading C안 |
| F | **FE (선택)** | `ProfileStatusRealtime` — name/avatar 변경 시 presence re-track |
| G | **docs** | `core-conventions.mdc` · `global-orchestrator.mdc` 전역 규칙 절 |
| H | **검증** | Playwright AC #1–#14 · CLI #15 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| Page Visibility API strict offline | 백그라운드 탭 = 접속 중 |
| 접속 시각 · 소속(`affiliation`) 표시 | 우측 Badge만 |
| admin-only 목록 · per-page track | `/dashboard/*` layout track |
| `GET /api/live-users` 등 Read API | presence client-side |
| presence DB 테이블 · heartbeat cron | ephemeral |
| KPI 4카드 · bar/area/pie mock 슬롯 | Out |
| activity log | Out (아래 §) |
| force-change/inactive 사용자 목록 표시 | track 제외 |

---

## User Flow (Express)

### Flow A — 접속·목록 표시

1. active user 로그인 → `/dashboard/*` 진입
2. `dashboard/layout`이 `DashboardPresenceTrack` mount → private channel join · track `{ user_id, full_name, email, avatar_url }`
3. user가 `/dashboard/overview` 진입 → `@sales` 슬롯 `LiveUsersCard` subscribe
4. 첫 sync 전 card body compact Spinner → sync 후 dedupe·sort·5명 표시
5. 6명 이상 → 스크롤 시 5명씩 추가

### Flow B — 퇴장

1. user 탭 닫기 또는 로그아웃 → untrack/unsubscribe
2. 다른 클라이언트 overview 카드에서 해당 user 행 제거 · N 갱신

### Flow C — force-change 제외

1. 초기 PW 로그인 → `must_change_initial_password` → `/auth/force-password-change`
2. `dashboard/layout` 미마운트 → presence **미참여**

---

## UI/UX

### 카드 구조

- `recent-sales.tsx` Card 레이아웃 재사용: `CardHeader`(title + description) · `CardContent`(행 목록)
- 행: `Avatar` · `full_name` · `email` · 우측 `Badge` 「접속 중」
- empty: notifications empty 패턴(아이콘 + muted text)

### loading C안 (plan 26 정합)

| 구간 | UX |
|------|-----|
| **App Router `@sales` 전환** | `@sales/loading.tsx` → `RecentSalesSkeleton` **유지** (plan 26 overview 예외) |
| **presence first sync** | `CardContent` 내부 `PageLoadingSpinner variant="compact"` until `sync`/`join` |
| **infinite scroll next** | `PageLoadingSpinner variant="compact"` (plan 40) |

### `@sales` 정리

- `await delay(3000)` **삭제**
- `overview/layout.tsx` sales 슬롯 `MockDataOverlay` **제거**

---

## 기술 설계

### Presence track (`DashboardPresenceTrack`)

**위치:** `src/features/live-users/components/dashboard-presence-track.tsx` — `dashboard/layout.tsx`에 mount

```tsx
// 의사코드
const channel = supabase.channel('dashboard-presence', { config: { private: true } });
await supabase.realtime.setAuth(session.access_token);
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({
      user_id: profile.user_id,
      full_name: profile.full_name,
      email: profile.email,
      avatar_url: profile.avatar_url
    });
  }
});
// cleanup: untrack + removeChannel
// skip: profile.status === 'inactive'
// force-change: dashboard/layout 미마운트로 자동 제외
```

- **Page Visibility:** untrack **하지 않음** (백그라운드 탭 = 접속 중)
- **beforeunload / unmount:** untrack

### Subscribe (`LiveUsersCard`)

- 동일 channel `dashboard-presence` subscribe
- `presence` `sync`/`join`/`leave` 이벤트 → state 갱신
- **dedupe:** `user_id` 기준 Map — 멀티탭 1행
- **sort:** `full_name` localeCompare `ko`
- **slice:** `[0, visibleCount]` · visibleCount 초기 5 · scroll +5

### Feature 구조

```
src/features/live-users/
  api/types.ts              — LiveUserPresence, track payload
  lib/dedupe-sort.ts        — dedupeByUserId, sortByFullNameKo
  lib/constants.ts          — CHANNEL_NAME, PAGE_SIZE=5
  hooks/use-dashboard-presence.ts
  components/dashboard-presence-track.tsx
  components/live-users-card.tsx
  components/live-users-list.tsx
  components/live-users-card-skeleton.tsx  — (선택) skeleton rows
```

**Read:** React Query **불필요** — presence state는 channel subscription (local state / context)  
**CUD / mutations.ts:** **해당 없음**

### SQL (`supabase/sql/49_dashboard_presence_realtime.sql`)

- Realtime Authorization: **authenticated** + active profile(또는 JWT role)만 `dashboard-presence` join/track 허용
- `postgres_changes` publication **추가 없음**
- 정확 policy syntax는 Supabase Realtime Authorization 문서·기존 프로젝트 패턴에 맞춰 backend-dev가 작성 **[INFERRED]**

### Realtime Authorization

| 항목 | 값 |
|------|-----|
| channel | `dashboard-presence` |
| private | `true` |
| auth | `supabase.realtime.setAuth(access_token)` |
| profiles enrichment API | **Out** — track payload에 embed |

---

## 활동 감사 로그

> **activity log 해당 없음** — Supabase Realtime Presence는 ephemeral join/leave이며 DB CUD·mutation Route가 없다. Read-only UI + Realtime subscribe만. plan 08·45와 별개.

---

## E2E

| 항목 | 내용 |
|------|------|
| **경로** | `e2e/live-users/overview-presence.spec.ts` |
| **패턴** | `browser.newContext({ storageState: 'e2e/.auth/admin.json' })` + `user.json` — `e2e/activity-logs/logs-display.spec.ts` 참조 |
| **workers** | **1** (Realtime flakiness) |
| **sync 대기** | `expect.poll` · timeout 15s |
| **API spec** | **Out** |

---

## 영향 파일 & 패턴

| 파일 | 변경 |
|------|------|
| `src/app/dashboard/layout.tsx` | `DashboardPresenceTrack` mount |
| `src/app/dashboard/overview/layout.tsx` | sales `MockDataOverlay` 제거 |
| `src/app/dashboard/overview/@sales/page.tsx` | delay 제거 · `LiveUsersCard` |
| `src/features/overview/components/recent-sales.tsx` | 교체/deprecated |
| `src/features/live-users/**` | 신규 |
| `supabase/sql/49_dashboard_presence_realtime.sql` | 신규 |
| `.cursor/rules/core-conventions.mdc` | 전역 규칙 절 (Step 7) |
| `.cursor/rules/global-orchestrator.mdc` | verifier 체크 1줄 (Step 7) |

**패턴:** `notifications-realtime.tsx` · `notification-infinite-list.tsx` · `profile-status-realtime.tsx`

---

## 열린 질문

| # | 항목 | 기본값 |
|---|------|--------|
| 1 | Realtime Authorization policy exact SQL | backend-dev가 Supabase docs 기준 작성 |
| 2 | profile re-track (Step 6) | **선택** — MVP는 Out 가능, stale name 허용 |
| 3 | `LiveUsersCard` testId | `data-testid="live-users-card"` **[INFERRED]** |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-09-11 | 최초 작성 · Approved | planner |
