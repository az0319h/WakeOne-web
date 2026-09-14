# Live 접속자 — admin 목록 제외 · Live dot 기획서

> Date: 2026-09-14
> Status: Approved
> Author: planner
> **선행:** [49](./49_live-users-presence-plan.md) · [07](./07_auth-route-guard-plan.md) · [29](./29_profile-name-live-display-plan.md)
> **SQL / API:** 해당 없음 (FE-only · presence track payload 확장)

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **49** | **직접 확장** — `LiveUsersCard`·`DashboardPresenceTrack`·dedupe/sort·E2E `e2e/live-users/` 재사용. track 범위·channel·SQL **변경 Out** |
| **07** | admin/user RBAC — `system_role`은 `AuthProfile`에 이미 존재 |
| **29** | `full_name` live 갱신 — re-track 로직 유지, payload에 `system_role` 추가만 |
| **08** | activity log — **Out** (표시 전용 변경, CUD 없음) |

**중복 금지:** admin-only 목록 분기(시청자별 다른 목록) · track 중단 · Realtime Authorization 재작성 · 신규 Read API.

---

## 한 줄 요약

plan 49 Live 접속자 카드에서 **`system_role === 'admin'` 사용자는 Realtime track은 유지하되 목록·description count에서 제외**하고, 각 행 **`full_name` 왼쪽에 emerald Live dot(Preview B)** 을 추가한다.

---

## 정책 확정안 (deep-interview · battle-plan)

| 항목 | 확정 |
|------|------|
| **admin track** | Supabase Realtime presence **계속 track** (untrack·join 제한 **없음**) |
| **admin 표시** | `LiveUsersCard` **목록·`N명이 접속 중입니다` count** 에서 **제외** |
| **시청자 규칙** | admin·user **동일** — 누가 보더라도 admin 계정은 목록에 **없음** |
| **필터 기준** | `system_role === 'admin'` |
| **Live dot** | `full_name` **왼쪽 inline** · **녹색 pulse** · 우측 **「접속 중」 Badge 유지** |
| **dot 색상** | light: `bg-emerald-500` · dark: `dark:bg-emerald-400` · 대비: `ring-background` |
| **empty (admin만 online)** | description **「현재 접속 중인 사용자가 없습니다」** · body 동일 문구 · count **0** |
| **track 범위** | plan 49와 **동일** (`/dashboard/*` layout) |
| **activity log** | **Out** |
| **신규 API / SQL** | **Out** |
| **admin-only visibility split** | **Out** |

### UI copy (plan 49 유지)

| UI 요소 | 문구 |
|---------|------|
| **CardTitle** | `접속 중` |
| **CardDescription (N≥1, non-admin)** | `{N}명이 접속 중입니다` |
| **CardDescription (N=0)** | `현재 접속 중인 사용자가 없습니다` |
| **행 우측 Badge** | `접속 중` |
| **빈 목록 body** | `현재 접속 중인 사용자가 없습니다` |

---

## Battle Plan 요약

### SCOPE

| 항목 | 내용 |
|------|------|
| **Goal** | admin display filter + Live dot per row |
| **Done when** | AC #1~#12 Playwright green · CLI #13 green · plan 49 회귀 AC 유지 |
| **Not doing** | track 중단 · admin-only split · SQL · API · activity log · Page Visibility 변경 |

### STEPS

| # | 단계 | 산출 | Confidence |
|---|------|------|------------|
| 1 | payload 확장 | `LiveUserTrackPayload.system_role` · `buildTrackPayload` | HIGH |
| 2 | display filter | `filterVisibleLiveUsers()` in `dedupe-sort.ts` (또는 hook derive) | HIGH |
| 3 | count·card wiring | `LiveUsersCard` filtered length · empty when admin-only | HIGH |
| 4 | Live dot UI | `LiveUsersList` row — pulse dot + theme tokens | HIGH |
| 5 | self-merge guard | `syncPresenceState` admin self-merge 후 filter | MED |
| 6 | E2E 갱신 | `e2e/live-users/overview-presence.spec.ts` · helpers | MED |
| 7 | verifier | tsc · lint · build · spec | HIGH |

**Checkpoint:** Step 2~3 완료 후 admin solo → empty · admin+user → user 1명 수동 smoke.

### RISKS & MITIGATIONS

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | `system_role` payload 누락 시 admin 노출 | track 시 `AuthProfile.system_role` 필수 · filter default `admin` treat if missing **[INFERRED: missing → exclude]** |
| MED | self-merge가 admin을 목록에 다시 넣음 | filter를 **merge 이후** 항상 적용 |
| MED | plan 49 E2E AC-04·AC-01 기대값 충돌 | spec·AC 표 동시 갱신 (본 plan §E2E) |
| LOW | dark mode dot 대비 부족 | `ring-background` + shadcn Badge 옆 visual check |

### ROLLBACK

filter·dot UI 제거 → plan 49 동작 복원 (payload field는 backward compatible).

### ESTIMATE

~6–8 files · ~120–220 LOC · **Simple–Medium** · **~1–2시간**

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| 1 | Playwright | admin·user **2 browser context** 각각 `/dashboard/*` 진입 후 overview | Live 카드 확인 | description **「1명이 접속 중입니다」** · **user `full_name` 행 1개** · **admin `full_name` 행 없음** · `data-testid="live-user-{adminId}"` **count 0** |
| 2 | Playwright | AC #1 상태 | user 행 확인 | Avatar(또는 이니셜) · **`full_name` 왼쪽 Live dot** (`data-testid="live-user-dot"`) · **이메일** · 우측 Badge **「접속 중」** |
| 3 | Playwright | **admin 1 context** · user context **없음** · `/dashboard/overview` | presence sync 후 Live 카드 | description **「현재 접속 중인 사용자가 없습니다」** · body 동일 문구 · **행 0개** · admin testId **없음** |
| 4 | Playwright | AC #3 | description count helper | `readLiveUsersDescriptionCount` **=== 0** (또는 empty copy만) |
| 5 | Playwright | **user 1 context** · admin **없음** | overview Live 카드 | **user 1행 표시** · description **「1명이 접속 중입니다」** · Live dot **보임** |
| 6 | Playwright | admin·user 2 context · user context **닫기** | admin overview Live 카드 | **~60초 이내** user 행 **사라짐** · description **empty copy** (admin은 애초에 미표시) |
| 7 | Playwright | light mode (`html` dark class **없음**) · user 행 표시 | Live dot class | `bg-emerald-500` **포함** · `ring-background` **포함** · pulse animation **적용** |
| 8 | Playwright | dark mode (`html.dark` 또는 `data-theme` dark) · user 행 표시 | Live dot class | `dark:bg-emerald-400` **포함** · dot **visible** |
| 9 | Playwright | admin·user 2 context · 둘 다 overview | 양쪽 Live 카드 | **동일 non-admin 목록** (admin testId 양쪽 **0**) — plan 49 AC-10 회귀 |
| 10 | Playwright | user `/dashboard/wallet` · admin overview | admin Live 카드 | **user 행 표시** · admin 행 **없음** — plan 49 AC-14 회귀 |
| 11 | Playwright | plan 49 AC-03 시나리오(6+ 접속) · **non-admin** 사용자만 count | infinite scroll | **필터 후** 5명 초기 · scroll +5 — dedupe·sort **유지** |
| 12 | Playwright | admin·user 2 context | `full_name` 순서 | **non-admin** 사용자만 대상 **가나다순** — plan 49 AC-06 회귀 |
| 13 | CLI | 구현 완료 | `bunx playwright test e2e/live-users/` · `npx tsc --noEmit` · `npm run lint:strict` · `npm run build` | 모두 통과 |

**plan 49 AC 매핑 (E2E 갱신 가이드):**

| plan 49 AC | plan 50 변경 |
|------------|--------------|
| AC-01 (2명) | **AC-01** — 1명(user only) |
| AC-02 | **AC-02** — dot 추가 assert |
| AC-03 | **AC-11** — count는 non-admin 기준 |
| AC-04 (admin solo 1명) | **AC-03·AC-04** — **0명 empty** |
| AC-05 | **AC-06** — admin 행 기대 제거 |
| AC-06 | **AC-12** |
| AC-07~09, 11 | **변경 없음** (회귀) |
| AC-10 | **AC-09** |
| AC-12 (0명 empty) | **AC-03** admin-only = empty |
| AC-14 | **AC-10** |

**회귀:** plan 49 track 범위 · channel · loading C안 · force-change 제외 · MockDataOverlay 없음 · `DashboardPresenceTrack` layout 단일 mount **유지**.

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **types** | `LiveUserTrackPayload` · `LiveUserPresence`에 `system_role: SystemRole` |
| B | **track** | `buildTrackPayload(profile)` — `system_role: profile.system_role` |
| C | **filter** | `filterVisibleLiveUsers(users)` — `system_role !== 'admin'` · dedupe/sort **후** 적용 |
| D | **hook** | `parsePresenceState` / `syncPresenceState` — filter 적용 · context `users`는 **display-only** |
| E | **card** | `LiveUsersCard` count = filtered length |
| F | **list UI** | `LiveUsersList` — `full_name` 왼쪽 pulse dot · theme tokens |
| G | **E2E** | `overview-presence.spec.ts` · helpers 기대값 갱신 |
| H | **검증** | AC #1–#13 |

### Out of Scope

| 항목 | 비고 |
|------|------|
| admin untrack / join 거부 | track 유지 |
| 시청자별 다른 목록 (admin-only split) | 전원 동일 필터 |
| `GET /api/live-users` | 없음 |
| SQL · Realtime Authorization 변경 | plan 49 SQL 유지 |
| activity log | ephemeral · CUD 없음 |
| 접속 시각 · 소속 표시 | plan 49 Out 유지 |
| KPI/bar/area mock 슬롯 | Out |

---

## UI/UX

### Live dot (Preview B)

```
[Avatar]  (●) full_name          [접속 중 Badge]
              email
```

| 항목 | spec |
|------|------|
| **위치** | 이름 `<p>` **inline-start** — flex row `items-center gap-1.5` 등 |
| **형태** | 원형 `h-2 w-2` (또는 `size-2`) · `rounded-full` · `animate-pulse` |
| **색** | `bg-emerald-500 dark:bg-emerald-400` |
| **대비** | `ring-2 ring-background` (또는 동등) |
| **a11y** | decorative — `aria-hidden="true"` · 의미는 우측 Badge·카드 title |
| **testId** | `data-testid="live-user-dot"` (행당 1) |

### admin 제외 empty

- admin만 online → plan 49 N=0과 **동일 copy** · Spinner 후 empty body
- admin은 **여전히 channel에 presence** (다른 클라이언트 디버깅·향후 확장용) — UI만 숨김

---

## 기술 설계

### Track payload 확장

```ts
// src/features/live-users/api/types.ts
export type LiveUserTrackPayload = {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  system_role: SystemRole; // 추가
};
```

```ts
// buildTrackPayload — use-dashboard-presence.tsx
function buildTrackPayload(profile: AuthProfile): LiveUserTrackPayload {
  return {
    user_id: profile.user_id,
    full_name: profile.full_name,
    email: profile.email,
    avatar_url: profile.avatar_url,
    system_role: profile.system_role
  };
}
```

### Display filter (권장 위치)

```ts
// src/features/live-users/lib/dedupe-sort.ts
export function filterVisibleLiveUsers(users: LiveUserPresence[]): LiveUserPresence[] {
  return users.filter((u) => u.system_role !== 'admin');
}

export function dedupeSortAndFilterVisible(users: LiveUserPresence[]): LiveUserPresence[] {
  return filterVisibleLiveUsers(dedupeAndSortUsers(users));
}
```

- **적용 지점:** `parsePresenceState` return · `syncPresenceState` self-merge **이후**
- **`LiveUsersCard`:** hook의 `users`가 이미 filtered이면 `count = users.length` 그대로
- **legacy payload** (`system_role` undefined): **[INFERRED]** treat as non-admin **또는** exclude if missing — 구현 시 **undefined는 `user`로 간주**해 기존 세션 호환, deploy 후 전원 re-track

### 영향 파일

| 파일 | 변경 |
|------|------|
| `src/features/live-users/api/types.ts` | `system_role` 필드 |
| `src/features/live-users/lib/dedupe-sort.ts` | `filterVisibleLiveUsers` |
| `src/features/live-users/hooks/use-dashboard-presence.tsx` | payload · filter wiring |
| `src/features/live-users/components/live-users-list.tsx` | Live dot |
| `src/features/live-users/components/live-users-card.tsx` | (필요 시) filtered count 확인 |
| `e2e/live-users/overview-presence.spec.ts` | AC 기대값 |
| `e2e/live-users/helpers.ts` | (필요 시) dot·count helper |

**패턴:** `file-preview.tsx` emerald token · plan 49 `LiveUsersList` row layout

---

## 활동 감사 로그

> **activity log 해당 없음** — 표시 필터·UI dot 추가만. DB CUD·mutation Route 없음. plan 08·45와 별개.

---

## E2E

| 항목 | 내용 |
|------|------|
| **경로** | `e2e/live-users/overview-presence.spec.ts` (기존 파일 **수정**) |
| **workers** | **1** (plan 49 유지) |
| **sync 대기** | `expect.poll` · timeout 15–90s (plan 49 유지) |
| **dark mode AC-08** | `page.emulateMedia({ colorScheme: 'dark' })` 또는 theme toggle helper **[INFERRED]** |
| **API spec** | **Out** |

---

## 열린 질문

| # | 항목 | 기본값 |
|---|------|--------|
| 1 | `system_role` missing in stale presence | **non-admin 취급** (과도한 empty 방지) |
| 2 | dot size `size-2` vs `size-2.5` | **size-2** (Preview B) |
| 3 | re-track on role change | **Out** — role 변경은 드묾 · 다음 session track |

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-09-14 | 최초 작성 · Approved (deep-interview 확정 반영) | planner |
