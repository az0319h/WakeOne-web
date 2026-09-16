# 식대 잔액 확인 이메일·알림 설정 기획서

> Date: 2026-09-16 (Revision)
> Status: Approved
> Author: planner
> **신규 SQL:** `50` · `supabase/sql/50_wallet_balance_email.sql` (구현 시 최대 번호+1 재확인)
> **선행:** [08](./08_activity-audit-log-plan.md), [20](./20_contract-reminder-email-plan.md), [27](./27_in-app-notifications-user-update-plan.md), [32](./32_wallet-kbcard-sync-plan.md), [49](./49_live-users-presence-plan.md)

---

## ⛔ BLOCKER — 개발·검증 중 실사용자 메일 발송 금지

**본 plan의 최우선 제약.** 구현·로컬 dev·Playwright·수동 cron 호출 **전 구간**에서 위반 시 merge·배포 **금지**.

| 규칙 | 내용 |
|------|------|
| **금지** | `profiles`에 등록된 **실제 임직원** 이메일로 SMTP 전송 |
| **허용 (dev/staging)** | `shhong@wakecorp.com` · E2E `uniqueEmail()`로 생성한 **테스트 계정만** |
| **기본 모드** | `WALLET_BALANCE_EMAIL_MODE=allowlist` (미설정 시 allowlist) |
| **Production** | `WALLET_BALANCE_EMAIL_MODE=production` **명시적 설정 + 배포 체크리스트** 없이는 allowlist 유지 |
| **E2E** | `E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1` → SMTP **skip** (plan 20 `E2E_REMINDER_DRY_RUN` 패턴) |
| **차단 시** | recipient `status=blocked` (또는 동등) + run 집계 + 서버 로그 — **SMTP 미호출** |
| **Verifier** | grep/AC: allowlist 외 `@wakecorp.com` 실사용자 mailbox로 `sent` 기록 **0건** |

allowlist env 예: `WALLET_BALANCE_EMAIL_ALLOWLIST=shhong@wakecorp.com` (쉼표 구분, E2E 테스트 이메일 추가 가능)

---

## 선행 plan 참조 (Phase 0)

| Plan | 관계 |
|------|------|
| **08** | preferences CUD·dispatch Route **전 HTTP 분기** `recordActivityLog` · `x-request-id` |
| **20** | Nodemailer·SMTP·run/recipient 로그 테이블·admin 로그 UI·Cron secret 패턴 |
| **27** | `notifications` bulk INSERT·Realtime·CTA helper |
| **32** | `wallet_syncs` matched 원장·Hero 스냅샷·인앱 금액 미포함 정책 |
| **49** | 신규 `/dashboard/*` — `dashboard/layout` `DashboardPresenceTrack` 상속 |

**관계:** plan 32 지갑 데이터 + plan 20 이메일 인프라 + plan 27 인앱 알림을 **사용자별 스케줄 잔액 안내**로 확장.
**중복 금지:** `wallet_syncs`(원장) · `wallet_balance_email_*`(발송 이력) · `notifications`(인앱) · `activity_logs`(감사) 역할 분리.

---

## 한 줄 요약

식대 sync 내역(matched)이 있는 사용자만 웹에서 **잔액 확인 이메일 알림**(기본 OFF)을 설정하고, Cron이 KST 기준 due 사용자에게 **최신 wallet 스냅샷** 메일 + **인앱 알림**을 fan-out한다. Admin은 타인 설정 수정·**식대 카드 하위 발송 로그 UI**를 갖는다. 개발 중 SMTP는 allowlist·dry-run으로 **실사용자 발송을 차단**한다.

---

## deep-interview 확정 결정

| 항목 | 결정 |
|------|------|
| **UI 노출** | `wallet_syncs` **matched ≥ 1** — 빈 상태(「식대 잔액 업데이트 내역이 없습니다」)면 설정 UI·배너 **없음** |
| **기본값** | **enabled=false (OFF)** — eligible 되어도 자동 발송 없음 |
| **스케줄 옵션** | **시·분** + **주말 제외** 토글 (`exclude_weekends`) |
| **기본 시각 (UI placeholder)** | 12:15 · 주말 **포함** (사용자가 ON 할 때 초기값) |
| **발송 내용** | 최신 스냅샷 — **남은 식대 + 이번 달 지급액** (Hero 동일) |
| **변동 없을 때** | **매일** 발송 (리마인더) |
| **ON/OFF** | **웹 UI만** — 이메일 링크로 켜기/끄기 **Out** |
| **첫 ON** | **다음 스케줄**부터 — 즉시 테스트 발송 **Out** |
| **Admin 설정** | `wallet_user` combobox로 **타인 조회·수정** |
| **Admin dispatch 알림** | **Out** — per-user 시각 다양 → admin 알림창 폭주 방지 |
| **사용자 인앱** | 이메일 발송 **동시** 1건 — 사이트에서 확인 후 메일 확인 |
| **인앱 문구** | 「오늘의 식대 잔액 안내 메일을 확인해 주세요」·금액 **미포함** · CTA 「식대 카드 보기」 |
| **이메일 디자인** | `send-password-reset-email.ts` 셸 통일 (520px·W 로고·#f9f9f9 카드) |
| **이메일 CTA** | 「식대 카드 보기」→ `/dashboard/wallet` · 「알림 설정 변경」→ `/dashboard/wallet#wallet-balance-email-settings` |
| **Admin 로그 nav** | Account > **식대 카드** > 「잔액 확인 이메일 로그」 (`systemRole: admin`) |
| **OFF 유도 UI** | eligible + OFF → 설정 Card + **한 줄 배너** 「식대 잔액을 매일 이메일로 받아보세요」 |
| **로깅** | preferences CUD · dispatch run · recipient sent/failed/blocked · **activity_logs 전부** |
| **Cron tick** | pg_cron **매분** (`* * * * *`, SQL `53`) — dispatch Route는 KST `HH:mm` 정확 매칭 |
| **Admin run 생성** | 해당 KST 분 **due 사용자 ≥ 1**일 때만 `wallet_balance_email_runs` + Admin 로그 UI |
| **due=0 tick** | run 행 **없음** · `wallet.balance_email_dispatch` **없음** · HTTP 200 `run: null` |
| **due≥1 tick** | run + recipients(sent/failed/blocked/skipped **전부**) — Admin이 스케줄 시각 실패·차단 확인 가능 |
| **Cron activity actor** | `actorEmail: wakeone.ops@gmail.com` · `actorDisplayName: 식대 잔액 이메일 (자동 발송)` |

---

## Revision 2026-09-16 — dispatch run logging policy

**배경:** 매분 cron + `run_key`=현재 KST 분 조합으로 due=0 tick마다 empty run·dispatch activity log가 누적됨.

**확정 정책 (deep-interview 2026-09-16):**

| 항목 | 결정 |
|------|------|
| pg_cron | **매분 유지** (`* * * * *`, SQL `53` 변경 없음) |
| Admin run (`wallet_balance_email_runs` + UI) | **due ≥ 1** at that KST minute일 때만 생성 |
| due = 0 | HTTP 200 · `run: null` · run INSERT **0** · `wallet.balance_email_dispatch` **0** |
| due ≥ 1 | run 생성 · recipient 전 outcome 기록 (sent/failed/blocked/skipped) |
| Per-recipient activity log | blocked/failed/skipped **유지** (run_id 포함) — `/dashboard/logs` audit |
| Cron actor | `wakeone.ops@gmail.com` (기존 `system@wakeone` **폐기**) |
| SQL migration | **불필요** — BE dispatch Route + `_utils.ts` + E2E만 |

**구현 범위 (본 revision):** `dispatch/route.ts` early-return(due=0) · actor email · E2E AC 보강. FE·cron Edge·SQL **Out**.

---

## 목표 & 완료 기준 (AC)

| # | 검증 | Given | When | Then |
|---|------|-------|------|------|
| AC-01 | Playwright | `system_role=user`, matched sync **0건** | `/dashboard/wallet` | 「식대 잔액 업데이트 내역이 없습니다」·알림 설정 Card·배너 **미표시** |
| AC-02 | Playwright | matched ≥ 1, preferences 없음 또는 enabled=false | `/dashboard/wallet` | 알림 설정 Card 표시·토글 **OFF**·배너 표시·**발송 없음** |
| AC-03 | API | eligible user, enabled=true, 12:15, exclude_weekends=false, allowlist email, 최신 snapshot 존재 | KST 12:15 dispatch tick | SMTP 1건(allowlist)·`wallet.balance_email` 인앱 1건·recipient `sent`·run `completed` 또는 `partial_failed` |
| AC-04 | API | enabled=true, exclude_weekends=**true**, due 1명 | KST 토·일 dispatch tick | SMTP **0건** · **run 1건** · recipient `skipped` · `skipped_count ≥ 1` |
| AC-05 | API | enabled=false → PATCH enabled=true 12:20, 현재 12:25 | dispatch | **즉시 발송 없음** · 다음날 12:20 슬롯부터 due |
| AC-06 | API | 잔액 전일과 동일 | due dispatch | **그래도** SMTP+인앱 발송 (AC-03과 동일) |
| AC-07 | API | `system_role=user` | `PATCH` 타인 user_id preferences | HTTP **403** · activity log 실패 분기 1건 |
| AC-08 | API | `system_role=admin` | `PATCH` 타인 preferences (enabled·hour·minute·exclude_weekends) | HTTP 200 · DB 반영 · `wallet.balance_email_pref_update` log · metadata `target_user_id`·변경 필드 allowlist |
| AC-09 | API | allowlist 외 email, mode≠production, due 1명 | dispatch | SMTP **미호출** · **run 1건** · recipient `blocked` · `wallet.balance_email_blocked` activity log 1건 |
| AC-10 | API | `E2E_WALLET_BALANCE_EMAIL_DRY_RUN=1` | dispatch | SMTP **0건** · run/recipient 행은 기록 가능 |
| AC-11 | Playwright | admin | nav **식대 카드** expand | 「잔액 확인 이메일 로그」 표시 |
| AC-12 | Playwright | admin | `/dashboard/wallet/balance-email-logs` | PageContainer·run 테이블·row Dialog — **독촉 로그 UI와 동일 패턴** (columns·Dialog 구조) |
| AC-13 | Playwright | `system_role=user` | `/dashboard/wallet/balance-email-logs` 직접 접근 | `/dashboard/overview` 리다이렉트 또는 403 |
| AC-14 | Playwright | user, enabled=true, dispatch 성공 | `/dashboard/notifications` | `wallet.balance_email` 1건 · body에 금액 **없음** · CTA 「식대 카드 보기」 |
| AC-15 | API | preferences PATCH (self ON) | activity logs | `wallet.balance_email_pref_update` · enabled·schedule 필드 metadata |
| AC-16 | API | SMTP 실패 (E2E simulate), due 1명 | dispatch | **run 1건** · recipient `failed` · `wallet.balance_email_failed` · run `partial_failed` 또는 `failed` |
| AC-17 | grep | `src/app/dashboard/wallet/balance-email-logs` | layout | `dashboard/layout` 상속 · 별도 layout 없으면 `DashboardPresenceTrack` 자동 |
| AC-18 | CLI | 구현 완료 | `bunx playwright test e2e/wallet-balance-email/` · tsc · lint · build | green · **allowlist 외 sent 0건** cleanup pass |
| AC-NEW-01 | API | due 사용자 **0명** · valid cron secret | dispatch | HTTP 200 · `run: null` · `wallet_balance_email_runs` **INSERT 0** · `wallet.balance_email_dispatch` activity log **0건** |
| AC-NEW-02 | API | dispatch (due≥1 sent 또는 401 cron) | `GET /api/activity-logs` | `actorEmail` = `wakeone.ops@gmail.com` · `actorDisplayName` = `식대 잔액 이메일 (자동 발송)` |
| AC-NEW-03 | API | due 2명 · 1 sent + 1 blocked | dispatch | run 1건 · recipients 2행(sent+blocked) · admin logs UI run Dialog에 **양쪽 outcome** 표시 |

---

## 범위 (In / Out)

### In Scope

| 순서 | 영역 | 내용 |
|------|------|------|
| A | **SQL 50** | `wallet_balance_email_preferences` · `wallet_balance_email_runs` · `wallet_balance_email_recipients` · `notifications.type` + `wallet.balance_email` |
| B | **Mail** | `send-wallet-balance-email.ts` — password-reset 셸 · snapshot 필드 2개 · CTA 2개 |
| C | **Mail safety** | `resolveWalletBalanceEmailRecipient()` allowlist · dry-run · mode env |
| D | **API** | `GET/PATCH /api/wallet/balance-email/preferences` (self + admin target query) |
| E | **API** | `POST /api/wallet/balance-email/dispatch` — Cron secret · due fan-out |
| F | **API** | `GET /api/wallet/balance-email/logs` · `GET .../logs/[runId]` — admin-only (plan 20 패턴) |
| G | **Cron** | pg_cron **매분** tick (SQL `53`) → Edge `wallet-balance-email-cron-trigger` → dispatch (due = KST HH:mm **정확 매칭**) |
| P | **Revision 2026-09-16** | dispatch due=0 no-run · cron actor email · E2E AC-NEW-* (BE only, SQL Out) |
| H | **FE** | wallet 페이지 `WalletBalanceEmailSettingsCard` + OFF 배너 + `#wallet-balance-email-settings` anchor |
| I | **FE** | admin `wallet_user` combobox 연동 — 타인 preferences 수정 |
| J | **FE** | `/dashboard/wallet/balance-email-logs` — system-email-logs 컴포넌트 **복제·도메인 치환** |
| K | **Nav** | `nav-config.ts` 식대 카드 하위 admin-only child |
| L | **Notifications** | fan-out `wallet.balance_email` · `getNotificationActions` CTA |
| M | **activity_logs** | 아래 §활동 감사 로그 |
| N | **E2E** | `e2e/wallet-balance-email/` — allowlist·dry-run 전제 |
| O | **env** | `env.example.txt` — MODE·ALLOWLIST·DRY_RUN·CRON secret |

### Out Scope

- 이메일 링크로 ON/OFF·스케줄 변경
- Admin dispatch run **인앱** 알림
- 공휴일 제외 · 요일별 개별 체크박스
- 기본값 자동 ON (eligible 시)
- ON 직후 즉시 테스트 메일
- `/dashboard/system-email-logs` 탭 통합 (별도 wallet 하위 로그)
- 인앱·이메일 본문에 **금액** (이메일 본문 snapshot 숫자는 **In** — plan 32는 **인앱** 금액 금지)
- Production `MODE=production` 전환 작업 (별도 배포 승인)
- 기존 DB empty run **일괄 삭제** (운영 cleanup 별도)
- pg_cron 스케줄 변경 (매분 **유지**)

---

## DB 설계 (`supabase/sql/50_wallet_balance_email.sql`)

### `wallet_balance_email_preferences`

| 컬럼 | 타입 | 비고 |
|------|------|------|
| `user_id` | uuid PK → auth.users | 1 user 1 row |
| `enabled` | boolean default **false** | |
| `hour` | smallint 0–23 | KST |
| `minute` | smallint 0–59 | |
| `exclude_weekends` | boolean default **false** | true = 토·일 skip |
| `updated_at` | timestamptz | |
| `updated_by_user_id` | uuid nullable | admin 대리 수정 추적 |

- **RLS:** self SELECT·UPDATE; admin SELECT·UPDATE all (또는 Route-only mutation — FE는 API 경유)
- **eligible 없는 user** — row 생성 **금지** (PATCH 시 404 또는 lazy create on first eligible only)

### `wallet_balance_email_runs`

| 컬럼 | 타입 | 비고 |
|------|------|------|
| `id` | bigint identity PK | |
| `run_key` | text unique | 예: `2026-09-15T12:15+09:00` tick id |
| `request_id` | uuid | |
| `trigger_source` | `cron` \| `admin` | 1차 cron only |
| `status` | completed \| partial_failed \| failed | |
| `due_count` | int | due 사용자 수 |
| `sent_count` | int | |
| `failed_count` | int | |
| `blocked_count` | int | allowlist 차단 |
| `skipped_count` | int | weekend·disabled 등 |
| `created_at` / `finished_at` | timestamptz | |

### `wallet_balance_email_recipients`

| 컬럼 | 타입 | 비고 |
|------|------|------|
| `run_id` | FK | |
| `user_id` | uuid | |
| `recipient_email` | text | |
| `status` | sent \| failed \| blocked \| skipped | |
| `error_message` | text nullable | |
| `notification_id` | bigint nullable | FK notifications |
| `sent_at` | timestamptz | |

- admin SELECT RLS (plan 18 패턴)
- INSERT service role only

### notifications CHECK 확장

- `wallet.balance_email` 추가 (SQL 50)

---

## API 요구사항

### `GET/PATCH /api/wallet/balance-email/preferences`

- Query: `user` = `self` \| uuid (admin only)
- PATCH body: `{ enabled?, hour?, minute?, exclude_weekends? }`
- eligible 검증: matched sync 0 → **404** (설정 UI와 동일)
- **전 return** `recordActivityLog` — action `wallet.balance_email_pref_update`
- FE: `mutations.ts` + `onSettled` invalidate

### `POST /api/wallet/balance-email/dispatch`

- Auth: `CRON_SECRET` / `WALLET_BALANCE_EMAIL_CRON_SECRET` (plan 20 패턴)
- Cron actor (`walletBalanceEmailCronActor`): `actorEmail: wakeone.ops@gmail.com` · `actorDisplayName: 식대 잔액 이메일 (자동 발송)` · `actorUserId: null`
- Flow:
  1. KST now → due preferences 조회 (enabled + HH:mm 일치)
  2. **`dueUsers.length === 0` → early return** HTTP 200 `{ run: null, recipients: [] }` — run INSERT **없음** · `wallet.balance_email_dispatch` **없음**
  3. **`dueUsers.length ≥ 1` → run row 생성** (`run_key` = KST tick idempotency — 동일 tick 중복 catch-up)
  4. 각 user: latest `wallet_syncs` matched snapshot
  5. `profiles.email` resolve → **allowlist gate**
  6. dry-run → skip SMTP, recipient `sent` (simulated)
  7. SMTP success → `sendWalletBalanceEmail` + notification INSERT
  8. recipient row + per-recipient activity log (send/failed/blocked/skipped)
  9. run finish + **`wallet.balance_email_dispatch` 1건** (due≥1만)
- **Admin 인앱 알림 Out**
- **duplicate_run** (동일 run_key, pending=0): 기존 run 반환 · dispatch activity log **생략** (no-op)

### Read logs (admin)

- `GET /api/wallet/balance-email/logs` — pagination (nuqs page/perPage)
- `GET /api/wallet/balance-email/logs/[runId]` — recipients + skip reasons

---

## 이메일 본문

- Subject: `[WakeOne] 식대 잔액 안내`
- 카드 1: 이번 달 지급액 (`monthly_limit`)
- 카드 2: 남은 식대 (`monthly_remaining`)
- CTA: 식대 카드 보기 · 알림 설정 변경 (anchor)
- 푸터: 「알림 설정은 식대 카드 페이지에서 변경할 수 있습니다.」
- 템플릿: `src/lib/mail/send-password-reset-email.ts` 레이아웃 **공통 helper 추출** 권장 (`renderWakeOneEmailShell`)

---

## 인앱 알림 (`wallet.balance_email`)

| 필드 | 값 |
|------|-----|
| title | `식대 잔액 안내` |
| body | `오늘의 식대 잔액 안내 메일을 확인해 주세요.` |
| CTA | `식대 카드 보기` → `/dashboard/wallet` |
| metadata allowlist | `run_id`, `kind: wallet.balance_email` — **금액·이름 금지** |

---

## 활동 감사 로그

> [plan 08](./08_activity-audit-log-plan.md)

### Cron dispatch actor (Revision 2026-09-16)

| 필드 | 값 |
|------|-----|
| `actorUserId` | `null` |
| `actorEmail` | `wakeone.ops@gmail.com` |
| `actorDisplayName` | `식대 잔액 이메일 (자동 발송)` |

401/500·per-recipient log·dispatch summary **동일 actor**.

### action 트리거

| action | 트리거 |
|--------|--------|
| `wallet.balance_email_pref_update` | preferences PATCH 전 분기 |
| `wallet.balance_email_send` | SMTP success 또는 dry-run simulated sent per recipient |
| `wallet.balance_email_failed` | SMTP error per recipient |
| `wallet.balance_email_blocked` | allowlist 차단 per recipient |
| `wallet.balance_email_dispatch` | dispatch run 종료 요약 — **due ≥ 1일 때만** |

### 기록 연동 — `POST /api/wallet/balance-email/dispatch`

| HTTP | 시나리오 | `wallet.balance_email_dispatch` | `send` | `blocked` | `failed` |
|------|----------|--------------------------------|--------|-----------|----------|
| 401 | cron secret 없/invalid | ✅ | ❌ | ❌ | ❌ |
| 200 | **due = 0** | **❌** | ❌ | ❌ | ❌ |
| 200 | due ≥ 1, run 완료 | ✅ | ✅×sent | ✅×blocked | ✅×failed |
| 200 | duplicate_run, pending=0 | ❌ | ❌ | ❌ | ❌ |
| 500 | exception | ✅ | ❌ | ❌ | ❌ |

**skipped** recipient: DB recipient row만 — 별도 activity action **없음** (기존).

metadata allowlist: `target_user_id`, `enabled`, `hour`, `minute`, `exclude_weekends`, `run_id`, `recipient_status`, `due_count`, `sent_count`, `failed_count`, `blocked_count`, `skipped_count`, `status` — password·token 금지.

---

## UI / Nav

### Wallet 페이지

- `WalletBalanceEmailSettingsCard` — Suspense 밖 shell 또는 eligible key Suspense
- Toggle · Time picker (hour/minute) · 주말 제외 Switch
- OFF + eligible → 상단 `Banner` 1줄
- admin + `wallet_user !== self` → 동일 Card editable

### Nav (`src/config/nav-config.ts`)

```typescript
{
  title: '식대 카드',
  url: '/dashboard/wallet',
  items: [
    {
      title: '잔액 확인 이메일 로그',
      url: '/dashboard/wallet/balance-email-logs',
      icon: 'send',
      access: { systemRole: 'admin' }
    }
  ]
}
```

### Balance email logs page

- `PageContainer` title 「잔액 확인 이메일 로그」
- `src/features/system-email-logs/**` 구조 복제 → `wallet-balance-email-logs/**`
- `loading.tsx` · `PageLoadingSpinner variant='fill'`

---

## Cron

- **매분 tick** — pg_cron `* * * * *` (SQL `53` · `wallet-balance-email-every-minute`)
- Edge Function `wallet-balance-email-cron-trigger` → `POST /api/wallet/balance-email/dispatch`
- dispatch Route가 KST `hour`/`minute` **정확 매칭** — due 없는 분은 early return (run·log 없음)
- Secret: `WALLET_BALANCE_EMAIL_CRON_SECRET` (fallback `CRON_SECRET`)

---

## E2E (`e2e/wallet-balance-email/`)

| spec | 흐름 |
|------|------|
| `preferences-ui.spec.ts` | AC-01·02·배너·admin 타인 수정 |
| `dispatch.api.spec.ts` | dry-run·allowlist·blocked·weekend skip · AC-NEW-01/02/03 |
| `balance-email-logs.spec.ts` | AC-11·12·13 |
| `notifications.spec.ts` | AC-14 |

- storageState 재사용 · `uniqueEmail` 테스트 user
- cleanup: E2E preferences·runs·notifications

---

## env (`env.example.txt` 추가)

```txt
# Wallet balance email (plan 51)
WALLET_BALANCE_EMAIL_MODE=allowlist
WALLET_BALANCE_EMAIL_ALLOWLIST=shhong@wakecorp.com
WALLET_BALANCE_EMAIL_CRON_SECRET=
E2E_WALLET_BALANCE_EMAIL_DRY_RUN=
```

---

## 구현 순서 (팀 handoff)

1. **backend-dev:** SQL 50 · preferences/dispatch/logs Route · mail · allowlist · activity log · notification fan-out · cron trigger
2. **designer:** Wallet settings Card·배너·logs page wireframe (system-email-logs 동형)
3. **frontend-dev:** settings UI · mutations · logs listing · nav · notification helper
4. **verifier:** spec · allowlist grep · build

---

## Production 전환 체크리스트 (Out — 별도 승인)

- [ ] `WALLET_BALANCE_EMAIL_MODE=production` Vercel Production 설정
- [ ] allowlist 제거 확인 grep
- [ ] shhong@wakecorp.com 스모크 1건
- [ ] rollback: `MODE=allowlist` 즉시 복귀

---

## 변경 파일 (Revision 2026-09-16)

```
src/app/api/wallet/balance-email/dispatch/route.ts   — due=0 early return · dispatch log 조건
src/app/api/wallet/balance-email/_utils.ts           — actorEmail wakeone.ops@gmail.com
e2e/wallet-balance-email/dispatch.api.spec.ts        — AC-NEW-01/02/03 · AC-04/09/16 기대값
```

## 변경 파일 (초기 구현 · 예상)

```
supabase/sql/50_wallet_balance_email.sql
supabase/sql/53_wallet_balance_email_cron.sql
src/lib/mail/send-wallet-balance-email.ts
src/lib/mail/wakeone-email-shell.ts (optional extract)
src/features/wallet/api/types.ts · service.server.ts · queries.ts · mutations.ts
src/features/wallet/components/wallet-balance-email-settings-card.tsx
src/features/wallet-balance-email-logs/** (clone from system-email-logs)
src/app/api/wallet/balance-email/**
src/app/dashboard/wallet/balance-email-logs/**
src/features/notifications/** (wallet.balance_email)
src/features/activity-logs/labels.ts · api/types.ts
src/config/nav-config.ts
e2e/wallet-balance-email/**
env.example.txt
```

---

## 수정 이력

| 날짜 | 변경 내용 | 작성자 |
|------|----------|--------|
| 2026-09-15 | 최초 작성 (Approved) | planner |
| 2026-09-16 | Revision: due=0 no-run/no-dispatch-log · due≥1 run+recipients · cron actor `wakeone.ops@gmail.com` · AC-NEW-01~03 · AC-04/09/16 개정 · Cron 매분 명시 | planner |
