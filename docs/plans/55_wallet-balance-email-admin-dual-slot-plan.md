# 식대 잔액 이메일 — Admin 알림·2회 슬롯 기획서

> Date: 2026-09-28
> Status: Approved
> Author: planner
> **신규 SQL:** `55` · `supabase/sql/55_wallet_balance_email_slot2_admin_notif.sql` (구현 시 최대 번호+1 재확인)
> **선행:** [08](./08_activity-audit-log-plan.md), [20](./20_contract-reminder-email-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [28](./28_contract-reminder-notifications-plan.md), [32](./32_wallet-kbcard-sync-plan.md), [51](./51_wallet-balance-email-plan.md)

---

## ⛔ BLOCKER — plan 51 allowlist 유지

**본 plan도 plan 51 BLOCKER를 그대로 상속한다.** dev/staging에서 `shhong@wakecorp.com`·E2E 테스트 계정 외 실사용자 SMTP **금지**. `WALLET_BALANCE_EMAIL_MODE=allowlist` 기본 · Production 전환은 **Out**.

---

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **51** (Approved) | 식대 잔액 이메일 preferences·dispatch·run/recipient·`wallet.balance_email` · due=0 no-run · **Admin dispatch 인앱 Out** → **본 plan에서 In으로 정책 변경** |
| **28** (Approved) | `contract.reminder_admin` — run 종료 시 active admin bulk fan-out · title 분기 · CTA 발송 이력 · duplicate run 알림 없음 |
| **32** (Approved) | `listActiveAdminUserIds()` · notification INSERT는 activity log **Out** |
| **27** (Approved) | `notifications` bulk INSERT · Realtime · `getNotificationActions` |
| **08** (Approved) | preferences PATCH **전 HTTP 분기** `recordActivityLog` |
| **20** (Approved) | run/recipient 로그 UI 패턴 · Cron secret |

**관계:** plan 51 확장 — (1) dispatch run 완료 admin 요약 인앱, (2) 사용자당 최대 2 KST 시각 슬롯.
**중복 금지:** `wallet_balance_email_runs`(발송 이력) · `notifications`(인앱) · `activity_logs`(감사) 역할 분리. admin 알림은 **run 요약 1건/admin** — per-recipient admin 알림 **금지**.

---

## 한 줄 요약

식대 잔액 이메일 dispatch run이 **due ≥ 1로 생성·완료**될 때 active admin 전원에게 run 요약 인앱 알림 1건을 fan-out하고, 사용자 preferences에 **선택적 2번째 KST 시각 슬롯**(기본 OFF·주말 제외 공통·동일 시각 중복 불가)을 추가한다.

---

## deep-interview 확정 (2026-09-28 · A/A/A)

| # | 결정 |
|---|------|
| Q1 | dispatch run **1회당** active admin **전원**에게 **요약 1건** (`contract.reminder_admin` 패턴) |
| Q2 | **due ≥ 1 + run 생성 시** admin 알림 — `sent=0`·전부 blocked/skipped여도 run 요약 알림 **In** |
| Q3 | 슬롯2 **optional**(기본 OFF) · 주말 제외는 **사용자 단위 공통** · 슬롯1·2 **동일 시각 중복 불허** |

---

## battle-plan 요약

### 목표

- plan 51 **Admin dispatch 인앱 Out** 정책을 **In**으로 전환 (폭주 방지는 run당 1건 요약으로 해소).
- 사용자당 알림 시각 **최대 2개** — UI `+` 추가 / 슬롯2 삭제.

### DB 1안 (확정): 동일 테이블 컬럼 확장

정규화(별도 `wallet_balance_email_slots` 테이블) 대신 **`wallet_balance_email_preferences`에 컬럼 추가**:

| 컬럼 | 타입 | 기본값 | 비고 |
|------|------|--------|------|
| `slot2_enabled` | boolean | **false** | OFF면 slot2 dispatch **무시** |
| `hour2` | smallint 0–23 | 12 | `slot2_enabled=true`일 때만 유효 |
| `minute2` | smallint 0–59 | 15 | 동일 |

- 슬롯1 = 기존 `hour`/`minute` (마이그레이션·API 하위 호환).
- `exclude_weekends` = 사용자 단위 **공통** (슬롯1·2 모두 적용).

**dispatch due 매칭:** `enabled=true` AND (
  (`hour`,`minute`) = tick OR (`slot2_enabled` AND `hour2`,`minute2` = tick
)

동일 user가 slot1·slot2가 **같은 분**이면 PATCH 시 **400** (DB unique index 불필요 — API 검증).

### Admin fan-out 시점

| 경우 | admin `wallet.balance_email_admin` |
|------|-------------------------------------|
| due=0 early return | **없음** (plan 51 유지) |
| duplicate_run (`pending=0`) | **없음** (plan 28 패턴) |
| **신규 run** 생성 후 `finishWalletBalanceEmailRun` | **있음** — sent/blocked/skipped/failed 건수 요약 |
| catch-up (기존 run, pending만 처리) | **없음** — 동일 run_key 재알림 방지 |

### 리스크

| 등급 | 리스크 | 완화 |
|------|--------|------|
| HIGH | allowlist 우회 실발송 | plan 51 BLOCKER·E2E dry-run·grep AC 유지 |
| MED | slot2 OR 쿼리 누락으로 2번째 슬롯 미발송 | dispatch API spec slot2 전용 AC |
| MED | catch-up path에 admin 알림 중복 | fan-out을 **신규 run path만** 호출 |
| LOW | UI slot2 추가/삭제 state drift | 저장 성공 시 `form.reset` (plan 51 패턴) |

### 추정

- **범위:** SQL 1 · BE 4~6 파일 · FE 3~4 · E2E 2 spec 확장
- **복잡도:** Medium
- **예상:** ~2–3h (팀 파이프라인)

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | API | active admin A·B, due 사용자 1명, dispatch 신규 run | cron secret으로 `POST /api/wallet/balance-email/dispatch` (해당 KST 분) | HTTP 200 · run 1건 · **A·B 각각** `wallet.balance_email_admin` 1건 · body에 due/sent/failed/blocked/skipped **건수 요약** · 금액·이메일 **미포함** |
| AC-02 | API | due 1명 · 전원 blocked/skipped (sent=0) | dispatch 신규 run | run 1건 · admin 알림 **1건/admin** · title **일부 실패 또는 완료** 분기 중 sent=0에 맞는 문구 |
| AC-03 | API | 동일 `run_key` duplicate (`pending=0`) | 2차 dispatch | HTTP 200 duplicate · **신규 admin 알림 0건** |
| AC-04 | API | due **0명** | dispatch | HTTP 200 `run: null` · admin 알림 **0건** (plan 51 AC-NEW-01 유지) |
| AC-05 | Playwright | admin, AC-01 run 후 | `/dashboard/notifications` | admin 알림 CTA **「발송 이력 보기」** · 클릭 시 **`/dashboard/wallet/balance-email-logs`** |
| AC-06 | API | eligible user, slot1=09:00, slot2 OFF | KST 09:00 dispatch | due 1명 · slot1 매칭 |
| AC-07 | API | eligible user, slot1=09:00, `slot2_enabled=true`, slot2=18:30 | KST 18:30 dispatch | due 1명 · slot2 매칭 |
| AC-08 | API | slot1=12:15, `slot2_enabled=true`, slot2=12:15 | `PATCH` preferences | HTTP **400** · 메시지에 **동일 시각** 불가 의미 · activity log 실패 분기 1건 |
| AC-09 | Playwright | matched ≥1 user | Sheet 열기 → **「알림 추가」** → slot2 시각 설정 → 저장 | Sheet 닫힘 · entry summary에 **2개 시각** 표시 · `slot2_enabled=true` |
| AC-10 | Playwright | slot2 활성 | Sheet에서 slot2 **삭제(−)** → 저장 | slot2 UI 제거 · summary **1개 시각** · `slot2_enabled=false` |
| AC-11 | API | `exclude_weekends=true`, slot2 enabled, 토·일 | slot1 또는 slot2 due tick | recipient `skipped` · run 생성 시 admin 알림은 due≥1이면 **In** (주말 skip과 무관) |
| AC-12 | API | preferences PATCH slot2 필드 | activity logs | `wallet.balance_email_pref_update` · metadata `changed_fields`에 `slot2_enabled`/`hour2`/`minute2` allowlist |
| AC-13 | API/DB | admin fan-out 성공 | `activity_logs` 조회 | notification INSERT용 **추가 action 없음** · 기존 `wallet.balance_email_dispatch`만 (plan 32·51 패턴) |
| AC-14 | grep | `/dashboard/wallet/balance-email-logs` | layout | `dashboard/layout` 상속 · `DashboardPresenceTrack` 자동 (신규 `/dashboard/*` **없음**) |
| AC-15 | CLI | 구현 완료 | `bunx playwright test e2e/wallet-balance-email/` · tsc · lint · build | green · allowlist 외 sent 0건 · E2E cleanup pass |

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **SQL 55** | `slot2_enabled`, `hour2`, `minute2` 컬럼 · `notifications.type` + `wallet.balance_email_admin` CHECK 확장 · (선택) slot2 partial index |
| B | **BE due query** | `listDueWalletBalanceEmailUsers` — slot1 OR slot2 매칭 · 동일 user 중복 due 시 **1회만** fan-out |
| C | **BE preferences** | GET/PATCH slot2 필드 · duplicate time **400** · metadata changed_fields 확장 |
| D | **BE admin fan-out** | `insertWalletBalanceEmailAdminNotifications()` — `listActiveAdminUserIds()` bulk INSERT · **신규 run path만** · try/catch 격리 |
| E | **BE dispatch** | run finish 직후 admin fan-out hook |
| F | **FE Sheet** | slot2 **+ 알림 추가** / **− 삭제** · max 2 slots · entry summary 2시각 표시 |
| G | **FE types/service/mutations** | slot2 필드 · invalidate 유지 |
| H | **Notifications UI** | `wallet.balance_email_admin` CTA → balance-email-logs · `NOTIFICATION_ACTION_ROUTES` |
| I | **E2E** | `dispatch.api.spec.ts` admin·slot2 · `00-preferences-ui.spec.ts` 또는 신규 slot2 spec · `notifications.spec.ts` admin type |
| J | **env** | 변경 없음 (plan 51 BLOCKER env 유지) |

### Out Scope

- plan 51 **allowlist BLOCKER 해제** · Production `MODE=production` 전환
- Admin 알림 **이메일·푸시**
- 슬롯 **3개 이상**
- 슬롯별 **개별** `exclude_weekends`
- 공휴일 제외 · 요일별 체크박스
- catch-up run에 **추가** admin 알림
- notification INSERT **activity log**
- pg_cron 스케줄 변경 (매분 유지)
- `/dashboard/system-email-logs` 통합

---

## DB 설계 (`supabase/sql/55_wallet_balance_email_slot2_admin_notif.sql`)

```sql
-- Plan: 55_wallet-balance-email-admin-dual-slot-plan.md
-- Date: 2026-09-28
-- Status: Approved

alter table public.wallet_balance_email_preferences
  add column if not exists slot2_enabled boolean not null default false,
  add column if not exists hour2 smallint not null default 12 check (hour2 >= 0 and hour2 <= 23),
  add column if not exists minute2 smallint not null default 15 check (minute2 >= 0 and minute2 <= 59);

-- notifications.type CHECK additive migration (기존 타입 + wallet.balance_email_admin)
```

- 기존 row: `slot2_enabled=false` → 동작 **plan 51과 동일**.
- RLS·service-role mutation 정책 **변경 없음**.

### 인덱스 (권장)

```sql
create index if not exists idx_wallet_balance_email_preferences_enabled_schedule_slot2
  on public.wallet_balance_email_preferences (enabled, hour2, minute2)
  where enabled = true and slot2_enabled = true;
```

---

## API 요구사항

### `GET/PATCH /api/wallet/balance-email/preferences`

**PATCH body 확장:** `{ slot2_enabled?, hour2?, minute2? }` (기존 필드 유지)

**검증:**

| 규칙 | HTTP |
|------|------|
| `slot2_enabled=true` AND `(hour,minute)=(hour2,minute2)` | **400** `duplicate_schedule` |
| PATCH 후 merge 결과 동일 시각 | **400** |
| `hour2`/`minute2` 범위 | 0–23 / 0–59 |
| `slot2_enabled=false` | `hour2`/`minute2` 저장 가능하나 dispatch **미사용** |

**activity log:** `wallet.balance_email_pref_update` — metadata `changed_fields`에 slot2 필드 추가.

### `POST /api/wallet/balance-email/dispatch`

**due 조회 (의사코드):**

```
tick = (hour, minute) in KST
prefs where enabled
  and (
    (hour, minute) = tick
    or (slot2_enabled and hour2, minute2 = tick)
  )
→ eligible + snapshot 필터 (plan 51 동일)
→ 동일 user_id 중복 제거
```

**admin fan-out (신규 run path, `finishWalletBalanceEmailRun` 직후):**

```typescript
await insertWalletBalanceEmailAdminNotifications({
  runId,
  runKey,
  triggerSource: 'cron',
  dueCount,
  sentCount,
  failedCount,
  blockedCount,
  skippedCount,
  runStatus
});
// try/catch — 실패해도 dispatch HTTP 200·run 저장 유지
```

**duplicate / catch-up:** admin fan-out **호출하지 않음**.

---

## 인앱 알림 — Admin (`wallet.balance_email_admin`)

| 필드 | 값 |
|------|-----|
| **수신자** | `profiles.system_role='admin' AND status='active'` 전원 |
| **단위** | run당 admin **1건** (N recipients여도 admin 벨 1건) |
| **title** | `sentCount>0 && failedCount===0` → `식대 잔액 이메일 전송 완료` · `sentCount>0 && failedCount>0` → `식대 잔액 이메일 일부 전송 실패` · `sentCount===0 && dueCount>0` → `식대 잔액 이메일 run 완료 (발송 0건)` |
| **body** | `대상 {due_count}명 · 발송 {sent_count} · 실패 {failed_count} · 차단 {blocked_count} · 건너뜀 {skipped_count}` |
| **CTA** | `발송 이력 보기` → `/dashboard/wallet/balance-email-logs` |
| **metadata allowlist** | `run_id`, `run_key`, `trigger_source`, `due_count`, `sent_count`, `failed_count`, `blocked_count`, `skipped_count`, `run_status`, `kind: wallet.balance_email_admin` |
| **금지** | 금액·recipient email·user name |

**activity log:** notification INSERT **Out** (plan 28·32·51).

---

## UI 요구사항

### Sheet (`wallet-balance-email-settings-sheet.tsx`)

| UI | 동작 |
|----|------|
| 슬롯1 | 기존 시·분 Select (enabled일 때) |
| **「+ 알림 추가」** | `slot2_enabled=true` · slot2 시·분 row 표시 (max **1회** — 총 2 slots) |
| **「−」 / 삭제** | `slot2_enabled=false` · slot2 row 숨김 (AlertModal **불필요** — 설정 저장이 아닌 슬롯 제거) |
| 주말 제외 | 슬롯 **공통** 1 Switch |
| 저장 성공 | `form.reset` 최신 preferences (plan 51) |

### Entry summary (`wallet-balance-email-settings-section.tsx`)

- enabled + slot2 → 예: `12:15, 18:30 (KST)` · slot2 OFF → 기존 단일 시각
- `formatBalanceEmailScheduleSummary` 확장 또는 slot2 전용 helper

---

## 활동 감사 로그

> [plan 08](./08_activity-audit-log-plan.md)

| 구분 | 내용 |
|------|------|
| **In** | `wallet.balance_email_pref_update` — slot2 필드 PATCH **전 분기** |
| **In** | `wallet.balance_email_dispatch` / send / failed / blocked — plan 51 **유지** |
| **Out** | `wallet.balance_email_admin` notification INSERT |
| **Out** | READ (preferences GET, logs GET) |

### preferences PATCH — duplicate time

| HTTP | `wallet.balance_email_pref_update` |
|------|-----------------------------------|
| 400 duplicate schedule | ✅ 실패 분기 |
| 200 | ✅ 성공 · `changed_fields`에 slot2 포함 |

---

## E2E (`e2e/wallet-balance-email/`)

| spec | 추가 AC |
|------|---------|
| `dispatch.api.spec.ts` | AC-01~04 · slot2 due 매칭 · admin notification count |
| `00-preferences-ui.spec.ts` | AC-09·10 · duplicate 400 (API helper) |
| `notifications.spec.ts` | AC-05 · admin CTA href |
| `helpers.ts` | slot2 PATCH helper · admin notification query |

---

## env

plan 51 **변경 없음** — `WALLET_BALANCE_EMAIL_MODE`, `ALLOWLIST`, `CRON_SECRET`, `E2E_WALLET_BALANCE_EMAIL_DRY_RUN`.

---

## 구현 순서 (팀 handoff)

1. **backend-dev:** SQL 55 · due OR query · preferences validation · admin fan-out · notification type
2. **designer:** Sheet slot2 add/remove wireframe · entry 2-line summary
3. **frontend-dev:** Sheet UI · summary · notification CTA route · types/mutations
4. **verifier:** E2E 확장 · allowlist grep · build

---

## 변경 파일 (예상)

```
supabase/sql/55_wallet_balance_email_slot2_admin_notif.sql
src/features/wallet/api/balance-email.types.ts
src/features/wallet/api/balance-email.service.server.ts
src/features/wallet/api/balance-email.service.ts (client)
src/features/wallet/utils/balance-email-schedule.ts
src/app/api/wallet/balance-email/preferences/route.ts
src/app/api/wallet/balance-email/dispatch/route.ts
src/features/notifications/api/fan-out.server.ts
src/features/notifications/api/types.ts
src/features/notifications/components/notification-helpers.ts
src/features/wallet/components/wallet-balance-email-settings-sheet.tsx
src/features/wallet/components/wallet-balance-email-settings-section.tsx
e2e/wallet-balance-email/dispatch.api.spec.ts
e2e/wallet-balance-email/00-preferences-ui.spec.ts
e2e/wallet-balance-email/notifications.spec.ts
e2e/wallet-balance-email/helpers.ts
scripts/cleanup-e2e-mock-data.mjs (slot2 preferences cleanup if needed)
docs/plans/README.md
```

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-09-28 | 최초 작성 (Approved) — admin dispatch 인앱 In · dual slot · plan 51 BLOCKER 유지 | planner |
